const Tokens = require('csrf');
const { isPentestMode } = require('../config/security');

const tokens = new Tokens();

// Endpoint handler: issue a CSRF token, storing the secret in an httpOnly cookie
const getCsrfToken = (req, res) => {
  let secret = req.cookies._csrf_secret;
  if (!secret) {
    secret = tokens.secretSync();
    res.cookie('_csrf_secret', secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    });
  }
  const token = tokens.create(secret);
  res.json({ csrfToken: token });
};

// Middleware: verify CSRF token on state-changing requests
const verifyCsrfToken = (req, res, next) => {
  // PENTEST_MODE: skip CSRF validation so requests work without a token
  if (isPentestMode()) {
    return next();
  }

  // Safe methods do not require a CSRF token
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const secret = req.cookies?._csrf_secret;
  const token = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];

  if (!secret || !token || !tokens.verify(secret, token)) {
    return res.status(403).json({ message: 'Invalid or missing CSRF token' });
  }
  next();
};

module.exports = { getCsrfToken, verifyCsrfToken };
