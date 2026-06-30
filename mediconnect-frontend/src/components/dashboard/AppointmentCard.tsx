import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock } from 'lucide-react';

export interface Appointment {
  _id: string;
  patient: { name: string; email: string } | string;
  doctor: { name: string; email: string } | string;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
}

interface AppointmentCardProps {
  appointment: Appointment;
  onCancel?: (id: string) => void;
}

const statusColors: Record<Appointment['status'], string> = {
  pending: '#f59e0b',
  confirmed: '#10b981',
  completed: '#6b7280',
  cancelled: '#dc2626',
};

const AppointmentCard: React.FC<AppointmentCardProps> = ({
  appointment,
  onCancel,
}) => {
  const doctorName =
    typeof appointment.doctor === 'string'
      ? appointment.doctor
      : appointment.doctor.name;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 16,
        display: 'grid',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong>Dr. {doctorName}</strong>
        <span style={{ color: statusColors[appointment.status] }}>
          {appointment.status}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 16, color: '#6b7280' }}>
        <span><Calendar size={16} /> {new Date(appointment.date).toLocaleDateString()}</span>
        <span><Clock size={16} /> {appointment.time}</span>
      </div>
      {appointment.notes && <p>{appointment.notes}</p>}
      {onCancel && appointment.status !== 'cancelled' && (
        <button type="button" onClick={() => onCancel(appointment._id)}>
          Cancel
        </button>
      )}
    </motion.div>
  );
};

export default AppointmentCard;
