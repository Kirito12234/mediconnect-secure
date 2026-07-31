require('dotenv').config();

const http = require('http');
const cookie = require('cookie');
const jwt = require('jsonwebtoken');
const express = require('express');
const cookieParser = require('cookie-parser');
const xss = require('xss-clean');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const passport = require('./config/passport');
const { COOKIE_NAME, isPentestMode } = require('./config/security');
const {
  ALLOWED_ORIGINS,
  corsMiddleware,
  securityHeaders,
  noSqlSanitize,
  preventPrototypePollution,
  errorHandler,
} = require('./middleware/security');
const {
  sanitizeXss,
  validateInputLength,
  validateEmail,
  preventMassAssignment,
} = require('./middleware/inputValidation');

const PENTEST = isPentestMode();

if (PENTEST) {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  ⚠️  WARNING: PENTEST MODE IS ACTIVE          ║');
  console.log('║  All security features are DISABLED!          ║');
  console.log('║  DO NOT use in production!                    ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
}

const { apiLimiter, loginLimiter } = require('./middleware/rateLimiter');
const {
  getCsrfToken,
  verifyCsrfToken,
} = require('./middleware/csrfProtection');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 5001;

// Belt-and-suspenders: hide the framework signature
app.disable('x-powered-by');

if (PENTEST) {
  console.log('⚠️  PENTEST MODE: all security middleware DISABLED');
}

// 1. Security headers (Helmet). Internally disabled when PENTEST_MODE=true.
app.use(securityHeaders);

// 2. CORS — strict origins when protected; all origins in PENTEST_MODE.
app.use(corsMiddleware);

// 3. Cookie parser
app.use(cookieParser());

// 4. Body parsers. Request body is capped at 10KB when protections are active.
const BODY_LIMIT = PENTEST ? '5mb' : '10kb';
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: false, limit: BODY_LIMIT }));

// 4b. Passport (stateless — no sessions; used only for Google OAuth strategy)
app.use(passport.initialize());

// 4c. Request sanitization & validation — active only when PENTEST_MODE=false.
//     Order matters: clean structure first, then reject malicious content.
app.use(noSqlSanitize); // strip $/dotted keys (NoSQL injection)

// Extra XSS layer via xss-clean (in addition to sanitizeXss below).
if (!isPentestMode()) {
  app.use(xss());
  console.log('XSS Protection: ACTIVE');
}

app.use(preventPrototypePollution); // strip __proto__/constructor/prototype
app.use(sanitizeXss); // reject/strip HTML & <script>
app.use(validateInputLength); // enforce field length limits
app.use(validateEmail); // enforce email format when an email field is present

// Serve uploaded files statically (no directory listing). Allow cross-origin
// loading so the frontend (different port) can display avatars.
app.use(
  '/uploads',
  express.static('uploads', {
    index: false,
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

// 6. Apply general API rate limiter
app.use('/api', apiLimiter);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// 5. CSRF token endpoint (must be before verifyCsrfToken middleware)
app.get('/api/auth/csrf-token', getCsrfToken);

// Login brute-force limiter — MUST run before CSRF so that after the max
// attempts it returns 429 regardless of whether a CSRF token is present.
app.use('/api/auth/login', loginLimiter);

// Verify CSRF on all state-changing /api requests
app.use('/api', verifyCsrfToken);

// 6. Mass assignment protection: strip role/isAdmin/etc. from registration so
//    a client can never self-assign a privileged role. Must run before the
//    auth router handles POST /api/auth/register.
app.use('/api/auth/register', preventMassAssignment);

// 7. Register routes (auth guards are applied inside each router)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Resource not found' });
});

// 13. Global error handler — sanitizes errors (no stack traces leaked) and
//     logs full details server-side. See middleware/security.js.
app.use(errorHandler);

// Create HTTP server so Socket.IO can share it
const server = http.createServer(app);

// 8. Socket.IO with CORS restriction
const io = new Server(server, {
  cors: {
    // Reuse the same allowlist as the HTTP CORS layer (extendable via
    // CORS_ORIGIN in .env) so sockets connect from the LAN/VM IP too.
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Authenticate socket connections using the access-token cookie
io.use((socket, next) => {
  try {
    const rawCookie = socket.handshake.headers.cookie;
    if (!rawCookie) {
      return next(new Error('Authentication required'));
    }
    const parsed = cookie.parse(rawCookie);
    const token = parsed[COOKIE_NAME];
    if (!token) {
      return next(new Error('Authentication required'));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Reject half-authenticated MFA tokens
    if (decoded.mfa) {
      return next(new Error('MFA not completed'));
    }
    socket.userId = decoded.id;
    return next();
  } catch (err) {
    return next(new Error('Invalid or expired token'));
  }
});

io.on('connection', (socket) => {
  // Each user joins a private room keyed by their id so we can target them
  const room = `user:${socket.userId}`;
  socket.join(room);
  console.log(`Socket connected: ${socket.id} (user ${socket.userId})`);

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Make io accessible to routes/controllers
app.set('io', io);

/**
 * Emit an appointment update to both participants.
 */
const emitAppointmentUpdate = (appointment) => {
  const patientId =
    appointment.patient?._id?.toString() || appointment.patient?.toString();
  const doctorId =
    appointment.doctor?._id?.toString() || appointment.doctor?.toString();

  [patientId, doctorId].filter(Boolean).forEach((id) => {
    io.to(`user:${id}`).emit('appointment_update', {
      appointmentId: appointment._id,
      status: appointment.status,
      date: appointment.date,
      time: appointment.time,
    });
  });
};

/**
 * Send a notification alert to a specific user.
 */
const emitNotification = (userId, payload) => {
  io.to(`user:${userId}`).emit('notification', payload);
};

app.set('emitAppointmentUpdate', emitAppointmentUpdate);
app.set('emitNotification', emitNotification);

// 9. Connect to MongoDB then start the server
const start = async () => {
  try {
    await connectDB();
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`MediConnect backend listening on port ${PORT}`);

      if (isPentestMode()) {
        console.warn('WARNING: PENTEST MODE ACTIVE');
        console.warn('All extra security features DISABLED');
        console.warn('DO NOT use in production!');
      } else {
        console.log('All 14 security features ACTIVE');
        console.log(
          'Baseline: JWT, Password Policy, Rate Limit, RBAC, Audit Log, Google OAuth'
        );
        console.log(
          'Extra: TOTP, Email OTP, Helmet, NoSQL Sanitize, XSS, CSRF, Zod, IDOR'
        );
      }
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
};

start();

module.exports = { app, server, io };
