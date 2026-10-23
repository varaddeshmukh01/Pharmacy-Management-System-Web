const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getPool, mapDbError } = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/**
 * Helper to fetch all users (omitting password hash)
 */
async function fetchAllUsers(pool) {
  const [rows] = await pool.execute(`
    SELECT ID, NAME, DOB, ADDRESS, PHONE, SALARY, 
           CASE WHEN ID = 1 THEN 'Admin' ELSE 'Employee' END AS ROLE
    FROM users 
    ORDER BY ID ASC
  `);
  return rows;
}

/**
 * GET /api/users
 * Retrieves user list
 */
router.get('/', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    const users = await fetchAllUsers(pool);
    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * POST /api/users
 * Creates a new user/employee (Admin only)
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { id, name, dob, address, phone, salary, password } = req.body;

  if (!name || !password || !address || !phone) {
    return res.status(400).json({
      success: false,
      message: 'Name, Password, Address, and Phone are required.'
    });
  }

  const pool = getPool();
  try {
    let userId = parseInt(id, 10);
    if (!userId || isNaN(userId)) {
      // Find max ID + 1
      const [maxRow] = await pool.execute('SELECT COALESCE(MAX(ID), 0) + 1 AS nextId FROM users');
      userId = maxRow[0].nextId;
    }

    const hashed = await bcrypt.hash(password, 10);
    const sal = parseFloat(salary) || 0;

    await pool.execute(`
      INSERT INTO users (ID, NAME, DOB, ADDRESS, PHONE, SALARY, PASSWORD) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      name.trim(),
      (dob || '01-01-2000').trim(),
      address.trim(),
      phone.trim(),
      sal,
      hashed
    ]);

    const users = await fetchAllUsers(pool);
    res.status(201).json({
      success: true,
      message: `User '${name}' (ID: ${userId}) created successfully.`,
      data: users
    });
  } catch (err) {
    res.status(400).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * PUT /api/users/:id
 * Updates an existing user
 */
router.put('/:id', authenticateToken, async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const { name, dob, address, phone, salary, password } = req.body;

  // Non-admins can only update their own profile
  if (req.user.role !== 'Admin' && req.user.id !== targetId) {
    return res.status(403).json({
      success: false,
      message: 'You can only update your own profile.'
    });
  }

  const pool = getPool();
  try {
    let updateSql = 'UPDATE users SET NAME = ?, DOB = ?, ADDRESS = ?, PHONE = ?, SALARY = ?';
    let params = [
      name.trim(),
      (dob || '').trim(),
      address.trim(),
      phone.trim(),
      parseFloat(salary) || 0
    ];

    if (password && password.trim().length >= 6) {
      const hashed = await bcrypt.hash(password.trim(), 10);
      updateSql += ', PASSWORD = ?';
      params.push(hashed);
    }

    updateSql += ' WHERE ID = ?';
    params.push(targetId);

    await pool.execute(updateSql, params);

    const users = await fetchAllUsers(pool);
    res.json({
      success: true,
      message: `User profile updated successfully.`,
      data: users
    });
  } catch (err) {
    res.status(400).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * DELETE /api/users/:id
 * Deletes a user (Admin only, cannot delete ID 1)
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const targetId = parseInt(req.params.id, 10);

  if (targetId === 1) {
    return res.status(400).json({
      success: false,
      message: 'The primary system Administrator account (ID: 1) cannot be deleted.'
    });
  }

  const pool = getPool();
  try {
    await pool.execute('DELETE FROM users WHERE ID = ?', [targetId]);
    const users = await fetchAllUsers(pool);
    res.json({
      success: true,
      message: `User (ID: ${targetId}) deleted successfully.`,
      data: users
    });
  } catch (err) {
    res.status(400).json({ success: false, message: mapDbError(err) });
  }
});

module.exports = router;
