const jwt = require('jsonwebtoken');
const {
  JWT_EXPIRY,
  MFA_TOKEN_EXPIRY,
  COOKIE_NAME,
  COOKIE_MAX_AGE,
} = require('../config/security');

// Generate access token (7 day expiry)
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRY });
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
    maxAge: maxAge, // 7 days
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
