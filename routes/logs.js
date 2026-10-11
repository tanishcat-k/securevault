import express from 'express';
import db from '../db.js';
import { requireLogin } from '../middleware.js';

const router = express.Router();

// a normal user only sees their own activity
router.get('/', requireLogin, (req, res) => {
  const logs = db.prepare('SELECT * FROM logs WHERE user_id = ? ORDER BY id DESC LIMIT 100').all(req.user.id);
  res.json(logs);
});

export default router;
