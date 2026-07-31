const { isPentestMode } = require('../utils/pentestMode');

/**
 * Google reCAPTCHA v2 verification middleware (registration only).
 *
 * The client submits a reCAPTCHA token (field `captchaToken`, or the standard
 * `g-recaptcha-response`). This validates it with Google's siteverify API
 * server-side and rejects the request before the route handler if it fails.
 *
 *   - PENTEST_MODE=true            -> skipped (vulnerable, for testing).
 *   - RECAPTCHA_SECRET_KEY unset   -> skipped (so registration keeps working
 *                                     until reCAPTCHA is actually configured).
 */
const isCaptchaConfigured = () => {
  const key = process.env.RECAPTCHA_SECRET_KEY || '';
  return Boolean(key && !key.startsWith('your-'));
};

const verifyCaptcha = async (req, res, next) => {
  if (isPentestMode()) return next();

  // Pull and strip the token so it doesn't trip strict body validation later.
  const captchaToken =
    req.body?.captchaToken || req.body?.['g-recaptcha-response'];
  if (req.body) {
    delete req.body.captchaToken;
    delete req.body['g-recaptcha-response'];
  }

  // Not configured yet -> don't block registration.
  if (!isCaptchaConfigured()) {
    return next();
  }

  if (!captchaToken) {
    return res.status(400).json({
      success: false,
      message: 'CAPTCHA required. Please complete the challenge.',
    });
  }

  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(
        captchaToken
      )}&remoteip=${encodeURIComponent(req.ip || '')}`,
    });

    const data = await response.json();

    if (!data.success) {
      return res.status(403).json({
        success: false,
        message: 'CAPTCHA verification failed. Please try again.',
        errors: data['error-codes'] || [],
      });
    }

    // Verified successfully.
    return next();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('CAPTCHA verification error:', error.message);
    // Fail-open on network error for availability. Switch to fail-closed
    // (return 503) if you prefer stricter behavior in production.
    return next();
  }
};

module.exports = { verifyCaptcha, isCaptchaConfigured };
