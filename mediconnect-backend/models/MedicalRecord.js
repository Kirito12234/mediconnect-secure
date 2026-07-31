const mongoose = require('mongoose');

const medicalRecordSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
    },
    doctor: { type: String },
    diagnosis: { type: String },
    // Encrypted at rest by utils/encryption.js before save (like appointment notes).
    notes: { type: String },
    attachments: { type: [String], default: [] }, // file paths / URLs
    recordedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);
