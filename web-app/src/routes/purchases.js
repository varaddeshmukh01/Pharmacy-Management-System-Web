const express = require('express');
const router = express.Router();
const { getPool, mapDbError } = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * Helper to fetch all purchases and spending summary
 */
async function fetchAllPurchases(pool) {
  const [rows] = await pool.execute(`
    SELECT BARCODE, NAME, TYPE, COMPANY_NAME, QUANTITY, PRICE, AMOUNT 
    FROM purchase 
    ORDER BY BARCODE ASC
  `);
  const [totalRow] = await pool.execute('SELECT COALESCE(SUM(AMOUNT), 0) AS totalSpending, COUNT(*) as dealCount FROM purchase');
  return {
    rows,
    summary: {
      totalSpending: parseFloat(totalRow[0].totalSpending),
      dealCount: parseInt(totalRow[0].dealCount, 10)
    }
  };
}

/**
 * GET /api/purchases
 * Retrieves all procurement deals
 */
router.get('/', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    const { q } = req.query;
    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      const [rows] = await pool.execute(`
        SELECT BARCODE, NAME, TYPE, COMPANY_NAME, QUANTITY, PRICE, AMOUNT 
        FROM purchase 
        WHERE BARCODE LIKE ? OR NAME LIKE ? OR COMPANY_NAME LIKE ? OR TYPE LIKE ?
        ORDER BY BARCODE ASC
      `, [term, term, term, term]);
      return res.json({ success: true, count: rows.length, data: rows });
    }

    const result = await fetchAllPurchases(pool);
    res.json({ success: true, count: result.rows.length, data: result.rows, summary: result.summary });
  } catch (err) {
    res.status(500).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * POST /api/purchases
 * Adds a new purchase deal
 */
router.post('/', authenticateToken, async (req, res) => {
  const { barcode, name, type, company_name, quantity, price } = req.body;

  if (!barcode || !name || !type || !company_name || quantity === undefined || price === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Barcode, Name, Type, Company, Quantity, and Price are required.'
    });
  }

  const qty = parseInt(quantity, 10) || 0;
  const unitPrice = parseFloat(price) || 0;
  const amount = parseFloat((qty * unitPrice).toFixed(2));

  const pool = getPool();
  try {
    await pool.execute(`
      INSERT INTO purchase (BARCODE, NAME, TYPE, COMPANY_NAME, QUANTITY, PRICE, AMOUNT) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [barcode.trim(), name.trim(), type.trim(), company_name.trim(), qty, unitPrice, amount]);

    const result = await fetchAllPurchases(pool);
    res.status(201).json({
      success: true,
      message: `Purchase deal for '${name}' recorded successfully.`,
      data: result.rows,
      summary: result.summary
    });
  } catch (err) {
    res.status(400).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * PUT /api/purchases/:barcode
 * Updates an existing purchase deal
 */
router.put('/:barcode', authenticateToken, async (req, res) => {
  const { name, type, company_name, quantity, price } = req.body;

  const qty = parseInt(quantity, 10) || 0;
  const unitPrice = parseFloat(price) || 0;
  const amount = parseFloat((qty * unitPrice).toFixed(2));

  const pool = getPool();
  try {
    await pool.execute(`
      UPDATE purchase SET 
        NAME = ?, TYPE = ?, COMPANY_NAME = ?, QUANTITY = ?, PRICE = ?, AMOUNT = ? 
      WHERE BARCODE = ?
    `, [name.trim(), type.trim(), company_name.trim(), qty, unitPrice, amount, req.params.barcode]);

    const result = await fetchAllPurchases(pool);
    res.json({
      success: true,
      message: 'Purchase deal updated successfully.',
      data: result.rows,
      summary: result.summary
    });
  } catch (err) {
    res.status(400).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * DELETE /api/purchases/:barcode
 * Deletes a purchase deal
 */
router.delete('/:barcode', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    await pool.execute('DELETE FROM purchase WHERE BARCODE = ?', [req.params.barcode]);
    const result = await fetchAllPurchases(pool);
    res.json({
      success: true,
      message: 'Purchase deal removed.',
      data: result.rows,
      summary: result.summary
    });
  } catch (err) {
    res.status(400).json({ success: false, message: mapDbError(err) });
  }
});

module.exports = router;
