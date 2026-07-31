const mongoose = require('mongoose');

const tokenBlacklistSchema = new mongoose.Schema({
  token: { type: String, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // TTL index: MongoDB auto-deletes the doc once expiresAt passes, so the
  // blacklist self-cleans and never grows unbounded.
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

module.exports = mongoose.model('TokenBlacklist', tokenBlacklistSchema);
