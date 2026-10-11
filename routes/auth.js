import express from 'express';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import otplib from 'otplib';
import db from '../db.js';
import { makeSalt, deriveKey } from '../encryption.js';
import { addLog } from '../logger.js';
import { requireLogin } from '../middleware.js';

const { authenticator } = otplib;
authenticator.options = { window: 1 }; // accept the code from 30 seconds before/after

const router = express.Router();

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

// gives the user a fresh session id after login (stops session fixation)
function newSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

// counts a wrong password / wrong OTP and locks the account after 5 tries
function wrongAttempt(user, req) {
  const attempts = user.failed_attempts + 1;

  if (attempts >= MAX_ATTEMPTS) {
    const lockedUntil = Date.now() + LOCK_MINUTES * 60 * 1000;
    db.prepare('UPDATE users SET failed_attempts = 0, locked_until = ? WHERE id = ?').run(lockedUntil, user.id);
    addLog(user.id, user.email, 'ACCOUNT LOCKED (too many wrong attempts)', req);
    return;
  }

  db.prepare('UPDATE users SET failed_attempts = ? WHERE id = ?').run(attempts, user.id);
}

// ---------- register ----------
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email' });
  }
  if (password.length < 10) {
    return res.status(400).json({ error: 'Master password must be at least 10 characters' });
  }

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (exists) {
    return res.status(409).json({ error: 'This email is already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const keySalt = makeSalt();
  const totpSecret = authenticator.generateSecret();

  // the very first account becomes the admin, everyone else is a normal user
  const count = db.prepare('SELECT COUNT(*) AS total FROM users').get().total;
  const role = count === 0 ? 'admin' : 'user';

  const result = db
    .prepare('INSERT INTO users (name, email, password_hash, key_salt, totp_secret, role) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name.trim(), email.toLowerCase(), passwordHash, keySalt, totpSecret, role);

  addLog(result.lastInsertRowid, email.toLowerCase(), 'REGISTERED', req);
  res.json({ message: 'Account created' });
});

// ---------- login step 1: email + master password ----------
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Enter email and password' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Wrong email or password' });
  }

  if (user.locked_until > Date.now()) {
    addLog(user.id, user.email, 'LOGIN BLOCKED (account locked)', req);
    return res.status(423).json({ error: 'Account is locked. Try again later or ask the admin.' });
  }

  const correct = await bcrypt.compare(password, user.password_hash);
  if (!correct) {
    wrongAttempt(user, req);
    addLog(user.id, user.email, 'LOGIN FAILED (wrong password)', req);
    return res.status(401).json({ error: 'Wrong email or password' });
  }

  // password is correct, but the user is not fully logged in until the OTP is checked
  // the encryption key is made from the master password and kept only in the server session
  req.session.pendingUserId = user.id;
  req.session.pendingKey = deriveKey(password, user.key_salt);

  // first login: show the QR code so the user can set up the authenticator app
  if (!user.totp_enabled) {
    const otpUrl = authenticator.keyuri(user.email, 'SecureVault', user.totp_secret);
    const qr = await QRCode.toDataURL(otpUrl);
    return res.json({ step: 'otp', qr, secret: user.totp_secret });
  }

  res.json({ step: 'otp' });
});

// ---------- login step 2: OTP ----------
router.post('/otp', async (req, res) => {
  const userId = req.session.pendingUserId;
  const key = req.session.pendingKey;
  if (!userId) {
    return res.status(401).json({ error: 'Log in with your password first' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const code = String(req.body.code || '').trim();

  if (user.locked_until > Date.now()) {
    return res.status(423).json({ error: 'Account is locked. Try again later or ask the admin.' });
  }

  if (!authenticator.check(code, user.totp_secret)) {
    wrongAttempt(user, req);
    addLog(user.id, user.email, 'LOGIN FAILED (wrong OTP)', req);
    return res.status(401).json({ error: 'Wrong code' });
  }

  db.prepare('UPDATE users SET totp_enabled = 1, failed_attempts = 0, locked_until = 0 WHERE id = ?').run(user.id);

  await newSession(req);
  req.session.userId = user.id;
  req.session.key = key;

  addLog(user.id, user.email, 'LOGIN SUCCESS', req);
  res.json({ message: 'Logged in', role: user.role });
});

// ---------- who am I ----------
router.get('/me', requireLogin, (req, res) => {
  res.json(req.user);
});

// ---------- logout ----------
router.post('/logout', (req, res) => {
  const userId = req.session.userId;

  if (userId) {
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
    const action = req.body.reason === 'timeout' ? 'AUTO LOGOUT (idle)' : 'LOGOUT';
    addLog(userId, user ? user.email : null, action, req);
  }

  req.session.destroy(() => {
    res.clearCookie('sv.sid');
    res.json({ message: 'Logged out' });
  });
});

export default router;
