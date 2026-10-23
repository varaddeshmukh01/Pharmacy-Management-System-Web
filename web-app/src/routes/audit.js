const express = require('express');
const router = express.Router();
const { getPool, mapDbError } = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/audit/logins
 * Retrieves user login session audit records
 */
router.get('/logins', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    const [rows] = await pool.execute(`
      SELECT ID, NAME, TYPE, DATE, TIME 
      FROM login 
      ORDER BY ID DESC LIMIT 500
    `);

    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: mapDbError(err) });
  }
});

module.exports = router;
