const express = require('express');
const router = express.Router();
const { getPool, mapDbError } = require('../db');
const { authenticateToken } = require('../middleware/auth');

function getNowFormatted() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  const secs = String(d.getSeconds()).padStart(2, '0');

  return {
    date: `${day}-${month}-${year}`,
    time: `${hours}:${mins}:${secs}`
  };
}

/**
 * Helper to fetch active cart
 */
async function fetchCart(pool) {
  const [rows] = await pool.execute(`
    SELECT ID, BARCODE, NAME, TYPE, DOSE, QUANTITY, PRICE, AMOUNT, DATE 
    FROM sales 
    ORDER BY ID ASC
  `);
  const [sumRow] = await pool.execute('SELECT COALESCE(SUM(AMOUNT), 0) AS total, COUNT(*) as itemCount FROM sales');
  return {
    cart: rows,
    total: parseFloat(sumRow[0].total),
    itemCount: parseInt(sumRow[0].itemCount, 10)
  };
}

/**
 * GET /api/sales/cart
 * Retrieves active POS cart items and subtotal
 */
router.get('/cart', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    const data = await fetchCart(pool);
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * POST /api/sales/cart
 * Adds an item to the current sales bill cart
 */
router.post('/cart', authenticateToken, async (req, res) => {
  const { barcode, quantity } = req.body;

  if (!barcode) {
    return res.status(400).json({ success: false, message: 'Drug barcode is required.' });
  }
  const qty = parseInt(quantity, 10) || 1;
  if (qty <= 0) {
    return res.status(400).json({ success: false, message: 'Quantity must be at least 1.' });
  }

  const pool = getPool();
  try {
    // 1. Check drug existence and stock
    const [drugs] = await pool.execute(
      'SELECT BARCODE, NAME, TYPE, DOSE, SELLING_PRICE, QUANTITY FROM drugs WHERE BARCODE = ?',
      [barcode.trim()]
    );

    if (drugs.length === 0) {
      return res.status(404).json({ success: false, message: 'Drug not found with this barcode.' });
    }

    const drug = drugs[0];
    if (drug.QUANTITY < qty) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for '${drug.NAME}'. Available: ${drug.QUANTITY}, Requested: ${qty}`
      });
    }

    const unitPrice = parseFloat(drug.SELLING_PRICE) || 0;
    const amount = parseFloat((qty * unitPrice).toFixed(2));
    const { date } = getNowFormatted();

    // 2. Insert into `sales` table
    await pool.execute(`
      INSERT INTO sales (BARCODE, NAME, TYPE, DOSE, QUANTITY, PRICE, AMOUNT, DATE) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [drug.BARCODE, drug.NAME, drug.TYPE, drug.DOSE, qty, unitPrice, amount, date]);

    const data = await fetchCart(pool);
    res.status(201).json({
      success: true,
      message: `Added '${drug.NAME}' (${qty} pcs) to cart.`,
      ...data
    });
  } catch (err) {
    res.status(400).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * DELETE /api/sales/cart/:id
 * Removes a single item from active cart
 */
router.delete('/cart/:id', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    await pool.execute('DELETE FROM sales WHERE ID = ?', [req.params.id]);
    const data = await fetchCart(pool);
    res.json({ success: true, message: 'Item removed from bill.', ...data });
  } catch (err) {
    res.status(400).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * DELETE /api/sales/cart
 * Clears the entire active sales cart
 */
router.delete('/cart', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    await pool.execute('DELETE FROM sales');
    res.json({ success: true, message: 'Bill cart cleared.', cart: [], total: 0, itemCount: 0 });
  } catch (err) {
    res.status(400).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * POST /api/sales/checkout
 * Completes transaction:
 * - Checks and decrements stock in `drugs`
 * - Records bill items in `history_sales`
 * - Clears active `sales` cart
 * - Returns invoice summary
 */
router.post('/checkout', authenticateToken, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Fetch current cart
    const [cartItems] = await conn.execute('SELECT * FROM sales FOR UPDATE');
    if (cartItems.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ success: false, message: 'Cannot checkout an empty cart.' });
    }

    const { date, time } = getNowFormatted();
    const cashierName = req.user.name || 'admin';
    let grandTotal = 0;
    const receiptItems = [];

    // 2. Validate and decrement inventory for each item
    for (const item of cartItems) {
      const [drugRows] = await conn.execute(
        'SELECT BARCODE, NAME, QUANTITY FROM drugs WHERE BARCODE = ? FOR UPDATE',
        [item.BARCODE]
      );

      if (drugRows.length === 0) {
        throw new Error(`Drug with barcode '${item.BARCODE}' no longer exists in inventory.`);
      }

      const availableStock = drugRows[0].QUANTITY;
      if (availableStock < item.QUANTITY) {
        throw new Error(
          `Insufficient stock for '${item.NAME}'. Available: ${availableStock}, Requested: ${item.QUANTITY}`
        );
      }

      // Decrement stock
      await conn.execute(
        'UPDATE drugs SET QUANTITY = QUANTITY - ? WHERE BARCODE = ?',
        [item.QUANTITY, item.BARCODE]
      );

      // Record in history_sales
      await conn.execute(`
        INSERT INTO history_sales (USER_NAME, BARCODE, NAME, TYPE, DOSE, QUANTITY, PRICE, AMOUNT, DATE, TIME) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        cashierName,
        item.BARCODE,
        item.NAME,
        item.TYPE,
        item.DOSE,
        item.QUANTITY,
        item.PRICE,
        item.AMOUNT,
        date,
        time
      ]);

      grandTotal += item.AMOUNT;
      receiptItems.push({
        barcode: item.BARCODE,
        name: item.NAME,
        type: item.TYPE,
        dose: item.DOSE,
        quantity: item.QUANTITY,
        price: item.PRICE,
        amount: item.AMOUNT
      });
    }

    // 3. Clear active sales cart
    await conn.execute('DELETE FROM sales');

    // 4. Commit transaction
    await conn.commit();
    conn.release();

    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    res.json({
      success: true,
      message: 'Sale completed and recorded successfully!',
      invoice: {
        invoiceNumber,
        cashier: cashierName,
        date,
        time,
        items: receiptItems,
        grandTotal: parseFloat(grandTotal.toFixed(2))
      }
    });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('Checkout error:', err);
    res.status(400).json({ success: false, message: err.message || mapDbError(err) });
  }
});

/**
 * GET /api/sales/history
 * Retrieves historical sales with optional date filter (shift sales)
 */
router.get('/history', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    const { date, user } = req.query;
    let query = `
      SELECT ID, USER_NAME, BARCODE, NAME, TYPE, DOSE, QUANTITY, PRICE, AMOUNT, DATE, TIME 
      FROM history_sales WHERE 1=1
    `;
    const params = [];

    if (date && date.trim()) {
      query += ` AND DATE = ?`;
      params.push(date.trim());
    }
    if (user && user.trim()) {
      query += ` AND USER_NAME = ?`;
      params.push(user.trim());
    }

    query += ` ORDER BY ID DESC LIMIT 500`;

    const [rows] = await pool.execute(query, params);

    // Summary calculations
    let totalRevenue = 0;
    let totalItemsSold = 0;
    for (const r of rows) {
      totalRevenue += parseFloat(r.AMOUNT) || 0;
      totalItemsSold += parseInt(r.QUANTITY, 10) || 0;
    }

    res.json({
      success: true,
      count: rows.length,
      data: rows,
      summary: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalItemsSold
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * POST /api/sales/return
 * Retrieval Drug / Return: Restores returned drug quantity to inventory
 */
router.post('/return', authenticateToken, async (req, res) => {
  const { barcode, quantity } = req.body;

  if (!barcode) {
    return res.status(400).json({ success: false, message: 'Barcode is required for return.' });
  }
  const qty = parseInt(quantity, 10) || 1;
  if (qty <= 0) {
    return res.status(400).json({ success: false, message: 'Return quantity must be at least 1.' });
  }

  const pool = getPool();
  try {
    const [drugs] = await pool.execute(
      'SELECT BARCODE, NAME, QUANTITY FROM drugs WHERE BARCODE = ?',
      [barcode.trim()]
    );

    if (drugs.length === 0) {
      return res.status(404).json({ success: false, message: 'Drug not found.' });
    }

    await pool.execute(
      'UPDATE drugs SET QUANTITY = QUANTITY + ? WHERE BARCODE = ?',
      [qty, barcode.trim()]
    );

    const [updated] = await pool.execute(
      'SELECT BARCODE, NAME, QUANTITY FROM drugs WHERE BARCODE = ?',
      [barcode.trim()]
    );

    res.json({
      success: true,
      message: `Successfully returned ${qty} unit(s) of '${drugs[0].NAME}'. New stock: ${updated[0].QUANTITY}`,
      data: updated[0]
    });
  } catch (err) {
    res.status(400).json({ success: false, message: mapDbError(err) });
  }
});

module.exports = router;
