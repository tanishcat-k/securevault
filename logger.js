import db from './db.js';

// saves one line in the security activity log
export function addLog(userId, email, action, req) {
  db.prepare('INSERT INTO logs (user_id, email, action, ip) VALUES (?, ?, ?, ?)').run(userId, email, action, req.ip);
}
