/**
 * Input sanitization & validation middleware.
 *
 * Contract (same as middleware/security.js):
 *   - PENTEST_MODE=true  -> DISABLED (calls next()).
 *   - PENTEST_MODE=false -> ACTIVE and rejects/cleans malicious input.
 */
const xss = require('xss');
const validator = require('validator');
const { isPentestMode } = require('../config/security');

// Password fields must never be HTML-stripped or length-clamped the same way
// as normal text (special chars like < > are legitimate in passwords).
const PASSWORD_FIELDS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'confirmPassword',
]);

// 9. Per-field maximum lengths. Anything not listed uses DEFAULT_MAX.
const FIELD_MAX_LENGTH = {
  name: 50,
  email: 100,
};
const DEFAULT_MAX = 500; // all other text fields

// Detect any HTML tag (covers <script>, <img onerror=...>, etc.)
const HTML_TAG_REGEX = /<[^>]+>/;

// Walk every string field in an object, invoking `fn(key, value)`.
// `fn` may return a replacement string, or throw to abort.
const walkStrings = (obj, fn, depth = 0) => {
  if (depth > 20 || obj === null || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      if (typeof item === 'string') {
        obj[i] = fn(String(i), item);
      } else {
        walkStrings(item, fn, depth + 1);
      }
    });
    return;
  }
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string') {
      obj[key] = fn(key, val);
    } else if (val && typeof val === 'object') {
      walkStrings(val, fn, depth + 1);
    }
  }
};

// ---------------------------------------------------------------------------
// 10. XSS prevention — reject HTML/script, strip anything that slips through.
// ---------------------------------------------------------------------------
const sanitizeXss = (req, res, next) => {
  if (isPentestMode()) return next();
  try {
    walkStrings(req.body, (key, value) => {
      // Never inspect/alter password fields.
      if (PASSWORD_FIELDS.has(key)) return value;
      if (HTML_TAG_REGEX.test(value)) {
        const err = new Error('Invalid characters');
        err.status = 400;
        throw err;
      }
      // Belt-and-suspenders: encode any residual HTML-significant chars.
      return xss(value, { whiteList: {}, stripIgnoreTag: true });
    });
    return next();
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ message: 'Invalid characters' });
    }
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// 9. Input length / size validation.
// ---------------------------------------------------------------------------
const validateInputLength = (req, res, next) => {
  if (isPentestMode()) return next();
  let tooLong = false;
  walkStrings(req.body, (key, value) => {
    if (PASSWORD_FIELDS.has(key)) return value; // password length handled by policy
    const max = FIELD_MAX_LENGTH[key] || DEFAULT_MAX;
    if (value.length > max) tooLong = true;
    return value;
  });
  if (tooLong) {
    return res.status(400).json({ message: 'Input too long' });
  }
  return next();
};

// ---------------------------------------------------------------------------
// 11. Email format validation (only when an email field is present).
// ---------------------------------------------------------------------------
const validateEmail = (req, res, next) => {
  if (isPentestMode()) return next();
  const email = req.body?.email;
  if (email !== undefined && email !== null) {
    if (typeof email !== 'string' || !validator.isEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
  }
  return next();
};

module.exports = {
  sanitizeXss,
  validateInputLength,
  validateEmail,
};
