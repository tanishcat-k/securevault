# SecureVault

A secure web based vault for passwords, secure notes, API keys and small files.
Made for the cybersecurity lab.

## How to run

You need Node.js 18 or newer.

```
npm install
npm start
```

Open http://localhost:3000 and click "Create a vault".

- The first account you register becomes the **admin**. Every other account is a normal **user**.
- On the first login a QR code is shown. Scan it with Google Authenticator (or any TOTP app), then type the 6 digit code.

## Folder structure

```
server.js          starts the app, sessions, security headers
db.js              SQLite database and tables
encryption.js      AES-256-GCM encrypt / decrypt and key making
logger.js          writes the security activity log
middleware.js      requireLogin and requireAdmin
routes/auth.js     register, login, OTP, logout
routes/vault.js    add, view, edit, delete secrets
routes/logs.js     activity log of the logged in user
routes/admin.js    admin only: users and all logs
public/            the website (html, css, js)
```

## The 5 security mechanisms

**1. AES-256 encryption** (`encryption.js`)
Every secret is encrypted with AES-256-GCM before it goes into the database. GCM also checks that the data was not changed. The database only has ciphertext, a random IV and an auth tag.
The key is made from the master password with scrypt and a random salt. The key is never saved in the database. It only lives in the server session while the user is logged in. So even if someone steals the database file, they cannot read the secrets.

**2. Password hashing** (`routes/auth.js`)
The master password is hashed with bcrypt (cost 12). The plain password is never stored.

**3. MFA / OTP** (`routes/auth.js`)
Login has two steps. Step 1 checks the password, step 2 checks a TOTP code (30 second codes, same as Google Authenticator). The user only gets a real session after both are correct.
After 5 wrong passwords or wrong codes the account is locked for 15 minutes.

**4. RBAC and authorization** (`middleware.js`)
Two roles: `user` and `admin`.
- `requireLogin` blocks anyone who is not logged in.
- `requireAdmin` blocks normal users from the admin routes (403).
- Every secret query has `user_id = ?`, so a user can never open another user's secret.
- The admin can manage users and see all logs, but cannot read anyone's secrets (they are encrypted with each user's own key).

**5. Session timeout and secure cookies** (`server.js`)
- Cookie is `httpOnly` (JavaScript cannot read it) and `sameSite: strict` (not sent from other sites, helps against CSRF).
- Session ends after 5 minutes without activity, and the website also shows a countdown and logs out by itself.
- The session id is changed after login (stops session fixation).
- Set `NODE_ENV=production` when using https, this turns on the `secure` cookie flag.

## Other features

- Password generator (uses `crypto.getRandomValues`, not `Math.random`)
- Search and filter by type
- Security activity log (login, failed login, lock, view/add/edit/delete, logout, auto logout)
- Copied passwords are removed from the clipboard after 30 seconds
- User text is always shown with `textContent` so it cannot inject HTML (XSS)
- All database queries use `?` placeholders (no SQL injection)

## Things to know

- If a user forgets the master password, the secrets cannot be recovered. That is the point of the encryption.
- Sessions are kept in memory, so restarting the server logs everyone out.
- Titles and usernames are saved as normal text so search works. Only the secret value is encrypted.
- To reset everything, stop the server and delete `securevault.db`.
