const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'techblock_super_secret_jwt_key_2026_x89!#q';

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Access token missing or invalid format. Please include "Authorization: Bearer <token>"'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Invalid or expired token. Please log in again.'
    });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }
    if (req.user.role !== role && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden', message: `Requires ${role} permission level` });
    }
    next();
  };
}

module.exports = {
  verifyToken,
  requireRole,
  JWT_SECRET
};
