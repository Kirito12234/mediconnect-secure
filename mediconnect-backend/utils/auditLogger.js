const AuditLog = require('../models/AuditLog');

// Core writer — never throws, so logging can never crash a request.
// IMPORTANT: never pass passwords, tokens, or secrets into audit logs.
const logEvent = async (data) => {
  try {
    await AuditLog.create({
      userId: data.userId || null,
      action: data.action,
      email: data.email || '',
      role: data.role || '',
      ipAddress: data.ipAddress || 'unknown',
      userAgent: data.userAgent || '',
      details: data.details || '',
      success: data.success !== undefined ? data.success : true,
      timestamp: new Date(),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Audit log error:', error.message);
  }
};

const logLoginSuccess = (userId, role, email, ip, userAgent, mfaEnabled) =>
  logEvent({
    userId,
    action: 'LOGIN_SUCCESS',
    email,
    role,
    ipAddress: ip,
    userAgent,
    details: `MFA: ${mfaEnabled}`,
    success: true,
  });

const logLoginFailed = (email, ip, userAgent, reason) =>
  logEvent({
    action: 'LOGIN_FAILED',
    email,
    ipAddress: ip,
    userAgent,
    details: reason,
    success: false,
  });

const logAccountLocked = (userId, role, email, ip, userAgent, attempts) =>
  logEvent({
    userId,
    action: 'ACCOUNT_LOCKED',
    email,
    role,
    ipAddress: ip,
    userAgent,
    details: `Locked after ${attempts} attempts`,
    success: false,
  });

const logMfaSetup = (userId, email, ip) =>
  logEvent({
    userId,
    action: 'MFA_SETUP',
    email,
    ipAddress: ip,
    success: true,
  });

const logPasswordChanged = (userId, email, ip) =>
  logEvent({
    userId,
    action: 'PASSWORD_CHANGED',
    email,
    ipAddress: ip,
    success: true,
  });

const logAccessDenied = (userId, email, ip, userAgent, path, reason) =>
  logEvent({
    userId,
    action: 'ACCESS_DENIED',
    email,
    ipAddress: ip,
    userAgent,
    details: `${path} - ${reason}`,
    success: false,
  });

const logRegistration = (userId, email, ip) =>
  logEvent({
    userId,
    action: 'REGISTRATION',
    email,
    ipAddress: ip,
    success: true,
  });

const logLogout = (userId, email, ip) =>
  logEvent({
    userId,
    action: 'LOGOUT',
    email,
    ipAddress: ip,
    success: true,
  });

module.exports = {
  logEvent,
  logLoginSuccess,
  logLoginFailed,
  logAccountLocked,
  logMfaSetup,
  logPasswordChanged,
  logAccessDenied,
  logRegistration,
  logLogout,
};
