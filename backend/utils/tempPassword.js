const crypto = require('crypto');

// Readable temp password e.g. "k7m2-q9xp" (lowercase letters + digits, no
// ambiguous chars), easy to read aloud / copy. Shared by the staff-login and
// app-login creation flows.
const genTempPassword = () => {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const pick = (n) => Array.from({ length: n }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
  return `${pick(4)}-${pick(4)}`;
};

module.exports = { genTempPassword };
