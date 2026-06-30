const helmet = require('helmet');

// ----- Password policy -----
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const PASSWORD_COMPLEXITY = {
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};
const PASSWORD_HISTORY_COUNT = 5;
const PASSWORD_EXPIRY_DAYS = 90;

// ----- Account lockout -----
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

// ----- JWT -----
const JWT_EXPIRY = '7d';
const MFA_TOKEN_EXPIRY = '5m';

// ----- Rate limiting -----
const LOGIN_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 5 };
const REGISTER_RATE_LIMIT = { windowMs: 60 * 60 * 1000, max: 5 };
const API_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 100 };

// ----- Cookie settings -----
const COOKIE_NAME = 'accessToken';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Apply additional security hardening to the Express app.
 * Helmet is also applied in server.js; this centralizes extra policies.
 */
const applySecurity = (app) => {
  app.disable('x-powered-by');

  app.use(
    helmet.hsts({
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    })
  );

  app.use(
    helmet.referrerPolicy({
      policy: 'no-referrer',
    })
  );
};

module.exports = {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_COMPLEXITY,
  PASSWORD_HISTORY_COUNT,
  PASSWORD_EXPIRY_DAYS,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_MINUTES,
  JWT_EXPIRY,
  MFA_TOKEN_EXPIRY,
  LOGIN_RATE_LIMIT,
  REGISTER_RATE_LIMIT,
  API_RATE_LIMIT,
  COOKIE_NAME,
  COOKIE_MAX_AGE,
  applySecurity,
};
