import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import AccessDeniedPage from '../../pages/AccessDeniedPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Restrict to specific roles. If omitted, any authenticated user is allowed. */
  allowedRoles?: Array<'user' | 'doctor' | 'admin'>;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner label="Checking session..." />;
  }

  // Not authenticated -> redirect to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authenticated but wrong role -> show Access Denied
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <AccessDeniedPage />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
