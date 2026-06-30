import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import ChangePassword from '../components/auth/ChangePassword';
import { useAuth } from '../context/AuthContext';

const TEAL = '#0d9488';

const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const expired = (location.state as { expired?: boolean })?.expired === true;

  const handleSuccess = async () => {
    if (expired) {
      // Force a fresh login after an expiry-driven change
      await logout();
      navigate('/login');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {expired && (
          <div style={styles.banner}>
            <AlertTriangle size={18} />
            <span>
              Your password has expired (90 days). Please set a new password.
            </span>
          </div>
        )}

        <ChangePassword onSuccess={handleSuccess} />

        {!expired && (
          <button
            type="button"
            style={styles.linkBtn}
            onClick={() => navigate('/dashboard')}
          >
            Back to dashboard
          </button>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    background: '#fff',
    borderRadius: 16,
    padding: 32,
    boxShadow: '0 10px 30px rgba(13, 148, 136, 0.15)',
  },
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#fef3c7',
    color: '#92400e',
    padding: '10px 12px',
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 14,
  },
  linkBtn: {
    marginTop: 16,
    border: 'none',
    background: 'transparent',
    color: TEAL,
    cursor: 'pointer',
    fontSize: 14,
  },
};

export default ChangePasswordPage;
