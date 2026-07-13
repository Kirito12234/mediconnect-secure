const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const passport = require('passport');
const { z } = require('zod');

const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');
const { protect } = require('../middleware/authMiddleware');
const { validatePassword, isPasswordReused } = require('../utils/passwordValidator');
const {
  registerSchema,
  loginSchema,
  mfaVerifySchema,
  changePasswordSchema,
  validateOrBypass,
} = require('../utils/validationSchemas');
const {
  generateToken,
  generateMfaToken,
  setAccessTokenCookie,
  clearAccessTokenCookie,
  verifyToken,
} = require('../utils/tokenUtils');
const {
  logLoginSuccess,
  logLoginFailed,
  logAccountLocked,
  logMfaSetup,
  logPasswordChanged,
  logRegistration,
  logLogout,
} = require('../utils/auditLogger');
const {
  PASSWORD_EXPIRY_DAYS,
  PASSWORD_HISTORY_COUNT,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_MINUTES,
  COOKIE_NAME,
  isPentestMode,
} = require('../config/security');
const { respondError } = require('../utils/respondError');

const router = express.Router();

// POST /api/auth/register
router.post('/register', registerLimiter, async (req, res) => {
  try {
    // 1 & 2. Extract and validate input shape with Zod.
    // PENTEST_MODE: validation is bypassed, so the raw body flows through —
    // this also lets a client set `role` freely (mass assignment).
    const parsed = validateOrBypass(registerSchema, req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: parsed.error.issues.map((e) => ({
          field: e.path[0],
          message: e.message,
        })),
      });
    }

    const { name, email, phone, password, role } = parsed.data;

    // 3 & 4. Enforce password policy (skipped in PENTEST_MODE)
    if (!isPentestMode()) {
      const passwordCheck = validatePassword(password);
      if (!passwordCheck.valid) {
        return res.status(400).json({
          message: 'Password does not meet requirements',
          errors: passwordCheck.errors,
        });
      }
    }

    // 5 & 6. Reject duplicate emails
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // 7. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 8. Password expiry 90 days out
    const passwordExpiresAt = new Date(
      Date.now() + PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );

    // 9. Persist user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      password: hashedPassword,
      role,
      passwordHistory: [hashedPassword],
      passwordExpiresAt,
    });

    // 10. Audit the registration
    await logRegistration(user._id, user.email, req.ip);

    // 11. No token issued; user must log in
    return res.status(201).json({
      message: 'Registration successful. Please log in to continue.',
    });
  } catch (err) {
    return respondError(res, 500, 'Registration failed', err);
  }
});

