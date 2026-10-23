const express = require('express');
const router = express.Router();
const { getPool, mapDbError } = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/companies
 * Retrieves all companies sorted alphabetically
 */
router.get('/', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    const search = req.query.search ? `%${req.query.search.trim()}%` : null;
    let query = 'SELECT NAME, ADDRESS, PHONE FROM company';
    let params = [];

    if (search) {
      query += ' WHERE NAME LIKE ? OR ADDRESS LIKE ? OR PHONE LIKE ?';
      params = [search, search, search];
    }
    query += ' ORDER BY NAME ASC';

    const [rows] = await pool.execute(query, params);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * GET /api/companies/:name
 * Retrieves single company details
 */
router.get('/:name', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    const [rows] = await pool.execute(
      'SELECT NAME, ADDRESS, PHONE FROM company WHERE NAME = ?',
      [req.params.name]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Company not found.' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * POST /api/companies
 * Adds a new pharmaceutical company/supplier
 */
router.post('/', authenticateToken, async (req, res) => {
  const { name, address, phone } = req.body;

  if (!name || !address || !phone) {
    return res.status(400).json({
      success: false,
      message: 'Name, Address, and Phone are all required.'
    });
  }

  const pool = getPool();
  try {
    await pool.execute(
      'INSERT INTO company (NAME, ADDRESS, PHONE) VALUES (?, ?, ?)',
      [name.trim(), address.trim(), phone.trim()]
    );

    const [all] = await pool.execute('SELECT NAME, ADDRESS, PHONE FROM company ORDER BY NAME ASC');
    res.status(201).json({
      success: true,
      message: `Company '${name}' added successfully.`,
      data: all
    });
  } catch (err) {
    res.status(400).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * PUT /api/companies/:name
 * Updates an existing company
 */
router.put('/:name', authenticateToken, async (req, res) => {
  const { address, phone, newName } = req.body;
  const targetName = req.params.name;

  if (!address || !phone) {
    return res.status(400).json({
      success: false,
      message: 'Address and Phone are required.'
    });
  }

  const pool = getPool();
  try {
    if (newName && newName.trim() !== targetName) {
      // Name changed, update name and cascade
      await pool.execute(
        'UPDATE company SET NAME = ?, ADDRESS = ?, PHONE = ? WHERE NAME = ?',
        [newName.trim(), address.trim(), phone.trim(), targetName]
      );
    } else {
      await pool.execute(
        'UPDATE company SET ADDRESS = ?, PHONE = ? WHERE NAME = ?',
        [address.trim(), phone.trim(), targetName]
      );
    }

    const [all] = await pool.execute('SELECT NAME, ADDRESS, PHONE FROM company ORDER BY NAME ASC');
    res.json({
      success: true,
      message: `Company updated successfully.`,
      data: all
    });
  } catch (err) {
    res.status(400).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * DELETE /api/companies/:name
 * Deletes a company
 */
router.delete('/:name', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    await pool.execute('DELETE FROM company WHERE NAME = ?', [req.params.name]);
    const [all] = await pool.execute('SELECT NAME, ADDRESS, PHONE FROM company ORDER BY NAME ASC');
    res.json({
      success: true,
      message: `Company '${req.params.name}' deleted successfully.`,
      data: all
    });
  } catch (err) {
    res.status(400).json({ success: false, message: mapDbError(err) });
  }
});

module.exports = router;
