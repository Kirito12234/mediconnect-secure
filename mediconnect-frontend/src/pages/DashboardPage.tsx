import React, { useEffect, useState } from 'react';
import { Calendar, CalendarCheck, ShieldCheck } from 'lucide-react';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import AuditLogTable, {
  AuditLogEntry,
} from '../components/dashboard/AuditLogTable';
import { Appointment } from '../components/dashboard/AppointmentCard';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [apptRes, logRes] = await Promise.all([
          api.get<{ appointments: Appointment[] }>('/appointments'),
          api.get<{ logs: AuditLogEntry[] }>('/users/audit-log'),
        ]);
        setAppointments(apptRes.data.appointments);
        setLogs(logRes.data.logs.slice(0, 5));
      } catch {
        // errors surface via the global interceptor
      }
    };
    load();
  }, []);

  const now = Date.now();
  const upcoming = appointments.filter(
    (a) =>
      new Date(a.date).getTime() >= now &&
      a.status !== 'cancelled' &&
      a.status !== 'completed'
  ).length;

  return (
    <DashboardLayout>
      <h1 style={{ marginTop: 0, color: '#065f46' }}>
        Welcome, {user?.name}
      </h1>
      <p style={{ color: '#6b7280' }}>Here's an overview of your account.</p>

      <div style={styles.statsRow}>
        <StatCard
          icon={<Calendar size={24} color="#0d9488" />}
          label="Upcoming appointments"
          value={upcoming}
        />
        <StatCard
          icon={<CalendarCheck size={24} color="#0d9488" />}
          label="Total appointments"
          value={appointments.length}
        />
        <StatCard
          icon={<ShieldCheck size={24} color="#0d9488" />}
          label="Account status"
          value={user?.mfaEnabled ? '2FA enabled' : 'Active'}
        />
      </div>

      <section style={styles.card}>
        <h2 style={{ marginTop: 0 }}>Recent activity</h2>
        <AuditLogTable logs={logs} />
      </section>
    </DashboardLayout>
  );
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number | string;
}> = ({ icon, label, value }) => (
  <div style={styles.statCard}>
    {icon}
    <div style={{ fontSize: 26, fontWeight: 700, color: '#065f46' }}>
      {value}
    </div>
    <div style={{ color: '#6b7280' }}>{label}</div>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  statsRow: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
    margin: '24px 0',
  },
  statCard: {
    flex: '1 1 180px',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 20,
    display: 'grid',
    gap: 6,
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 20,
  },
};

export default DashboardPage;
