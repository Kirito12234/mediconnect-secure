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
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['user', 'doctor', 'admin'],
      default: 'user',
    },
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String, select: false },
    recoveryCodes: { type: [String], select: false, default: [] },
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