// POST /api/auth/login
// NOTE: loginLimiter is applied at the app level in server.js (before CSRF),
// so it is intentionally NOT repeated here to avoid double-counting attempts.
router.post('/login', async (req, res) => {
  const clientIp = req.ip;
  const userAgent = req.headers['user-agent'];

  try {
    // 1. Extract and validate input (bypassed in PENTEST_MODE)
    const parsed = validateOrBypass(loginSchema, req.body);
    if (!parsed.success) {
      await logLoginFailed(
        req.body?.email,
        clientIp,
        userAgent,
        'invalid_input'
      );
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const { email, password } = parsed.data;
    // Guard against non-string input (e.g. NoSQL-injection objects that pass
    // through when validation is bypassed) so we don't throw on .toLowerCase().
    const normalizedEmail =
      typeof email === 'string' ? email.toLowerCase() : email;

    // 3. Find user including secret fields needed for auth
    const user = await User.findOne({ email: normalizedEmail }).select(
      '+password +mfaSecret'
    );

    // 4. Unknown email
    if (!user) {
      await logLoginFailed(normalizedEmail, clientIp, userAgent, 'user_not_found');
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // PENTEST_MODE: bypass account lockout entirely so brute-force attempts
    // are never blocked by a locked account.
    const pentestMode = isPentestMode();

    // 5. Account locked — check BEFORE doing anything else
    if (!pentestMode && user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      const minutesRemaining = Math.ceil(
        (user.lockUntil.getTime() - Date.now()) / (60 * 1000)
      );
      await logLoginFailed(
        normalizedEmail,
        clientIp,
        userAgent,
        'account_locked'
      );
      return res.status(423).json({
        message: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${minutesRemaining} minute(s).`,
        lockedUntil: user.lockUntil,
      });
    }

    // 5b. A previous lock has expired — clear the stale counter and lock so
    //     the user gets a fresh set of attempts.
    if (user.lockUntil && user.lockUntil.getTime() <= Date.now()) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
    }

    // 6. Verify password
    const isMatch = await bcrypt.compare(password, user.password);

    // 7. Wrong password
    if (!isMatch) {
      // PENTEST_MODE: do not track attempts or lock the account.
      if (pentestMode) {
        await logLoginFailed(
          normalizedEmail,
          clientIp,
          userAgent,
          'invalid_password'
        );
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      if (user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(
          Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000
        );
        await user.save();
        await logAccountLocked(
          user._id,
          user.role,
          user.email,
          clientIp,
          userAgent,
          user.failedLoginAttempts
        );
      } else {
        await user.save();
      }

      await logLoginFailed(
        normalizedEmail,
        clientIp,
        userAgent,
        'invalid_password'
      );
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // 8. Correct password
    user.resetLoginAttempts();
    user.lastLogin = new Date();
    await user.save();

    await logLoginSuccess(
      user._id,
      user.role,
      user.email,
      clientIp,
      userAgent,
      user.mfaEnabled
    );

    // Password expired -> issue a session so the user can reach the
    // protected change-password flow, but signal that a change is required.
    if (user.isPasswordExpired()) {
      const expiredToken = generateToken(user._id);
      setAccessTokenCookie(res, expiredToken);
      return res.status(403).json({
        message: 'Your password has expired. Please change it to continue.',
        passwordExpired: true,
        requiresPasswordChange: true,
      });
    }

    // 2FA / OTP handling.
    // PENTEST_MODE: skip all OTP checks entirely — login succeeds regardless of
    // any OTP value (deliberate, for the assessment).
    if (!pentestMode) {
      const { otp } = req.body;
      const otpProvided = otp !== undefined && otp !== null && otp !== '';

      if (otpProvided) {
        // An OTP was supplied -> ALWAYS validate it, even if the user hasn't
        // enabled 2FA. A missing secret or a bad code is rejected, so a fake
        // code like "000000" is never accepted in secure mode.
        const otpValid =
          !!user.mfaSecret &&
          speakeasy.totp.verify({
            secret: user.mfaSecret,
            encoding: 'base32',
            token: String(otp).trim(),
            window: 1,
          });
        if (!otpValid) {
          await logLoginFailed(
            normalizedEmail,
            clientIp,
            userAgent,
            'invalid_otp'
          );
          return res.status(401).json({ message: 'Invalid OTP code' });
        }
        // Valid OTP -> fall through and issue the session below.
      } else if (user.mfaEnabled) {
        // 2FA enabled but no OTP provided -> ask the client to collect one.
        return res
          .status(200)
          .json({ requiresOTP: true, message: 'OTP required' });
      }
    }

    // No MFA -> issue access token cookie
    const token = generateToken(user._id);
    setAccessTokenCookie(res, token);

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
        lastLogin: user.lastLogin,
      },
    });
  } catch (err) {
    return respondError(res, 500, 'Login failed', err);
  }
});

// Frontend base URL to redirect back to after the OAuth dance.
const CLIENT_URL =
  process.env.CLIENT_URL || process.env.CORS_ORIGIN || 'http://localhost:3000';

// Issue the session cookie + audit, then land the user on the dashboard.
const completeGoogleLogin = async (req, res, user) => {
  const token = generateToken(user._id);
  setAccessTokenCookie(res, token);
  user.lastLogin = new Date();
  await user.save();
  await logLoginSuccess(
    user._id,
    user.role,
    user.email,
    req.ip,
    req.headers['user-agent'],
    user.mfaEnabled
  );
  // Land on the frontend OAuth callback route, which finalizes the session
  // (cookie is already set) and forwards to the dashboard.
  return res.redirect(`${CLIENT_URL}/auth/callback`);
};

// GET /api/auth/google — kick off the OAuth flow
router.get('/google', (req, res, next) => {
  // PENTEST_MODE: skip Google entirely and bounce straight to our own callback
  // with a fake code, so an account is created WITHOUT any Google verification.
  if (isPentestMode()) {
    const email = req.query.email || 'pentest-user@example.com';
    return res.redirect(
      `/api/auth/google/callback?code=fake&email=${encodeURIComponent(email)}`
    );
  }
  return passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })(req, res, next);
});

// GET /api/auth/google/callback — Google redirects back here
router.get('/google/callback', async (req, res, next) => {
  // PENTEST_MODE: accept any callback code and create/find the user purely from
  // the (attacker-controlled) query email — no contact with Google at all.
  if (isPentestMode()) {
    try {
      const email = (req.query.email || 'pentest-user@example.com')
        .toString()
        .toLowerCase();
      let user = await User.findOne({ email });
      if (!user) {
        const randomPassword = await bcrypt.hash(
          crypto.randomBytes(32).toString('hex'),
          10
        );
        user = await User.create({
          name: req.query.name?.toString() || 'Pentest Google User',
          email,
          googleId: `pentest-${Date.now()}`,
          password: randomPassword,
          isEmailVerified: true,
          role: 'user',
        });
      }
      return await completeGoogleLogin(req, res, user);
    } catch (err) {
      return res.redirect(`${CLIENT_URL}/login?error=google_auth_failed`);
    }
  }

  // Normal flow: validate the code with Google via passport.
  return passport.authenticate('google', { session: false }, async (err, user) => {
    if (err || !user) {
      return res.redirect(`${CLIENT_URL}/login?error=google_auth_failed`);
    }
    try {
      return await completeGoogleLogin(req, res, user);
    } catch (e) {
      return res.redirect(`${CLIENT_URL}/login?error=google_auth_failed`);
    }
  })(req, res, next);
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  // Best-effort audit: identify the user from the cookie if present
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    try {
      const decoded = verifyToken(token);
      logLogout(decoded.id, '', req.ip);
    } catch {
      // invalid/expired token — nothing to log
    }
  }
  clearAccessTokenCookie(res);
  res.status(200).json({ message: 'Logged out successfully' });
});

// POST /api/auth/mfa/setup (authenticated)
router.post(['/mfa/setup', '/2fa/setup'], protect, async (req, res) => {
  try {
    // 1. Generate a TOTP secret bound to the user's email
    const secret = speakeasy.generateSecret({
      name: `MediConnect:${req.user.email}`,
      issuer: 'MediConnect',
    });

    // 2. QR code data URL for authenticator apps
    const qrCode = await qrcode.toDataURL(secret.otpauth_url);

    // 3. Generate 8 recovery codes
    const recoveryCodes = Array.from({ length: 8 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    // 4. Return secret + codes for the verify-setup step.
    //    The base32 secret is returned to the client to submit back; it is
    //    only persisted once verify-setup confirms the user can generate codes.
    return res.status(200).json({
      qrCode,
      secret: secret.base32,
      recoveryCodes,
    });
  } catch (err) {
    return respondError(res, 500, 'MFA setup failed', err);
  }
});

const verifySetupSchema = z.object({
  token: z.string().regex(/^\d{6}$/, 'Token must be a 6-digit code'),
  secret: z.string().min(1, 'Secret is required'),
  recoveryCodes: z.array(z.string()).optional(),
});

// POST /api/auth/mfa/verify-setup (authenticated)
router.post(['/mfa/verify-setup', '/2fa/verify'], protect, async (req, res) => {
  try {
    const parsed = verifySetupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: parsed.error.issues.map((i) => i.message),
      });
    }

    const { token, secret, recoveryCodes = [] } = parsed.data;

    // 2. Verify the submitted TOTP against the secret
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!verified) {
      return res
        .status(400)
        .json({ message: 'Invalid verification code. Please try again.' });
    }

    // 3. Persist secret, enable MFA, store hashed recovery codes
    const hashedRecoveryCodes = await Promise.all(
      recoveryCodes.map((code) => bcrypt.hash(code, 10))
    );

    const user = await User.findById(req.user._id);
    user.mfaSecret = secret;
    user.mfaEnabled = true;
    user.recoveryCodes = hashedRecoveryCodes;
    await user.save();

    // 4. Audit
    await logMfaSetup(user._id, user.email, req.ip);

    // 5. Success
    return res.status(200).json({ message: 'MFA enabled successfully' });
  } catch (err) {
    return respondError(res, 500, 'MFA verification failed', err);
  }
});

// POST /api/auth/mfa/verify (public - second step of login)
router.post('/mfa/verify', loginLimiter, async (req, res) => {
  try {
    // 1 & 2. Validate input
    const parsed = mfaVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: parsed.error.issues.map((i) => i.message),
      });
    }

    const { mfaToken, code, recoveryCode } = parsed.data;

    // 3. Verify the short-lived MFA token
    let decoded;
    try {
      decoded = verifyToken(mfaToken);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired MFA token' });
    }

    if (!decoded.mfa) {
      return res.status(401).json({ message: 'Invalid MFA token' });
    }

    // 4. Load user with MFA secret and recovery codes
    const user = await User.findById(decoded.id).select(
      '+mfaSecret +recoveryCodes'
    );
    if (!user || !user.mfaEnabled) {
      return res.status(401).json({ message: 'Invalid MFA code or recovery code' });
    }

    let verified = false;

    if (isPentestMode()) {
      // PENTEST_MODE: accept any (or empty) OTP — the second factor is bypassed.
      verified = true;
    } else if (code) {
      // 5. TOTP verification
      verified = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token: code,
        window: 1,
      });
    } else if (recoveryCode) {
      // 6. Match against stored recovery codes, consume the used one
      for (let i = 0; i < user.recoveryCodes.length; i += 1) {
        if (await bcrypt.compare(recoveryCode, user.recoveryCodes[i])) {
          verified = true;
          user.recoveryCodes.splice(i, 1);
          await user.save();
          break;
        }
      }
    }

    // 8. Reject on failure
    if (!verified) {
      await logLoginFailed(
        user.email,
        req.ip,
        req.headers['user-agent'],
        'invalid_mfa'
      );
      return res.status(401).json({ message: 'Invalid MFA code or recovery code' });
    }

    // 7. Issue access token cookie and return user data
    const token = generateToken(user._id);
    setAccessTokenCookie(res, token);

    await logLoginSuccess(
      user._id,
      user.role,
      user.email,
      req.ip,
      req.headers['user-agent'],
      user.mfaEnabled
    );

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
        lastLogin: user.lastLogin,
      },
    });
  } catch (err) {
    return respondError(res, 500, 'MFA verification failed', err);
  }
});

const mfaDisableSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

// POST /api/auth/mfa/disable (authenticated + password confirmation)
router.post('/mfa/disable', protect, async (req, res) => {
  try {
    const parsed = mfaDisableSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: parsed.error.issues.map((i) => i.message),
      });
    }

    // 1. Confirm password
    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await bcrypt.compare(parsed.data.password, user.password);
    if (!isMatch) {
      await logLoginFailed(
        user.email,
        req.ip,
        req.headers['user-agent'],
        'mfa_disable_invalid_password'
      );
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 2. Disable MFA and clear secrets
    user.mfaEnabled = false;
    user.mfaSecret = null;
    user.recoveryCodes = [];
    await user.save();

    // 3. Audit
    await AuditLog.create({
      userId: user._id,
      action: 'MFA_DISABLED',
      email: user.email,
      role: user.role,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: 'MFA disabled by user',
      success: true,
    });

    // 4. Success
    return res.status(200).json({ message: 'MFA disabled successfully' });
  } catch (err) {
    return respondError(res, 500, 'Failed to disable MFA', err);
  }
});

// POST /api/auth/change-password (authenticated)
router.post('/change-password', protect, async (req, res) => {
  try {
    const parsed = validateOrBypass(changePasswordSchema, req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: parsed.error.issues.map((i) => i.message),
      });
    }

    const { currentPassword, newPassword } = parsed.data;
    const pentestMode = isPentestMode();

    // 2. Load user with password + history
    const user = await User.findById(req.user._id).select(
      '+password +passwordHistory'
    );

    // 3 & 4. Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      await logLoginFailed(
        user.email,
        req.ip,
        req.headers['user-agent'],
        'change_password_invalid_current'
      );
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // 5 & 6. Enforce password policy (skipped in PENTEST_MODE)
    if (!pentestMode) {
      const passwordCheck = validatePassword(newPassword);
      if (!passwordCheck.valid) {
        return res.status(400).json({
          message: 'Password does not meet requirements',
          errors: passwordCheck.errors,
        });
      }

      // 7. Reject reuse of any of the last N passwords (history)
      const history = user.passwordHistory || [];
      const reusedFromHistory = await isPasswordReused(
        newPassword,
        history,
        bcrypt.compare
      );
      if (reusedFromHistory) {
        return res.status(400).json({
          message: `Cannot reuse your last ${PASSWORD_HISTORY_COUNT} passwords. Please choose a different password.`,
        });
      }

      // 7b. Reject reuse of the current password specifically
      const isSameAsCurrent = await bcrypt.compare(newPassword, user.password);
      if (isSameAsCurrent) {
        return res.status(400).json({
          message: 'New password must be different from current password',
        });
      }
    }

    // 8. Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 9. Push the OLD hash into history, keep only the last N
    const updatedHistory = [
      user.password,
      ...(user.passwordHistory || []),
    ].slice(0, PASSWORD_HISTORY_COUNT);

    // 10 & 11. Apply new password and reset expiry
    user.password = hashedPassword;
    user.passwordHistory = updatedHistory;
    user.passwordExpiresAt = new Date(
      Date.now() + PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );

    // 12. Save
    await user.save();

    // 13. Audit
    await logPasswordChanged(user._id, user.email, req.ip);

    // 14. Rotate session token (invalidates old cookie value)
    const token = generateToken(user._id);
    setAccessTokenCookie(res, token);

    // 15. Success
    return res.status(200).json({ message: 'Password changed successfully' });
  } catch (err) {
    return respondError(res, 500, 'Failed to change password', err);
  }
});

module.exports = router;
