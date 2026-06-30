const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { COOKIE_NAME } = require('../config/security');
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

module.exports = { protect, authorize };
