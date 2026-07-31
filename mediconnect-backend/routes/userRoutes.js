const express = require('express');
const { z } = require('zod');

const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { protect } = require('../middleware/authMiddleware');
const { upload, handleUploadError } = require('../middleware/uploadMiddleware');
const { respondError } = require('../utils/respondError');

const router = express.Router();

// Whitelist of fields safe to return to the profile owner. Internal fields
// (_id, __v, failedLoginAttempts, lockUntil, passwordExpiresAt, passwordHistory,
// isActive, createdAt, updatedAt, etc.) are intentionally excluded.
const publicProfile = (user) => ({
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  mfaEnabled: user.mfaEnabled,
  lastLogin: user.lastLogin,
});

// All user routes require authentication
router.use(protect);

// GET /api/users/profile - current user data (password already excluded by protect)
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.status(200).json({ user: publicProfile(user) });
  } catch (err) {
    return respondError(res, 500, 'Failed to load profile', err);
  }
});

// Whitelist only the fields a user may change to prevent mass assignment
const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  phone: z.string().min(10, 'Phone must be at least 10 characters').optional(),
});

// PUT /api/users/profile - update name and/or phone only
router.put('/profile', async (req, res) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: parsed.error.issues.map((i) => i.message),
      });
    }

    // Build update from whitelisted fields only
    const updates = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select('-password');

    return res.status(200).json({ user: publicProfile(user) });
  } catch (err) {
    return respondError(res, 500, 'Failed to update profile', err);
  }
});

// GET /api/users/audit-log - the current user's own audit logs (last 50)
router.get('/audit-log', async (req, res) => {
  try {
    const logs = await AuditLog.find({ userId: req.user._id })
      .sort({ timestamp: -1 })
      .limit(50);
    return res.status(200).json({ logs });
  } catch (err) {
    return respondError(res, 500, 'Failed to load audit log', err);
  }
});

// GET /api/users/my-activity - alias for the current user's own audit logs
router.get('/my-activity', async (req, res) => {
  try {
    const logs = await AuditLog.find({ userId: req.user._id })
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();
    return res.status(200).json({ logs });
  } catch (err) {
    return respondError(res, 500, 'Failed to load activity', err);
  }
});

// POST /api/users/upload-avatar - secure single-file avatar upload
router.post(
  '/upload-avatar',
  upload.single('avatar'),
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const avatarPath = `/uploads/${req.file.filename}`;
      const user = await User.findByIdAndUpdate(
        req.user._id,
        { avatar: avatarPath },
        { new: true }
      ).select('-password');

      await AuditLog.create({
        userId: req.user._id,
        action: 'AVATAR_UPLOADED',
        email: req.user.email,
        role: req.user.role,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        details: `Avatar uploaded: ${avatarPath}`,
        success: true,
      });

      return res.status(200).json({
        message: 'Avatar uploaded successfully',
        avatar: user.avatar,
      });
    } catch (err) {
      return respondError(res, 500, 'Avatar upload failed', err);
    }
  }
);

module.exports = router;
