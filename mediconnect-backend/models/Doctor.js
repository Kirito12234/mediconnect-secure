const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema(
  {
    // Optional link to a User account (doctors may also be app users).
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String },
    specialization: { type: String, default: 'General Practitioner' },
    bio: { type: String },
    consultationFee: { type: Number, default: 0 },
    // Simple weekly availability, e.g. ['Mon 09:00-12:00', 'Wed 14:00-17:00']
    availability: { type: [String], default: [] },
    rating: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Doctor', doctorSchema);
