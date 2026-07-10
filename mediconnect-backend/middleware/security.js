/**
 * Centralized security middleware.
 *
 * Every middleware here follows the same contract:
 *   - When PENTEST_MODE=true  -> the protection is DISABLED (calls next()).
 *   - When PENTEST_MODE=false -> the protection is ACTIVE and blocks attacks.
 *
 * PENTEST_MODE is read per-request via isPentestMode() so it always reflects
 * the current environment.
 */
const helmet = require('helmet');
const cors = require('cors');
const { isPentestMode } = require('../config/security');

// ---------------------------------------------------------------------------
// 7. CORS restriction
// ---------------------------------------------------------------------------
// Only these exact origins are allowed. Unauthorized origins receive NO CORS
// headers (the Origin is never reflected back), so browsers block the response.
//
// The base list can be extended (without code changes) via the CORS_ORIGIN
// env var, which accepts a comma-separated list of origins. This lets the app
// be reached on a LAN/VM IP (e.g. http://192.168.1.72:3000) without editing
// source — handy when the dev machine's IP changes.
const DEFAULT_ORIGINS = ['http://localhost:3000', 'http://192.168.56.1:3000'];

const ENV_ORIGINS = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const ALLOWED_ORIGINS = [...new Set([...DEFAULT_ORIGINS, ...ENV_ORIGINS])];

const strictCors = cors({
  origin: (origin, callback) => {
    // Requests without an Origin header (curl, server-to-server, same-origin)
    // are allowed through; browser cross-origin requests always send Origin.
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    // Unauthorized origin: do NOT reflect it. `false` means the cors package
    // sets no Access-Control-Allow-Origin header at all.
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-CSRF-Token',
    'X-XSRF-Token',
    'X-Requested-With',
  ],
  exposedHeaders: ['X-CSRF-Token'],
  maxAge: 86400,
});

const corsMiddleware = (req, res, next) => {
  if (isPentestMode()) {
    // PENTEST_MODE: reflect and accept ALL origins.
    return cors({ origin: true, credentials: true })(req, res, next);
  }
  return strictCors(req, res, next);
};

// ---------------------------------------------------------------------------
// 8. Security headers (Helmet)
// ---------------------------------------------------------------------------
// The frontend talks to the API/Socket.IO on port 5001 of the same host it was
// loaded from. Derive those origins from the allowlist so XHR + WebSocket
// connections are permitted by CSP on localhost and any configured LAN/VM IP.
const API_ORIGINS = ALLOWED_ORIGINS.map((o) => o.replace(':3000', ':5001'));
const WS_ORIGINS = API_ORIGINS.map((o) => o.replace(/^http/, 'ws'));
const CONNECT_SRC = ["'self'", ...API_ORIGINS, ...WS_ORIGINS];

const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'"],
      connectSrc: CONNECT_SRC,
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' }, // X-Frame-Options: DENY
  hidePoweredBy: true,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }, // Strict-Transport-Security
  ieNoOpen: true,
  noSniff: true, // X-Content-Type-Options: nosniff
  originAgentCluster: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true, // X-XSS-Protection
});

const securityHeaders = (req, res, next) => {
  if (isPentestMode()) return next();
  return helmetMiddleware(req, res, () => {
    // Extra hardening headers not covered by Helmet defaults.
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=()'
    );
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('X-Download-Options', 'noopen');
    next();
  });
};

module.exports = {
  ALLOWED_ORIGINS,
  corsMiddleware,
  securityHeaders,
};
