const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/secureField');

// Singleton: the product owner's payment-collection configuration. Sensitive
// values are encrypted at rest (AES-256-GCM) and the gateway secret is never
// returned to any client. Schools see the enabled methods on their Billing page.
const platformSettingsSchema = new mongoose.Schema({
  key: { type: String, default: 'platform', unique: true },   // singleton guard
  gateway: {
    enabled: { type: Boolean, default: false },
    provider: { type: String, default: 'razorpay' },
    keyId: { type: String },        // encrypted
    keySecret: { type: String },    // encrypted, never exposed
  },
  bankTransfer: {
    enabled: { type: Boolean, default: false },
    accountName: String, accountNumber: String, ifsc: String, bankName: String, branch: String,  // encrypted
  },
  upi: {
    enabled: { type: Boolean, default: false },
    upiId: String, payeeName: String,   // encrypted
  },
  note: { type: String },
}, { timestamps: true });

// Sensitive string paths that are encrypted at rest.
const SENSITIVE = [
  ['gateway', 'keyId'], ['gateway', 'keySecret'],
  ['bankTransfer', 'accountName'], ['bankTransfer', 'accountNumber'], ['bankTransfer', 'ifsc'], ['bankTransfer', 'bankName'], ['bankTransfer', 'branch'],
  ['upi', 'upiId'], ['upi', 'payeeName'],
];

platformSettingsSchema.pre('save', function () {
  for (const [a, b] of SENSITIVE) {
    if (this[a] && this[a][b]) this[a][b] = encrypt(this[a][b]);   // encrypt() is idempotent
  }
});

// Decrypted gateway keys for internal use (Razorpay order/verify).
platformSettingsSchema.methods.gatewayKeys = function () {
  const keyId = decrypt(this.gateway?.keyId) || process.env.RAZORPAY_KEY_ID || '';
  const keySecret = decrypt(this.gateway?.keySecret) || process.env.RAZORPAY_KEY_SECRET || '';
  // Online payment is usable only when BOTH keys actually resolve (from the
  // super-admin settings or, more commonly, the .env). Keys present ⇒ enabled —
  // so the Billing page never offers a gateway that create-order would reject.
  const enabled = !!keyId && !!keySecret;
  return { enabled, keyId, keySecret };
};

// Super-admin editing view — decrypted, but WITHOUT the secret (only a hasSecret flag).
platformSettingsSchema.methods.adminView = function () {
  return {
    gateway: { enabled: !!this.gateway?.enabled, keyId: decrypt(this.gateway?.keyId) || '', hasSecret: !!this.gateway?.keySecret },
    bankTransfer: {
      enabled: !!this.bankTransfer?.enabled,
      accountName: decrypt(this.bankTransfer?.accountName) || '', accountNumber: decrypt(this.bankTransfer?.accountNumber) || '',
      ifsc: decrypt(this.bankTransfer?.ifsc) || '', bankName: decrypt(this.bankTransfer?.bankName) || '', branch: decrypt(this.bankTransfer?.branch) || '',
    },
    upi: { enabled: !!this.upi?.enabled, upiId: decrypt(this.upi?.upiId) || '', payeeName: decrypt(this.upi?.payeeName) || '' },
    note: this.note || '',
  };
};

// School-facing methods — decrypted bank/UPI for display, never the gateway secret.
platformSettingsSchema.methods.schoolMethods = function () {
  return {
    gateway: { enabled: this.gatewayKeys().enabled },
    bankTransfer: this.bankTransfer?.enabled
      ? { enabled: true, accountName: decrypt(this.bankTransfer.accountName), accountNumber: decrypt(this.bankTransfer.accountNumber), ifsc: decrypt(this.bankTransfer.ifsc), bankName: decrypt(this.bankTransfer.bankName), branch: decrypt(this.bankTransfer.branch) }
      : { enabled: false },
    upi: this.upi?.enabled ? { enabled: true, upiId: decrypt(this.upi.upiId), payeeName: decrypt(this.upi.payeeName) } : { enabled: false },
    note: this.note || '',
  };
};

platformSettingsSchema.statics.get = async function () {
  return (await this.findOne({ key: 'platform' })) || (await this.create({ key: 'platform' }));
};

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);
