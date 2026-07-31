const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String },
    avatar: { type: String },
    // Google OAuth subject id. Sparse so multiple local-only accounts
    // (which have no googleId) don't collide on the unique index.
    googleId: { type: String, unique: true, sparse: true },
    isEmailVerified: { type: Boolean, default: false },
    // Password is only required for local (non-OAuth) accounts.
    password: {
      type: String,
      required: function () {
        return !this.googleId;
      },
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'doctor', 'admin'],
      default: 'user',
    },
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String, select: false },
    recoveryCodes: { type: [String], select: false, default: [] },
    // Email OTP (second factor via a one-time code emailed at login)
    emailOtpEnabled: { type: Boolean, default: false },
    emailOtp: { type: String, select: false }, // hashed code
    emailOtpExpires: { type: Date, select: false },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    passwordHistory: { type: [String], select: false, default: [] },
    passwordExpiresAt: { type: Date },
    lastLogin: { type: Date },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },
  },
  { timestamps: true }
);

/**
 * Returns true if the account is currently locked.
 */
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil.getTime() > Date.now());
};

/**
 * Returns true if the password has expired.
 */
userSchema.methods.isPasswordExpired = function () {
  return !!(
    this.passwordExpiresAt && this.passwordExpiresAt.getTime() < Date.now()
  );
};

/**
 * Clears failed login attempts and any active lock.
 */
userSchema.methods.resetLoginAttempts = function () {
  this.failedLoginAttempts = 0;
  this.lockUntil = null;
};

module.exports = mongoose.model('User', userSchema);
