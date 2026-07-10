const express = require('express');
const { z } = require('zod');

const Appointment = require('../models/Appointment');
const { protect, authorize } = require('../middleware/authMiddleware');
const { logAccessDenied } = require('../utils/auditLogger');
const { encrypt, decrypt } = require('../utils/encryption');
const {
  appointmentSchema,
  sanitizeInput,
  validateOrBypass,
} = require('../utils/validationSchemas');
const { isPentestMode } = require('../config/security');
const { respondError } = require('../utils/respondError');

const router = express.Router();

// All appointment routes require authentication
router.use(protect);

// Helper: is the current user the patient who owns this appointment?
// (doctor is now a free-text name, not a user reference)
const isOwnerPatient = (appointment, user) =>
  appointment.patient.toString() === user._id.toString();

// GET /api/appointments - role-scoped listing
router.get('/', async (req, res) => {
  try {
    // doctor is a free-text field, so only admins see everything;
    // everyone else sees the appointments they booked as a patient.
    const filter = req.user.role === 'admin' ? {} : { patient: req.user._id };

    const appointments = await Appointment.find(filter)
      .populate('patient', 'name email')
      .sort({ date: 1 });

    // Decrypt notes before returning
    const decrypted = appointments.map((appt) => {
      const obj = appt.toObject();
      if (obj.notes) obj.notes = decrypt(obj.notes);
      return obj;
    });

    return res.status(200).json({ appointments: decrypted });
  } catch (err) {
    return respondError(res, 500, 'Failed to load appointments', err);
  }
});

// GET /api/appointments/my-patients - doctors (and admins) see their patients
router.get(
  '/my-patients',
  authorize('doctor', 'admin'),
  async (req, res) => {
    try {
      // Admins see all patients; doctors see patients they have appointments with
      const filter = req.user.role === 'admin' ? {} : { doctor: req.user._id };

      const appointments = await Appointment.find(filter).populate(
        'patient',
        'name email phone'
      );

      // De-duplicate patients by id
      const seen = new Set();
      const patients = [];
      for (const appt of appointments) {
        const p = appt.patient;
        if (p && !seen.has(p._id.toString())) {
          seen.add(p._id.toString());
          patients.push(p);
        }
      }

      return res.status(200).json({ patients });
    } catch (err) {
      return respondError(res, 500, 'Failed to load patients', err);
    }
  }
);

// GET /api/appointments/:id - single appointment.
// IDOR ownership is enforced UNLESS PENTEST_MODE=true (deliberate, for
// demonstrating the vulnerability vs. the fix). Defaults to SECURE.
router.get('/:id', async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id).populate(
      'patient',
      'name email'
    );

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const pentestMode = isPentestMode();

    if (!pentestMode) {
      const patientId =
        appointment.patient?._id?.toString() ||
        appointment.patient?.toString();
      const isOwner = patientId === req.user._id.toString();
      const isAdmin = req.user.role === 'admin';

      if (!isOwner && !isAdmin) {
        await logAccessDenied(
          req.user._id,
          req.user.email,
          req.ip,
          req.headers['user-agent'],
          req.originalUrl,
          'IDOR attempt'
        );
        return res
          .status(403)
          .json({ message: 'Access denied. You do not own this resource.' });
      }
    }

    const result = appointment.toObject();
    if (result.notes) result.notes = decrypt(result.notes);

    return res.status(200).json({ appointment: result });
  } catch (err) {
    return respondError(res, 500, 'Failed to load appointment', err);
  }
});

// POST /api/appointments - book an appointment
router.post('/', async (req, res) => {
  try {
    const parsed = validateOrBypass(appointmentSchema, req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: parsed.error.issues.map((i) => i.message),
      });
    }

    const appointment = await Appointment.create({
      patient: req.user._id,
      doctor: parsed.data.doctor || 'Dr. Smith',
      date: parsed.data.date,
      time: parsed.data.time,
      type: parsed.data.type || 'General Consultation',
      notes: parsed.data.notes
        ? encrypt(sanitizeInput(parsed.data.notes))
        : '',
      status: 'scheduled',
    });

    // Return notes in plaintext to the creator
    const result = appointment.toObject();
    if (result.notes) result.notes = decrypt(result.notes);

    // Real-time: notify the patient's own room of the new booking
    const emitAppointmentUpdate = req.app.get('emitAppointmentUpdate');
    if (emitAppointmentUpdate) emitAppointmentUpdate(appointment);

    return res.status(201).json({
      message: 'Appointment created successfully',
      appointment: result,
    });
  } catch (err) {
    return respondError(res, 500, 'Failed to create appointment', err);
  }
});

const updateSchema = z.object({
  date: z.coerce.date().optional(),
  time: z.string().min(1).optional(),
  type: z.string().optional(),
  status: z
    .enum(['scheduled', 'pending', 'confirmed', 'completed', 'cancelled'])
    .optional(),
  notes: z.string().optional(),
});

// PUT /api/appointments/:id - update with ownership check
router.put('/:id', async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // IDOR ownership check — bypassed in PENTEST_MODE
    if (
      !isPentestMode() &&
      !isOwnerPatient(appointment, req.user) &&
      req.user.role !== 'admin'
    ) {
      logAccessDenied(
        req.user._id,
        req.user.email,
        req.ip,
        req.headers['user-agent'],
        req.originalUrl,
        'IDOR attempt - update'
      );
      return res
        .status(403)
        .json({ message: 'Access denied. You do not own this resource.' });
    }

    const parsed = validateOrBypass(updateSchema, req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: parsed.error.issues.map((i) => i.message),
      });
    }

    Object.assign(appointment, parsed.data);
    if (parsed.data.notes !== undefined) {
      appointment.notes = encrypt(sanitizeInput(parsed.data.notes));
    }
    await appointment.save();

    const result = appointment.toObject();
    if (result.notes) result.notes = decrypt(result.notes);

    // Real-time: notify both participants of the status/detail change
    const emitAppointmentUpdate = req.app.get('emitAppointmentUpdate');
    if (emitAppointmentUpdate) emitAppointmentUpdate(appointment);

    return res.status(200).json({ appointment: result });
  } catch (err) {
    return respondError(res, 500, 'Failed to update appointment', err);
  }
});

// DELETE /api/appointments/:id - delete with ownership check (patient or admin)
router.delete('/:id', async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // IDOR check: only the owning patient or an admin may delete
    // (bypassed in PENTEST_MODE)
    const isOwner =
      appointment.patient.toString() === req.user._id.toString();
    if (!isPentestMode() && !isOwner && req.user.role !== 'admin') {
      await logAccessDenied(
        req.user._id,
        req.user.email,
        req.ip,
        req.headers['user-agent'],
        req.originalUrl,
        'IDOR attempt - delete'
      );
      return res
        .status(403)
        .json({ message: 'Access denied. You do not own this resource.' });
    }

    // Real-time: notify both participants before the record is removed
    const emitAppointmentUpdate = req.app.get('emitAppointmentUpdate');
    if (emitAppointmentUpdate) {
      emitAppointmentUpdate({ ...appointment.toObject(), status: 'cancelled' });
    }

    await Appointment.findByIdAndDelete(req.params.id);

    return res
      .status(200)
      .json({ message: 'Appointment cancelled successfully' });
  } catch (err) {
    return respondError(res, 500, 'Failed to cancel appointment', err);
  }
});

module.exports = router;
