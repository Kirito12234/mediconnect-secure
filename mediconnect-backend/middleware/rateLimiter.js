const rateLimit = require('express-rate-limit');

// Login rate limiter: 5 attempts per 15 minutes per IP.
// NOTE: This is independent of account lockout. The rate limiter blocks by IP
// (too many requests from one source); account lockout blocks by user account
// (too many wrong passwords). Both can trigger independently.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      'Too many login attempts from this IP, please try again after 15 minutes.',
    retryAfter: '15 minutes',
    status: 429,
  },
  keyGenerator: (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return ip;
  },
  handler: (req, res) => {
    return res.status(429).json({
      error:
        'Too many login attempts from this IP, please try again after 15 minutes.',
      retryAfter: '15 minutes',
      status: 429,
    });
  },
});

// Register rate limiter: 5 per hour
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many registration attempts. Please try again later.' },
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

module.exports = { loginLimiter, registerLimiter, apiLimiter };
