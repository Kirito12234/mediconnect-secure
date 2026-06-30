import React from 'react';
import { useSocket } from '../../hooks/useSocket';

/**
 * Headless component that keeps a Socket.IO connection alive while the user
 * is authenticated and surfaces incoming notifications as toasts.
 */
const SocketListener: React.FC = () => {
  useSocket();
  return null;
};

export default SocketListener;
