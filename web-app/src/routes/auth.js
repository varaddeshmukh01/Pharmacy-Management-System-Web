const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool, mapDbError } = require('../db');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

/**
 * Format today's date (DD-MM-YYYY) and current time (HH:MM:SS)
 */
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
 * POST /api/auth/login
 * Authenticates user by ID or Username and Password.
 * Supports legacy plain passwords and auto-upgrades them to bcrypt hashes.
 */
router.post('/login', async (req, res) => {
  const { id, password } = req.body;

  if (!id || !password) {
    return res.status(400).json({ success: false, message: 'Please enter User ID / Username and Password.' });
  }

  const pool = getPool();
  try {
    // Search user by ID or NAME
    const [rows] = await pool.execute(
      'SELECT ID, NAME, PASSWORD, DOB, ADDRESS, PHONE, SALARY FROM users WHERE ID = ? OR NAME = ?',
      [id, id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found. Please check your ID.' });
    }

    const user = rows[0];
    const isBcrypt = user.PASSWORD && (user.PASSWORD.startsWith('$2a$') || user.PASSWORD.startsWith('$2b$'));
    let isMatch = false;

    if (isBcrypt) {
      isMatch = await bcrypt.compare(password, user.PASSWORD);
    } else {
      isMatch = user.PASSWORD === password;
      // Auto-upgrade legacy plain text password to bcrypt
      if (isMatch) {
        try {
          const newHash = await bcrypt.hash(password, 10);
          await pool.execute('UPDATE users SET PASSWORD = ? WHERE ID = ?', [newHash, user.ID]);
        } catch (_) {}
      }
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Wrong password. Please try again.' });
    }

    // Determine Role: ID 1 is Admin, others are Employee (matching Java desktop app)
    const role = (user.ID === 1 || String(user.ID) === '1') ? 'Admin' : 'Employee';

    // Record login in `login` audit table
    const { date, time } = getNowFormatted();
    try {
      await pool.execute(
        'INSERT INTO login (NAME, TYPE, DATE, TIME) VALUES (?, ?, ?, ?)',
        [user.NAME, role, date, time]
      );
    } catch (auditErr) {
      console.error('Failed to log session audit:', auditErr.message);
    }

    // Generate JWT
    const payload = {
      id: user.ID,
      name: user.NAME,
      role: role
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.ID,
        name: user.NAME,
        role: role,
        address: user.ADDRESS,
        phone: user.PHONE
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * GET /api/auth/me
 * Retrieves authenticated user session profile
 */
router.get('/me', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    const [rows] = await pool.execute(
      'SELECT ID, NAME, DOB, ADDRESS, PHONE, SALARY FROM users WHERE ID = ?',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({
      success: true,
      user: {
        ...rows[0],
        role: req.user.role
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * POST /api/auth/change-password
 * Changes the current logged-in user's password
 */
router.post('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 6 characters.'
    });
  }

  const pool = getPool();
  try {
    const [rows] = await pool.execute('SELECT PASSWORD FROM users WHERE ID = ?', [req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const currentHash = rows[0].PASSWORD;
    const isBcrypt = currentHash && (currentHash.startsWith('$2a$') || currentHash.startsWith('$2b$'));
    let matchesCurrent = false;

    if (isBcrypt) {
      matchesCurrent = await bcrypt.compare(currentPassword, currentHash);
    } else {
      matchesCurrent = currentHash === currentPassword;
    }

    if (!matchesCurrent) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.execute('UPDATE users SET PASSWORD = ? WHERE ID = ?', [hashed, req.user.id]);

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: mapDbError(err) });
  }
});

module.exports = router;
