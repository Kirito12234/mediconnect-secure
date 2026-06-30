// Mirrors the backend password policy (config/security.js)

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
const SPECIAL_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

const escapeRegex = (str: string): string =>
  str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const specialCharRegex = new RegExp(`[${escapeRegex(SPECIAL_CHARS)}]`);

export const validatePassword = (
  password: string
): PasswordValidationResult => {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(
      `Password must be no more than ${PASSWORD_MAX_LENGTH} characters long`
    );
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!specialCharRegex.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Returns a 0-4 strength score for simple UI meters.
 */
export const getPasswordStrength = (password: string): number => {
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (specialCharRegex.test(password)) score += 1;
  return score;
};
