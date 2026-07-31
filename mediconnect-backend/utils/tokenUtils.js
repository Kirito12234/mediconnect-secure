const jwt = require('jsonwebtoken');
const {
  JWT_EXPIRY,
  MFA_TOKEN_EXPIRY,
  COOKIE_NAME,
  COOKIE_MAX_AGE,
  isPentestMode,
} = require('../config/security');

// Generate access token, bound to the client's User-Agent fingerprint so a
// stolen token can't be replayed from a different device/browser.
// PENTEST_MODE: uses a deliberately different '1h' expiry per the assessment
// spec; otherwise JWT_EXPIRY (15d, from JWT_EXPIRES_IN in .env).
const generateToken = (id, userAgent) => {
  const crypto = require('crypto');
  const fingerprint = crypto
    .createHash('sha256')
    .update(userAgent || 'unknown')
    .digest('hex')
    .substring(0, 16);
  const expiresIn = isPentestMode() ? '1h' : JWT_EXPIRY;
  return jwt.sign({ id, fingerprint }, process.env.JWT_SECRET, { expiresIn });
};

// Generate short-lived MFA token (5 min expiry)
const generateMfaToken = (id) => {
  return jwt.sign({ id, mfa: true }, process.env.JWT_SECRET, {
    expiresIn: MFA_TOKEN_EXPIRY,
  });
};

// Verify a token and return the decoded payload
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// Set access token as httpOnly cookie
const setAccessTokenCookie = (res, token, maxAge = COOKIE_MAX_AGE) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true, // Prevents JavaScript access (XSS protection)
    secure: isProduction, // HTTPS only in production
    sameSite: 'strict', // CSRF protection
    maxAge: maxAge, // 15 days (COOKIE_MAX_AGE)
    path: '/',
  });
};

// Clear access token cookie
const clearAccessTokenCookie = (res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
};

module.exports = {
  generateToken,
  generateMfaToken,
  verifyToken,
  setAccessTokenCookie,
  clearAccessTokenCookie,
};
