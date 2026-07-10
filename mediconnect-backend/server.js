require('dotenv').config();

const http = require('http');
const cookie = require('cookie');
const jwt = require('jsonwebtoken');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');

const cors = require('cors');

const connectDB = require('./config/db');
const corsMiddleware = require('./config/cors');
const passport = require('./config/passport');
const { COOKIE_NAME, isPentestMode } = require('./config/security');

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

const { apiLimiter } = require('./middleware/rateLimiter');
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

// 1. Helmet with explicit strict settings
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'", 'http://localhost:5001'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
});

// 1. Helmet + custom headers — applied only when NOT in pentest mode
if (!PENTEST) {
  app.use(securityHeaders);

  // 1b. Additional custom security headers
  app.use((req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=()'
    );
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('X-Download-Options', 'noopen');
    next();
  });
} else {
  console.log('⚠️  PENTEST MODE: Helmet security headers DISABLED');
}

// 2. CORS — strict origins normally; accept ALL origins in pentest mode
if (PENTEST) {
  app.use(cors({ origin: true, credentials: true }));
  console.log('⚠️  PENTEST MODE: CORS accepting ALL origins');
} else {
  app.use(corsMiddleware);
}

// Handle CORS rejection gracefully
app.use((err, req, res, next) => {
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'CORS: Origin not allowed' });
  }
  return next(err);
});

// 3. Cookie parser
app.use(cookieParser());

// 4. Body parsers with size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// 4b. Passport (stateless — no sessions; used only for Google OAuth strategy)
app.use(passport.initialize());

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

// Verify CSRF on all state-changing /api requests
app.use('/api', verifyCsrfToken);

// 7. Register routes (auth guards are applied inside each router)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Resource not found' });
});

// 10. Global error handler - never leak stack traces in production
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';

  // CSRF token errors from csurf-style middleware
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }

  const status = err.status || err.statusCode || 500;

  if (!isProduction) {
    console.error(err);
  }

  res.status(status).json({
    message: isProduction ? 'Something went wrong' : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
});

// Create HTTP server so Socket.IO can share it
const server = http.createServer(app);

// 8. Socket.IO with CORS restriction
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://192.168.56.1:3000',
      'http://192.168.56.1:3001',
    ],
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
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
};

start();

module.exports = { app, server, io };
