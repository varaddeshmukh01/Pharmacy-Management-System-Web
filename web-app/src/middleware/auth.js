const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'pharmacy_mgmt_jwt_secret_key_2026';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired session. Please log in again.' });
    }
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  if (req.user.role === 'Admin' || req.user.id === 1 || String(req.user.id) === '1') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access Denied: Administrator privileges required for this action.'
  });
}

module.exports = {
  authenticateToken,
  requireAdmin,
  JWT_SECRET
};
