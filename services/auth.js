// Auth middleware - Supabase JWT verification
// Stage 2: Multi-tenant authentication using Supabase Auth JWT

const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = {
      id: user.sub,
      email: user.email,
      role: user.role,
      org_id: user.org_id || user.organization_id,
    };
    next();
  });
}

module.exports = { authenticateToken };
