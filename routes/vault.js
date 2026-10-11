import express from 'express';
import db from '../db.js';
import { encrypt, decrypt } from '../encryption.js';
import { addLog } from '../logger.js';
import { requireLogin } from '../middleware.js';

const router = express.Router();
router.use(requireLogin);

const TYPES = ['password', 'note', 'apikey', 'file'];
const MAX_SIZE = 1400000; // about 1 MB file after base64

// checks the data coming from the user
function checkInput(body) {
  if (!TYPES.includes(body.type)) return 'Invalid type';
  if (!body.title || !body.title.trim()) return 'Title is required';
  if (!body.secret) return 'Secret value is required';
  if (body.secret.length > MAX_SIZE) return 'Too big (max 1 MB)';
  return null;
}

// list - no secret values here, only titles
router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT id, type, title, extra, created_at FROM secrets WHERE user_id = ? ORDER BY id DESC')
    .all(req.user.id);
  res.json(rows);
});

// view one secret - decrypts it
router.get('/:id', (req, res) => {
  // user_id in the query means nobody can open someone else's secret
  const row = db.prepare('SELECT * FROM secrets WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const secret = decrypt(row.ciphertext, row.iv, row.auth_tag, req.session.key);
    addLog(req.user.id, req.user.email, `VIEWED secret "${row.title}"`, req);
    res.json({ id: row.id, type: row.type, title: row.title, extra: row.extra, secret });
  } catch (err) {
    res.status(500).json({ error: 'Could not decrypt this secret' });
  }
});

// add
router.post('/', (req, res) => {
  const problem = checkInput(req.body);
  if (problem) {
    return res.status(400).json({ error: problem });
  }

  const { type, title, extra, secret } = req.body;
  const enc = encrypt(secret, req.session.key);

  db.prepare('INSERT INTO secrets (user_id, type, title, extra, ciphertext, iv, auth_tag) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(req.user.id, type, title.trim(), extra || '', enc.ciphertext, enc.iv, enc.authTag);

  addLog(req.user.id, req.user.email, `ADDED secret "${title.trim()}"`, req);
  res.json({ message: 'Saved' });
});

// edit
router.put('/:id', (req, res) => {
  const problem = checkInput(req.body);
  if (problem) {
    return res.status(400).json({ error: problem });
  }

  const { type, title, extra, secret } = req.body;
  const enc = encrypt(secret, req.session.key);

  const result = db
    .prepare('UPDATE secrets SET type = ?, title = ?, extra = ?, ciphertext = ?, iv = ?, auth_tag = ? WHERE id = ? AND user_id = ?')
    .run(type, title.trim(), extra || '', enc.ciphertext, enc.iv, enc.authTag, req.params.id, req.user.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Not found' });
  }

  addLog(req.user.id, req.user.email, `EDITED secret "${title.trim()}"`, req);
  res.json({ message: 'Updated' });
});

// delete
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM secrets WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Not found' });
  }

  addLog(req.user.id, req.user.email, `DELETED secret #${req.params.id}`, req);
  res.json({ message: 'Deleted' });
});

export default router;
