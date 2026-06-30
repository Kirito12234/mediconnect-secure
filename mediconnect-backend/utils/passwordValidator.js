const {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_COMPLEXITY,
  PASSWORD_HISTORY_COUNT,
} = require('../config/security');

const PASSWORD_ERRORS = {
  TOO_SHORT: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`,
  TOO_LONG: `Password must be no more than ${PASSWORD_MAX_LENGTH} characters long`,
  MISSING_UPPERCASE: 'Password must contain at least one uppercase letter',
  MISSING_LOWERCASE: 'Password must contain at least one lowercase letter',
  MISSING_NUMBER: 'Password must contain at least one number',
  MISSING_SPECIAL_CHAR: 'Password must contain at least one special character',
  REUSED_PASSWORD: `Password cannot be the same as your last ${PASSWORD_HISTORY_COUNT} passwords`,
  EXPIRED_PASSWORD: 'Your password has expired. Please change it to continue',
};

// Build a character class for the configured special characters, escaped for regex.
const escapedSpecialChars = PASSWORD_COMPLEXITY.specialChars.replace(
  /[.*+?^${}()|[\]\\]/g,
  '\\$&'
);
const specialCharRegex = new RegExp(`[${escapedSpecialChars}]`);

/**
 * Validates a password against the configured policy.
 * @param {string} password
 * @returns {{ valid: boolean, errors: string[] }}
 */
const validatePassword = (password) => {
  const errors = [];
  const value = typeof password === 'string' ? password : '';

  if (value.length < PASSWORD_MIN_LENGTH) {
    errors.push(PASSWORD_ERRORS.TOO_SHORT);
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    errors.push(PASSWORD_ERRORS.TOO_LONG);
  }
  if (PASSWORD_COMPLEXITY.requireUppercase && !/[A-Z]/.test(value)) {
    errors.push(PASSWORD_ERRORS.MISSING_UPPERCASE);
  }
  if (PASSWORD_COMPLEXITY.requireLowercase && !/[a-z]/.test(value)) {
    errors.push(PASSWORD_ERRORS.MISSING_LOWERCASE);
  }
  if (PASSWORD_COMPLEXITY.requireNumber && !/[0-9]/.test(value)) {
    errors.push(PASSWORD_ERRORS.MISSING_NUMBER);
  }
  if (PASSWORD_COMPLEXITY.requireSpecialChar && !specialCharRegex.test(value)) {
    errors.push(PASSWORD_ERRORS.MISSING_SPECIAL_CHAR);
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Checks whether a plaintext password matches any hash in the history.
 * @param {string} plainPassword
 * @param {string[]} passwordHistory - array of stored password hashes
 * @param {(plain: string, hash: string) => Promise<boolean>} compareFn - e.g. bcrypt.compare
 * @returns {Promise<boolean>} true if reused, false otherwise
 */
const isPasswordReused = async (plainPassword, passwordHistory, compareFn) => {
  if (!Array.isArray(passwordHistory) || passwordHistory.length === 0) {
    return false;
  }

  for (const hash of passwordHistory) {
    if (await compareFn(plainPassword, hash)) {
      return true;
    }
  }
  return false;
};

module.exports = {
  PASSWORD_ERRORS,
  validatePassword,
  isPasswordReused,
};
