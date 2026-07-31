const express = require('express');
const { z } = require('zod');

const User = require('../models/User');
const Appointment = require('../models/Appointment');
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/authMiddleware');
const { respondError } = require('../utils/respondError');

const router = express.Router();

// All admin routes require authentication and the admin role
router.use(protect);
router.use(authorize('admin'));

// GET /api/admin/users - list all users (passwords excluded)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    return res.status(200).json({ users });
  } catch (err) {
    return respondError(res, 500, 'Failed to load users', err);
  }
});

// GET /api/admin/audit-logs - latest 100 audit entries
router.get('/audit-logs', async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .sort({ timestamp: -1 })
      .limit(100)
      .populate('userId', 'name email role');
    return res.status(200).json({ logs });
  } catch (err) {
    return respondError(res, 500, 'Failed to load audit logs', err);
  }
});

const roleSchema = z.object({
  role: z.enum(['user', 'doctor', 'admin']),
});

// PUT /api/admin/users/:id/role - change a user's role
router.put('/users/:id/role', async (req, res) => {
  try {
    const parsed = roleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: parsed.error.issues.map((i) => i.message),
      });
    }

    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.role = parsed.data.role;
    await user.save();

    await AuditLog.create({
      userId: req.user._id,
      action: 'ROLE_CHANGED',
      email: user.email,
      role: user.role,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: `Role for ${user.email} set to ${parsed.data.role} by admin ${req.user.email}`,
      success: true,
    });

    return res.status(200).json({ user });
  } catch (err) {
    return respondError(res, 500, 'Failed to update role', err);
  }
});

// PUT /api/admin/users/:id/unlock - manually unlock a locked account
router.put('/users/:id/unlock', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.resetLoginAttempts();
    await user.save();

    await AuditLog.create({
      userId: req.user._id,
      action: 'ACCOUNT_UNLOCKED',
      email: user.email,
      role: user.role,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: `Account ${user.email} unlocked by admin ${req.user.email}`,
      success: true,
    });

    return res.status(200).json({ message: 'Account unlocked', user });
  } catch (err) {
    return respondError(res, 500, 'Failed to unlock account', err);
  }
});

// DELETE /api/admin/users/:id - remove a user (admin only)
router.delete('/users/:id', async (req, res) => {
  try {
    // Prevent an admin from deleting their own account (avoids self-lockout).
    if (req.params.id === req.user._id.toString()) {
      return res
        .status(400)
        .json({ message: 'You cannot delete your own account' });
    }

    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      userId: req.user._id,
      action: 'USER_DELETED',
      email: user.email,
      role: user.role,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      details: `User ${user.email} deleted by admin ${req.user.email}`,
      success: true,
    });

    return res.status(200).json({ message: 'User deleted' });
  } catch (err) {
    return respondError(res, 500, 'Failed to delete user', err);
  }
});

// GET /api/admin/stats - aggregate dashboard counts
router.get('/stats', async (req, res) => {
  try {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalDoctors,
      failedLoginsToday,
      lockedAccounts,
      totalAppointments,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'doctor' }),
      AuditLog.countDocuments({
        action: 'LOGIN_FAILED',
        timestamp: { $gte: last24h },
      }),
      User.countDocuments({ lockUntil: { $gt: new Date() } }),
      Appointment.countDocuments(),
    ]);

    return res.status(200).json({
      totalUsers,
      totalDoctors,
      failedLoginsToday,
      lockedAccounts,
      totalAppointments,
    });
  } catch (err) {
    return respondError(res, 500, 'Failed to load stats', err);
  }
});

module.exports = router;
