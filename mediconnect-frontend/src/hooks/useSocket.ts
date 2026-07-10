import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const SOCKET_URL = `http://${window.location.hostname || 'localhost'}:5001`;

export interface NotificationPayload {
  type?: string;
  message: string;
}

export interface AppointmentUpdatePayload {
  appointmentId: string;
  status: string;
  date: string;
  time: string;
}

interface UseSocketOptions {
  onAppointmentUpdate?: (data: AppointmentUpdatePayload) => void;
  onNotification?: (data: NotificationPayload) => void;
}

/**
 * Connects to the backend Socket.IO server while the user is authenticated.
 * Auth is cookie-based (withCredentials), so the httpOnly access token is
 * sent automatically during the handshake. Disconnects on logout.
 */
export const useSocket = (options: UseSocketOptions = {}): Socket | null => {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    // Only connect when authenticated
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('notification', (data: NotificationPayload) => {
      toast.info(data.message);
      optionsRef.current.onNotification?.(data);
    });

    socket.on('appointment_update', (data: AppointmentUpdatePayload) => {
      toast.info(`Appointment ${data.status}`);
      optionsRef.current.onAppointmentUpdate?.(data);
    });

    socket.on('connect_error', (err) => {
      // Auth failures surface here; stay quiet to avoid noisy toasts
      console.warn('Socket connection error:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  return socketRef.current;
};

export default useSocket;
