const { z } = require('zod');
const { isPentestMode } = require('../config/security');

const registerSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name too long'),
  email: z.string().email('Invalid email format'),
  phone: z
    .string()
    .min(10, 'Phone must be at least 10 digits')
    .max(15, 'Phone too long'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['user', 'doctor']).default('user'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const appointmentSchema = z.object({
  doctor: z.string().min(1, 'Doctor is required'),
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
  type: z.string().optional(),
  notes: z.string().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

/**
 * Escape HTML-significant characters to neutralize stored XSS.
 * Non-string values are returned unchanged.
 *
 * PENTEST_MODE: returns the raw input unchanged so stored-XSS payloads survive.
 */
const sanitizeInput = (input) => {
  if (isPentestMode()) return input;
  if (typeof input !== 'string') return input;
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

/**
 * Validate `data` against a Zod `schema`, mirroring `schema.safeParse`.
 *
 * PENTEST_MODE: bypasses validation entirely and passes the raw data through
 * as `{ success: true, data }`, so injection/XSS/malformed payloads are
 * accepted by every route that uses this helper.
 */
const validateOrBypass = (schema, data) => {
  if (isPentestMode()) return { success: true, data };
  return schema.safeParse(data);
};

module.exports = {
  registerSchema,
  loginSchema,
  appointmentSchema,
  changePasswordSchema,
  sanitizeInput,
  validateOrBypass,
};
