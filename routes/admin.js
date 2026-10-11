import express from 'express';
import db from '../db.js';
import { addLog } from '../logger.js';
import { requireLogin, requireAdmin } from '../middleware.js';

const router = express.Router();
router.use(requireLogin, requireAdmin);

// all users (the admin can never see anyone's secrets, they are encrypted with each user's own key)
router.get('/users', (req, res) => {
  const users = db
    .prepare('SELECT id, name, email, role, failed_attempts, locked_until, created_at FROM users ORDER BY id')
    .all();
  res.json(users);
});

// unlock a locked account
router.post('/users/:id/unlock', (req, res) => {
  db.prepare('UPDATE users SET locked_until = 0, failed_attempts = 0 WHERE id = ?').run(req.params.id);
  addLog(req.user.id, req.user.email, `ADMIN unlocked user #${req.params.id}`, req);
  res.json({ message: 'Unlocked' });
});

// delete a user and their secrets
router.delete('/users/:id', (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete yourself' });
  }

  db.prepare('DELETE FROM secrets WHERE user_id = ?').run(req.params.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  addLog(req.user.id, req.user.email, `ADMIN deleted user #${req.params.id}`, req);
  res.json({ message: 'Deleted' });
});

// activity log of everyone
router.get('/logs', (req, res) => {
  const logs = db.prepare('SELECT * FROM logs ORDER BY id DESC LIMIT 200').all();
  res.json(logs);
});

export default router;
