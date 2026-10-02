import express from 'express';
import session from 'express-session';
import crypto from 'crypto';
import authRoutes from './routes/auth.js';
import vaultRoutes from './routes/vault.js';
import logRoutes from './routes/logs.js';
import adminRoutes from './routes/admin.js';

const app = express();
const PORT = 3000;

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

// basic security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:"
  );
  next();
});

// sessions are kept in server memory, so the encryption key never goes to the browser
app.use(
  session({
    name: 'sv.sid',
    secret: crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    rolling: true, // timer restarts on every request
    cookie: {
      httpOnly: true, // JavaScript cannot read the cookie
      sameSite: 'strict', // cookie is not sent from other websites
      secure: process.env.NODE_ENV === 'production', // true when using https
      maxAge: 5 * 60 * 1000 // session timeout: 5 minutes
    }
  })
);

app.use(express.static('public'));

app.use('/api/auth', authRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/admin', adminRoutes);

app.listen(PORT, () => {
  console.log(`SecureVault running on http://localhost:${PORT}`);
});
