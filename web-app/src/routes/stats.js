const express = require('express');
const router = express.Router();
const { getPool, mapDbError } = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/stats/summary
 * Retrieves live metrics for the dashboard cards and badges
 */
router.get('/summary', authenticateToken, async (req, res) => {
  const pool = getPool();
  try {
    // 1. Total drugs
    const [drugsCount] = await pool.execute('SELECT COUNT(*) AS total FROM drugs');

    // 2. Expired or expiring within 30 days
    const [expiredCount] = await pool.execute(`
      SELECT COUNT(*) AS total 
      FROM drugs 
      WHERE EXPIRATION_DATE <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
    `);

    // 3. Almost finish / low stock (QUANTITY <= 10)
    const [lowStockCount] = await pool.execute(`
      SELECT COUNT(*) AS total 
      FROM drugs 
      WHERE QUANTITY <= 10
    `);

    // 4. Companies count
    const [companiesCount] = await pool.execute('SELECT COUNT(*) AS total FROM company');

    // 5. Total users count
    const [usersCount] = await pool.execute('SELECT COUNT(*) AS total FROM users');

    // 6. Messages count for current user
    const [msgCount] = await pool.execute(`
      SELECT COUNT(*) AS total 
      FROM inbox 
      WHERE MESSAGE_TO = ? OR MESSAGE_TO = 'Public' OR MESSAGE_TO = 'All' OR ? = 'admin'
    `, [req.user.name, req.user.name]);

    // 7. Today's sales total
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const todayStr = `${day}-${month}-${year}`;

    const [salesSum] = await pool.execute(`
      SELECT COALESCE(SUM(AMOUNT), 0) AS totalRevenue, COUNT(*) AS totalTransactions 
      FROM history_sales 
      WHERE DATE = ?
    `, [todayStr]);

    res.json({
      success: true,
      stats: {
        totalDrugs: drugsCount[0].total,
        expiredDrugs: expiredCount[0].total,
        almostFinished: lowStockCount[0].total,
        totalCompanies: companiesCount[0].total,
        totalUsers: usersCount[0].total,
        inboxCount: msgCount[0].total,
        todaySales: parseFloat(salesSum[0].totalRevenue || 0),
        todayTransactions: salesSum[0].totalTransactions || 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: mapDbError(err) });
  }
});

module.exports = router;
