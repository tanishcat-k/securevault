import Database from 'better-sqlite3';

const db = new Database('securevault.db');

// users table - the password is stored only as a bcrypt hash
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    key_salt TEXT NOT NULL,
    totp_secret TEXT NOT NULL,
    totp_enabled INTEGER DEFAULT 0,
    role TEXT DEFAULT 'user',
    failed_attempts INTEGER DEFAULT 0,
    locked_until INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// secrets table - the secret itself is only stored encrypted
db.exec(`
  CREATE TABLE IF NOT EXISTS secrets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    extra TEXT,
    ciphertext TEXT NOT NULL,
    iv TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// security activity log
db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    email TEXT,
    action TEXT NOT NULL,
    ip TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

export default db;
