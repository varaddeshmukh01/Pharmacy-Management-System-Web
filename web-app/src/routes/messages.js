const express = require('express');
const router = express.Router();
const { getPool, mapDbError } = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/messages/inbox
 * Retrieves messages addressed to the current user or 'Public' / 'All'
 */
router.get('/inbox', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    const currentName = req.user.name;
    const [rows] = await pool.execute(`
      SELECT ID, MESSAGE_FROM, MESSAGE_TO, MESSAGE_TEXT 
      FROM inbox 
      WHERE MESSAGE_TO = ? OR MESSAGE_TO = 'Public' OR MESSAGE_TO = 'All' OR ? = 'admin'
      ORDER BY ID DESC
    `, [currentName, currentName]);

    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * POST /api/messages/send
 * Sends a message to a recipient, records in both inbox and message_history
 */
router.post('/send', authenticateToken, async (req, res) => {
  const { to, text } = req.body;
  const from = req.user.name;

  if (!to || !text || !text.trim()) {
    return res.status(400).json({ success: false, message: 'Recipient and message text are required.' });
  }

  const pool = getPool();
  try {
    // Insert into inbox
    await pool.execute(
      'INSERT INTO inbox (MESSAGE_FROM, MESSAGE_TO, MESSAGE_TEXT) VALUES (?, ?, ?)',
      [from, to.trim(), text.trim()]
    );

    // Insert into message_history
    try {
      await pool.execute(
        'INSERT INTO message_history (MESSAGE_FROM, MESSAGE_TO, MESSAGE_TEXT) VALUES (?, ?, ?)',
        [from, to.trim(), text.trim()]
      );
    } catch (_) {}

    res.status(201).json({ success: true, message: 'Message sent successfully.' });
  } catch (err) {
    res.status(400).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * DELETE /api/messages/inbox/:id
 * Deletes a message from inbox
 */
router.delete('/inbox/:id', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    await pool.execute('DELETE FROM inbox WHERE ID = ?', [req.params.id]);
    res.json({ success: true, message: 'Message removed from inbox.' });
  } catch (err) {
    res.status(400).json({ success: false, message: mapDbError(err) });
  }
});

/**
 * GET /api/messages/history
 * Retrieves outgoing sent message history
 */
router.get('/history', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    const [rows] = await pool.execute(`
      SELECT ID, MESSAGE_FROM, MESSAGE_TO, MESSAGE_TEXT 
      FROM message_history 
      ORDER BY ID DESC LIMIT 200
    `);

    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: mapDbError(err) });
  }
});

module.exports = router;
