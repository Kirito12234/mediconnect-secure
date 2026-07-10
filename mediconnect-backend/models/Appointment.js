const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Free-text doctor name (e.g. "Dr. Smith")
    doctor: { type: String, required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    type: { type: String, default: 'General Consultation' },
    status: {
      type: String,
      enum: ['scheduled', 'pending', 'confirmed', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    // Stored encrypted at rest via utils/encryption.js before save.
    notes: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Appointment', appointmentSchema);
