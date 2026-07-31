const fs = require('fs');
const path = require('path');
const winston = require('winston');

// Ensure the logs directory exists before the File transport writes to it.
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logsDir, 'audit.log') }),
    new winston.transports.Console({ format: winston.format.simple() }),
  ],
});

const logLoginSuccess = (userId, email) => {
  logger.info({ event: 'LOGIN_SUCCESS', userId, email, timestamp: new Date() });
};

const logLoginFailed = (email, reason) => {
  logger.warn({ event: 'LOGIN_FAILED', email, reason, timestamp: new Date() });
};

const logAccountLocked = (userId, email) => {
  logger.warn({ event: 'ACCOUNT_LOCKED', userId, email, timestamp: new Date() });
};

const logAccessDenied = (userId, action) => {
  logger.warn({ event: 'ACCESS_DENIED', userId, action, timestamp: new Date() });
};

const logPasswordChange = (userId) => {
  logger.info({ event: 'PASSWORD_CHANGED', userId, timestamp: new Date() });
};

const logRegistration = (userId, email) => {
  logger.info({ event: 'USER_REGISTERED', userId, email, timestamp: new Date() });
};

module.exports = {
  logger,
  logLoginSuccess,
  logLoginFailed,
  logAccountLocked,
  logAccessDenied,
  logPasswordChange,
  logRegistration,
};
