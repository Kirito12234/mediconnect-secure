const { z } = require('zod');
const { isPentestMode } = require('../utils/pentestMode');

const registerSchema = z
  .object({
    name: z.string().min(2).max(50),
    email: z.string().email().max(100),
    phone: z.string().min(10).max(15),
    password: z.string().min(8).max(128),
    // Optional: mass-assignment protection strips `role` from the register body
    // (anti privilege-escalation), after which it defaults to 'user'. Marking it
    // required here would wrongly reject every registration with "Required".
    role: z.enum(['user', 'doctor']).optional(),
  })
  .strict();

// NOTE: `otp` is included (optional) because the login route accepts a TOTP
// code in the body for MFA. Without it, `.strict()` would reject any MFA login.
const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
    otp: z.string().optional(),
  })
  .strict();

// Middleware factory: validates req.body against a Zod schema.
// PENTEST_MODE: validation is bypassed entirely (vulnerable, for testing).
const validateSchema = (schema) => (req, res, next) => {
  if (isPentestMode()) return next();
  try {
    schema.parse(req.body);
    next();
  } catch (err) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: err.errors,
    });
  }
};

module.exports = { registerSchema, loginSchema, validateSchema };
