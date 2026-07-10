// Character-mapping (substitution) cipher for appointment notes.
// NOTE: This is a reversible substitution cipher, not cryptographically
// secure encryption — it obscures data at rest but provides no real
// confidentiality against a determined attacker.

const encryptionMap = {
  A: 'M', B: 'N', C: 'O', D: 'P', E: 'Q',
  F: 'R', G: 'S', H: 'T', I: 'U', J: 'V',
  K: 'W', L: 'X', M: 'Y', N: 'Z', O: 'A',
  P: 'B', Q: 'C', R: 'D', S: 'E', T: 'F',
  U: 'G', V: 'H', W: 'I', X: 'J', Y: 'K', Z: 'L',
  a: 'm', b: 'n', c: 'o', d: 'p', e: 'q',
  f: 'r', g: 's', h: 't', i: 'u', j: 'v',
  k: 'w', l: 'x', m: 'y', n: 'z', o: 'a',
  p: 'b', q: 'c', r: 'd', s: 'e', t: 'f',
  u: 'g', v: 'h', w: 'i', x: 'j', y: 'k', z: 'l',
};

// Reverse map for decryption
const decryptionMap = {};
for (const [key, value] of Object.entries(encryptionMap)) {
  decryptionMap[value] = key;
}

const { isPentestMode } = require('../config/security');

// PENTEST_MODE: store/return notes as plain text (no obfuscation at rest).
const encrypt = (text) => {
  if (!text) return text;
  if (isPentestMode()) return text;
  return String(text)
    .split('')
    .map((char) => encryptionMap[char] || char)
    .join('');
};

const decrypt = (text) => {
  if (!text) return text;
  if (isPentestMode()) return text;
  return String(text)
    .split('')
    .map((char) => decryptionMap[char] || char)
    .join('');
};

module.exports = { encrypt, decrypt };
