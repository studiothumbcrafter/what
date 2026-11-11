// Auth middleware - JWT verification
// Stage 2: Multi-tenant authentication using Supabase Auth JWT
// Stage 5: one secret resolution for Supabase tokens and legacy owner login

const jwt = require('jsonwebtoken');

const DEV_SECRET = 'smartrent-secret-change-me';

function getJwtSecret() {
  return process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || DEV_SECRET;
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  jwt.verify(token, getJwtSecret(), (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = {
      id: user.sub || user.id || null,
      username: user.username || null,
      email: user.email || null,
      role: user.role,
      org_id: user.org_id || user.organization_id || null,
    };
    next();
  });
}

module.exports = { authenticateToken, getJwtSecret };
