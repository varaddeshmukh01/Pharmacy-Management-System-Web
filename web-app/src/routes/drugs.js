const express = require('express');
const router = express.Router();
const { getPool, mapDbError } = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * Helper to fetch all drugs
 */
async function fetchAllDrugs(pool) {
  const [rows] = await pool.execute(`
    SELECT BARCODE, NAME, TYPE, DOSE, CODE, COST_PRICE, SELLING_PRICE, 
           EXPIRY, COMPANY_NAME, 
           DATE_FORMAT(PRODUCTION_DATE, '%Y-%m-%d') AS PRODUCTION_DATE, 
           DATE_FORMAT(EXPIRATION_DATE, '%Y-%m-%d') AS EXPIRATION_DATE, 
           PLACE, QUANTITY 
    FROM drugs 
    ORDER BY NAME ASC
  `);
  return rows;
}

/**
 * GET /api/drugs
 * Retrieves all drugs with formatted dates
 */
router.get('/', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    const drugs = await fetchAllDrugs(pool);
    res.json({ success: true, count: drugs.length, data: drugs });
  } catch (err) {
    res.status(500).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * GET /api/drugs/alerts/expired
 * Retrieves expired drugs or drugs expiring in next 30 days
 */
router.get('/alerts/expired', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    // MySQL CURDATE() + INTERVAL 30 DAY
    const [rows] = await pool.execute(`
      SELECT BARCODE, NAME, TYPE, DOSE, CODE, COST_PRICE, SELLING_PRICE, 
             EXPIRY, COMPANY_NAME, 
             DATE_FORMAT(PRODUCTION_DATE, '%Y-%m-%d') AS PRODUCTION_DATE, 
             DATE_FORMAT(EXPIRATION_DATE, '%Y-%m-%d') AS EXPIRATION_DATE, 
             PLACE, QUANTITY,
             DATEDIFF(EXPIRATION_DATE, CURDATE()) AS DAYS_LEFT
      FROM drugs 
      WHERE EXPIRATION_DATE <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
      ORDER BY EXPIRATION_DATE ASC
    `);

    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * GET /api/drugs/alerts/almost-finish
 * Retrieves drugs with stock quantity <= 10
 */
router.get('/alerts/almost-finish', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    const [rows] = await pool.execute(`
      SELECT BARCODE, NAME, TYPE, DOSE, CODE, COST_PRICE, SELLING_PRICE, 
             EXPIRY, COMPANY_NAME, 
             DATE_FORMAT(PRODUCTION_DATE, '%Y-%m-%d') AS PRODUCTION_DATE, 
             DATE_FORMAT(EXPIRATION_DATE, '%Y-%m-%d') AS EXPIRATION_DATE, 
             PLACE, QUANTITY 
      FROM drugs 
      WHERE QUANTITY <= 10
      ORDER BY QUANTITY ASC
    `);

    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * GET /api/drugs/search
 * Dynamic search by barcode, name, company, type, place
 */
router.get('/search', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    const { q, company, type } = req.query;
    let query = `
      SELECT BARCODE, NAME, TYPE, DOSE, CODE, COST_PRICE, SELLING_PRICE, 
             EXPIRY, COMPANY_NAME, 
             DATE_FORMAT(PRODUCTION_DATE, '%Y-%m-%d') AS PRODUCTION_DATE, 
             DATE_FORMAT(EXPIRATION_DATE, '%Y-%m-%d') AS EXPIRATION_DATE, 
             PLACE, QUANTITY 
      FROM drugs WHERE 1=1
    `;
    const params = [];

    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      query += ` AND (BARCODE LIKE ? OR NAME LIKE ? OR CODE LIKE ? OR PLACE LIKE ?)`;
      params.push(term, term, term, term);
    }
    if (company && company.trim()) {
      query += ` AND COMPANY_NAME = ?`;
      params.push(company.trim());
    }
    if (type && type.trim()) {
      query += ` AND TYPE = ?`;
      params.push(type.trim());
    }

    query += ` ORDER BY NAME ASC`;

    const [rows] = await pool.execute(query, params);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * GET /api/drugs/:barcode
 * Retrieves single drug by barcode
 */
router.get('/:barcode', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    const [rows] = await pool.execute(`
      SELECT BARCODE, NAME, TYPE, DOSE, CODE, COST_PRICE, SELLING_PRICE, 
             EXPIRY, COMPANY_NAME, 
             DATE_FORMAT(PRODUCTION_DATE, '%Y-%m-%d') AS PRODUCTION_DATE, 
             DATE_FORMAT(EXPIRATION_DATE, '%Y-%m-%d') AS EXPIRATION_DATE, 
             PLACE, QUANTITY 
      FROM drugs WHERE BARCODE = ?
    `, [req.params.barcode]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Drug not found.' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * POST /api/drugs
 * Adds a new drug
 */
router.post('/', authenticateToken, async (req, res) => {
  const {
    barcode, name, type, dose, code, cost_price, selling_price,
    expiry, company_name, production_date, expiration_date, place, quantity
  } = req.body;

  if (!barcode || !name || !type || !company_name || !production_date || !expiration_date) {
    return res.status(400).json({
      success: false,
      message: 'Barcode, Name, Type, Company, and Dates are required.'
    });
  }

  const pool = getPool();
  try {
    await pool.execute(`
      INSERT INTO drugs (
        BARCODE, NAME, TYPE, DOSE, CODE, COST_PRICE, SELLING_PRICE, 
        EXPIRY, COMPANY_NAME, PRODUCTION_DATE, EXPIRATION_DATE, PLACE, QUANTITY
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      barcode.trim(),
      name.trim(),
      type.trim(),
      (dose || '').trim(),
      (code || '').trim(),
      parseFloat(cost_price) || 0,
      parseFloat(selling_price) || 0,
      expiry || 'Available for use',
      company_name.trim(),
      production_date,
      expiration_date,
      (place || 'N-Right').trim(),
      parseInt(quantity, 10) || 0
    ]);

    const drugs = await fetchAllDrugs(pool);
    res.status(201).json({
      success: true,
      message: `Drug '${name}' registered successfully.`,
      data: drugs
    });
  } catch (err) {
    res.status(400).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * PUT /api/drugs/:barcode
 * Updates drug information
 */
router.put('/:barcode', authenticateToken, async (req, res) => {
  const {
    name, type, dose, code, cost_price, selling_price,
    expiry, company_name, production_date, expiration_date, place, quantity
  } = req.body;

  const pool = getPool();
  try {
    await pool.execute(`
      UPDATE drugs SET 
        NAME = ?, TYPE = ?, DOSE = ?, CODE = ?, COST_PRICE = ?, SELLING_PRICE = ?, 
        EXPIRY = ?, COMPANY_NAME = ?, PRODUCTION_DATE = ?, EXPIRATION_DATE = ?, 
        PLACE = ?, QUANTITY = ? 
      WHERE BARCODE = ?
    `, [
      name.trim(),
      type.trim(),
      (dose || '').trim(),
      (code || '').trim(),
      parseFloat(cost_price) || 0,
      parseFloat(selling_price) || 0,
      expiry || 'Available for use',
      company_name.trim(),
      production_date,
      expiration_date,
      (place || '').trim(),
      parseInt(quantity, 10) || 0,
      req.params.barcode
    ]);

    const drugs = await fetchAllDrugs(pool);
    res.json({
      success: true,
      message: `Drug '${name}' updated successfully.`,
      data: drugs
    });
  } catch (err) {
    res.status(400).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * PUT /api/drugs/:barcode/price
 * Updates cost price and selling price
 */
router.put('/:barcode/price', authenticateToken, async (req, res) => {
  const { cost_price, selling_price } = req.body;

  if (cost_price === undefined || selling_price === undefined) {
    return res.status(400).json({ success: false, message: 'Cost Price and Selling Price are required.' });
  }

  const pool = getPool();
  try {
    await pool.execute(`
      UPDATE drugs SET COST_PRICE = ?, SELLING_PRICE = ? WHERE BARCODE = ?
    `, [parseFloat(cost_price) || 0, parseFloat(selling_price) || 0, req.params.barcode]);

    const drugs = await fetchAllDrugs(pool);
    res.json({
      success: true,
      message: 'Prices updated successfully.',
      data: drugs
    });
  } catch (err) {
    res.status(400).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * PUT /api/drugs/:barcode/validity
 * Renews expiration date and production date
 */
router.put('/:barcode/validity', authenticateToken, async (req, res) => {
  const { production_date, expiration_date, expiry } = req.body;

  if (!production_date || !expiration_date) {
    return res.status(400).json({ success: false, message: 'Production and Expiration dates are required.' });
  }

  const pool = getPool();
  try {
    await pool.execute(`
      UPDATE drugs SET PRODUCTION_DATE = ?, EXPIRATION_DATE = ?, EXPIRY = ? WHERE BARCODE = ?
    `, [production_date, expiration_date, expiry || 'Available for use', req.params.barcode]);

    const drugs = await fetchAllDrugs(pool);
    res.json({
      success: true,
      message: 'Drug validity renewed successfully.',
      data: drugs
    });
  } catch (err) {
    res.status(400).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * PUT /api/drugs/:barcode/move
 * Updates shelf location / place
 */
router.put('/:barcode/move', authenticateToken, async (req, res) => {
  const { place } = req.body;

  if (!place || !place.trim()) {
    return res.status(400).json({ success: false, message: 'Place / Shelf location is required.' });
  }

  const pool = getPool();
  try {
    await pool.execute(`
      UPDATE drugs SET PLACE = ? WHERE BARCODE = ?
    `, [place.trim(), req.params.barcode]);

    const drugs = await fetchAllDrugs(pool);
    res.json({
      success: true,
      message: `Drug location changed to '${place.trim()}'.`,
      data: drugs
    });
  } catch (err) {
    res.status(400).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * DELETE /api/drugs/:barcode
 * Deletes a drug from inventory
 */
router.delete('/:barcode', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    await pool.execute('DELETE FROM drugs WHERE BARCODE = ?', [req.params.barcode]);
    const drugs = await fetchAllDrugs(pool);
    res.json({
      success: true,
      message: 'Drug deleted successfully.',
      data: drugs
    });
  } catch (err) {
    res.status(400).json({ success: false, message: mapDbError(err) });
  }
});

module.exports = router;
