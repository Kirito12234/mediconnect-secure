const nodemailer = require('nodemailer');
const { logger } = require('./logger');

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  }
  return transporter;
};

/**
 * True only when real (non-placeholder) email credentials are configured.
 */
const isEmailConfigured = () => {
  const u = process.env.EMAIL_USER || '';
  const p = process.env.EMAIL_PASS || '';
  return Boolean(u && p && !u.startsWith('your-') && !p.startsWith('your-'));
};

/**
 * Send a one-time login code to `to`.
 *
 * Dev fallback: if email credentials are not configured (placeholders), the
 * code is logged to the audit log + console instead of being emailed, so the
 * flow is testable without a real Gmail App Password.
 */
const sendOtpEmail = async (to, code) => {
  if (!isEmailConfigured()) {
    logger.warn({
      event: 'EMAIL_OTP_DEV_FALLBACK',
      to,
      code,
      note: 'EMAIL_USER/EMAIL_PASS not configured; code logged instead of sent',
    });
    // eslint-disable-next-line no-console
    console.log(`[DEV] Email OTP for ${to}: ${code}`);
    return { devMode: true };
  }

  const info = await getTransporter().sendMail({
    from: `MediConnect <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Your MediConnect login code',
    text: `Your one-time login code is ${code}. It expires in 5 minutes. If you did not try to log in, ignore this email.`,
    html: `<p>Your one-time login code is <b style="font-size:18px">${code}</b>.</p><p>It expires in 5 minutes. If you did not try to log in, ignore this email.</p>`,
  });
  return { messageId: info.messageId };
};

module.exports = { sendOtpEmail, isEmailConfigured };
