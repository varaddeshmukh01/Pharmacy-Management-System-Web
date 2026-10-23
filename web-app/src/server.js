const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { initializeDatabase } = require('./db');

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/companies', require('./routes/companies'));
app.use('/api/drugs', require('./routes/drugs'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/users', require('./routes/users'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/stats', require('./routes/stats'));

// SPA Fallback: send index.html for any unhandled routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start Server after Database Check
async function start() {
  const dbOk = await initializeDatabase();

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('============================================================');
    console.log(`🚀 [Server] Pharmacy Management System Web App is RUNNING!`);
    console.log(`🌐 Local URL:  http://localhost:${PORT}`);
    console.log(`🌐 Network:    http://127.0.0.1:${PORT}`);
    if (dbOk) {
      console.log(`📊 Database:   CONNECTED & SYNCHRONIZED with MySQL Workbench`);
    } else {
      console.log(`⚠️ Database:   CHECK FAILED - Please verify .env password!`);
    }
    console.log('============================================================\n');
  });

  return server;
}

if (require.main === module) {
  start();
}

module.exports = { app, start };
