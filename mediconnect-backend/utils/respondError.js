/**
 * Send an error response without leaking internal details in production.
 * In non-production the underlying error message is included to aid debugging;
 * in production only the safe, generic message is returned.
 */
const respondError = (res, status, message, err) => {
  if (err && process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(status).json({ message, error: err.message });
  }
  return res.status(status).json({ message });
};

module.exports = { respondError };
