const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' });
  }
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access restricted to roles: ${allowedRoles.join(', ')}`,
      });
    }
    next();
  };
}

const requireAdmin = requireRole('ADMIN');
const requireTeacherOrAdmin = requireRole('ADMIN', 'TEACHER');

module.exports = { authenticate, requireRole, requireAdmin, requireTeacherOrAdmin };
