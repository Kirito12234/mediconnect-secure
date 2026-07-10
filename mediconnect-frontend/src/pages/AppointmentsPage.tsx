import React, { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { CalendarPlus } from 'lucide-react';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import AppointmentCard, {
  Appointment,
} from '../components/dashboard/AppointmentCard';
import api from '../services/api';

const TEAL = '#0d9488';
const TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00'];
const TYPES = [
  'General Consultation',
  'Follow-up',
  'Emergency',
  'Specialist Referral',
];

const emptyForm = {
  doctor: 'Dr. Smith',
  date: '',
  time: TIME_SLOTS[0],
  type: TYPES[0],
  notes: '',
};

const AppointmentsPage: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ appointments: Appointment[] }>(
        '/appointments'
      );
      setAppointments(data.appointments);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date) {
      toast.error('Please choose a date');
      return;
    }
    setSubmitting(true);
    try {
      // CSRF token (X-CSRF-Token) is attached automatically by the api interceptor
      await api.post('/appointments', form);
      toast.success('Appointment booked successfully');
      setForm({ ...emptyForm });
      setShowForm(false);
      load();
    } catch (err: any) {
      const data = err?.response?.data;
      if (Array.isArray(data?.errors)) {
        data.errors.forEach((m: string) => toast.error(m));
      } else {
        toast.error(data?.message || 'Failed to book appointment');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    const result = await Swal.fire({
      title: 'Cancel appointment?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, cancel it',
      confirmButtonColor: '#dc2626',
    });
    if (!result.isConfirmed) return;

    try {
      await api.delete(`/appointments/${id}`);
      toast.success('Appointment cancelled');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not cancel');
    }
  };

  return (
    <DashboardLayout>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h1 style={{ marginTop: 0, color: '#065f46' }}>Appointments</h1>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          style={styles.bookBtn}
        >
          <CalendarPlus size={18} /> {showForm ? 'Close' : 'Book Appointment'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Doctor
            <input
              style={styles.input}
              name="doctor"
              value={form.doctor}
              onChange={handleChange}
              placeholder="Dr. Smith"
              required
            />
          </label>
          <label style={styles.label}>
            Date
            <input
              style={styles.input}
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              required
            />
          </label>
          <label style={styles.label}>
            Time
            <select
              style={styles.input}
              name="time"
              value={form.time}
              onChange={handleChange}
            >
              {TIME_SLOTS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.label}>
            Type
            <select
              style={styles.input}
              name="type"
              value={form.type}
              onChange={handleChange}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label style={styles.label}>
            Notes
            <textarea
              style={{ ...styles.input, minHeight: 70, resize: 'vertical' }}
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="Optional notes"
            />
          </label>
          <button type="submit" style={styles.submitBtn} disabled={submitting}>
            {submitting ? 'Booking...' : 'Submit'}
          </button>
        </form>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div style={{ display: 'grid', gap: 12, maxWidth: 480, marginTop: 20 }}>
          {appointments.map((appt) => (
            <AppointmentCard
              key={appt._id}
              appointment={appt}
              onCancel={handleCancel}
            />
          ))}
          {appointments.length === 0 && <p>No appointments yet.</p>}
        </div>
      )}
    </DashboardLayout>
  );
};

const styles: Record<string, React.CSSProperties> = {
  bookBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    borderRadius: 10,
    border: 'none',
    background: TEAL,
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  form: {
    display: 'grid',
    gap: 12,
    maxWidth: 420,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
  },
  label: { display: 'grid', gap: 4, fontSize: 14, color: '#374151' },
  input: {
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    fontSize: 15,
    outline: 'none',
  },
  submitBtn: {
    padding: '12px 14px',
    borderRadius: 10,
    border: 'none',
    background: TEAL,
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },
};

export default AppointmentsPage;
