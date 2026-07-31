const jwt = require('jsonwebtoken');
const User = require('../models/User');
const TokenBlacklist = require('../models/TokenBlacklist');
const { COOKIE_NAME, isPentestMode } = require('../config/security');
const { clearAccessTokenCookie } = require('../utils/tokenUtils');
const { logAccessDenied } = require('../utils/auditLogger');

/**
 * Authenticates a request using the access token cookie.
 * On success attaches the user document to req.user.
 */
const protect = async (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    await logAccessDenied( 
      null,
      null,
      req.ip,
      req.headers['user-agent'],
      req.originalUrl,
      'no_token'
    );
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    clearAccessTokenCookie(res);
    return res.status(401).json({ message: 'Session expired' });
  }

  // Explicit expiry check (jwt.verify already throws on expiry, this is defensive)
  if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
    clearAccessTokenCookie(res);
    return res.status(401).json({ message: 'Session expired' });
  }

  // Reject revoked tokens (blacklisted on logout). Always active — no
  // PENTEST_MODE bypass, so a logged-out/captured token can never be reused.
  const blacklisted = await TokenBlacklist.findOne({ token });
  if (blacklisted) {
    clearAccessTokenCookie(res);
    return res.status(401).json({ message: 'Token has been revoked' });
  }

  // Session binding: the token is bound to the original client's User-Agent
  // fingerprint, so a stolen token can't be replayed from another device.
  // Skipped in PENTEST_MODE so Before-PENTEST testing still works.
  if (!isPentestMode()) {
    const crypto = require('crypto');
    const currentFingerprint = crypto
      .createHash('sha256')
      .update(req.headers['user-agent'] || 'unknown')
      .digest('hex')
      .substring(0, 16);
    if (decoded.fingerprint && decoded.fingerprint !== currentFingerprint) {
      return res
        .status(401)
        .json({ message: 'Session invalid: device mismatch' });
    }
  }

  const user = await User.findById(decoded.id).select('-password');

  if (!user) {
    clearAccessTokenCookie(res);
    await logAccessDenied(
      decoded.id,
      null,
      req.ip,
      req.headers['user-agent'],
      req.originalUrl,
      'user_not_found'
    );
    return res.status(401).json({ message: 'User not found' });
  }

  req.user = user;
  next();
};

/**
 * Restricts a route to one or more roles. Use after protect.
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    // PENTEST_MODE: skip role verification so any authenticated user can reach
    // role-restricted routes (e.g. admin). JWT auth (protect) still applies.
    if (isPentestMode()) {
      return next();
    }
    if (!roles.includes(req.user.role)) {
      logAccessDenied(
        req.user._id,
        req.user.email,
        req.ip,
        req.headers['user-agent'],
        req.originalUrl,
        'insufficient_role'
      );
      return res.status(403).json({
        message:
          'Access denied. You do not have permission to access this resource.',
      });
    }
    next();
  };
}

// `authorizeRoles` is an alias for `authorize` (same role-check middleware),
// exported so both naming conventions work.
module.exports = { protect, authorize, authorizeRoles: authorize };
