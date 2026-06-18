const crypto = require('crypto');

// AES-256-GCM field encryption for sensitive settings (payment-collection details,
// gateway secrets). The key is derived from ENCRYPTION_KEY (preferred) or JWT_SECRET.
// Values are stored as "enc:v1:<base64(iv|tag|ciphertext)>".
const RAW_KEY = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
if (!RAW_KEY) console.warn('⚠️ No ENCRYPTION_KEY/JWT_SECRET set — sensitive fields use a weak fallback key.');
const KEY = crypto.createHash('sha256').update(String(RAW_KEY || 'insecure-dev-fallback-key')).digest(); // 32 bytes
const PREFIX = 'enc:v1:';

const isEncrypted = (v) => typeof v === 'string' && v.startsWith(PREFIX);

const encrypt = (plain) => {
  if (plain == null || plain === '') return plain;
  if (isEncrypted(plain)) return plain;                 // idempotent
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
};

const decrypt = (value) => {
  if (value == null || value === '') return value;
  if (!isEncrypted(value)) return value;                // tolerate legacy plaintext
  try {
    const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
    const iv = raw.subarray(0, 12), tag = raw.subarray(12, 28), ct = raw.subarray(28);
    const d = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
  } catch { return ''; }
};

module.exports = { encrypt, decrypt, isEncrypted };
