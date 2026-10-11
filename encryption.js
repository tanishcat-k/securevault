import crypto from 'crypto';

// random salt, stored in the users table (separate from the bcrypt salt)
export function makeSalt() {
  return crypto.randomBytes(16).toString('hex');
}

// master password + salt -> 32 byte key (AES-256 needs a 32 byte key)
export function deriveKey(masterPassword, saltHex) {
  const key = crypto.scryptSync(masterPassword, Buffer.from(saltHex, 'hex'), 32);
  return key.toString('hex');
}

export function encrypt(plainText, keyHex) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);

  return {
    ciphertext: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex')
  };
}

export function decrypt(ciphertext, ivHex, authTagHex, keyHex) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}
