import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/shared/LoadingSpinner';

/**
 * OAuth landing route (/auth/callback).
 *
 * The backend completes the Google flow, sets the httpOnly session cookie, then
 * redirects the browser here. There is intentionally NO token in the URL — that
 * would leak the JWT into browser history and defeat the httpOnly XSS
 * protection. We just wait for AuthProvider to resolve the session (via the
 * cookie) and forward the user on.
 */
const AuthCallback: React.FC = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) {
      toast.error('Google sign-in failed. Please try again.');
      navigate('/login', { replace: true });
      return;
    }

    if (user) {
      toast.success('Signed in with Google');
      navigate('/dashboard', { replace: true });
    } else {
      // No session resolved (cookie missing/expired) — back to login.
      navigate('/login', { replace: true });
    }
  }, [user, loading, navigate]);

  return <LoadingSpinner label="Completing sign-in..." />;
};

export default AuthCallback;
