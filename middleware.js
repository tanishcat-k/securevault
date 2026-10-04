import db from './db.js';
import { addLog } from './logger.js';

// only logged in users can pass
export function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please log in first' });
  }

  // read the user from the database every time, so the role is always up to date
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: 'Please log in first' });
  }

  req.user = user;
  next();
}

// only admins can pass (RBAC)
export function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    addLog(req.user.id, req.user.email, 'BLOCKED admin page access', req);
    return res.status(403).json({ error: 'Admins only' });
  }
  next();
}
