import React, { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import AppointmentCard, {
  Appointment,
} from '../components/dashboard/AppointmentCard';
import api from '../services/api';

const AppointmentsPage: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleCancel = async (id: string) => {
    const result = await Swal.fire({
      title: 'Cancel appointment?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, cancel it',
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
      <h1>Appointments</h1>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div style={{ display: 'grid', gap: 12, maxWidth: 480 }}>
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

export default AppointmentsPage;
