import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import GoogleLoginButton from '../components/auth/GoogleLoginButton';

const TEAL = '#0d9488';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, setUser, checkAuth } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // MFA modal state
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [mfaError, setMfaError] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Surface errors handed back by the Google OAuth callback redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'google_auth_failed') {
      toast.error('Google sign-in failed. Please try again.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await login(email, password);

      // 2. MFA required
      if (result.mfaRequired && result.mfaToken) {
        setMfaToken(result.mfaToken);
        setMfaOpen(true);
        return;
      }

      // 4. Success without MFA
      if (result.user) {
        toast.success('Welcome back!');
        navigate('/dashboard');
      }
    } catch (err: any) {
      if (err.response) {
        const status = err.response.status;
        const data = err.response.data;
        const message = data?.message || data?.error;

        if (status === 401) {
          toast.error(message || 'Invalid email or password');
        } else if (status === 423) {
          toast.error(message || 'Account is locked. Please try again later.');
        } else if (status === 429) {
          toast.error(
            message || 'Too many login attempts. Please try again in 15 minutes.'
          );
        } else if (status === 403 && data?.passwordExpired) {
          toast.warning('Your password has expired. Please change it.');
          // The expiry response sets a session cookie; refresh auth state so
          // the protected /change-password route is accessible.
          await checkAuth();
          navigate('/change-password', { state: { expired: true } });
        } else {
          toast.error(message || 'Login failed. Please try again.');
        }
      } else {
        toast.error('Network error. Please check your connection.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaError('');
    setVerifying(true);
    try {
      const payload: Record<string, string> = { mfaToken };
      if (useRecovery) payload.recoveryCode = recoveryCode;
      else payload.code = code;

      const { data } = await api.post('/auth/mfa/verify', payload);
      setUser(data.user);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err: any) {
      setMfaError('Invalid verification code. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Sign in to MediConnect</h1>

        <form onSubmit={handleLogin} style={styles.form}>
          <input
            style={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <button type="submit" style={styles.submit} disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <GoogleLoginButton label="Login with Google" />

        <p style={styles.footer}>
          No account?{' '}
          <Link to="/register" style={{ color: TEAL }}>
            Register
          </Link>
        </p>
      </div>

      {/* MFA verification modal */}
      {mfaOpen && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={{ margin: 0, color: '#065f46' }}>
                Two-factor verification
              </h2>
              <button
                type="button"
                onClick={() => setMfaOpen(false)}
                style={styles.closeBtn}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleVerifyMfa} style={styles.form}>
              {useRecovery ? (
                <input
                  style={styles.input}
                  placeholder="Recovery code"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  required
                />
              ) : (
                <input
                  style={styles.input}
                  placeholder="6-digit code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                  required
                />
              )}

              {mfaError && <small style={styles.error}>{mfaError}</small>}

              <button type="submit" style={styles.submit} disabled={verifying}>
                {verifying ? 'Verifying...' : 'Verify'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setUseRecovery(!useRecovery);
                  setMfaError('');
                }}
                style={styles.linkBtn}
              >
                {useRecovery
                  ? 'Use authenticator code instead'
                  : 'Use recovery code instead'}
              </button>
            </form>
          </div>
        </div>
      )}
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
  title: {
    margin: '0 0 24px',
    fontSize: 22,
    color: '#065f46',
    textAlign: 'center',
  },
  form: { display: 'grid', gap: 14 },
  input: {
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid #d1d5db',
    fontSize: 15,
    outline: 'none',
  },
  submit: {
    padding: '12px 14px',
    borderRadius: 10,
    border: 'none',
    background: TEAL,
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
    cursor: 'pointer',
  },
  footer: { textAlign: 'center', marginTop: 20, color: '#6b7280' },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'grid',
    placeItems: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 380,
    background: '#fff',
    borderRadius: 16,
    padding: 28,
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  closeBtn: {
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: '#6b7280',
  },
  linkBtn: {
    border: 'none',
    background: 'transparent',
    color: TEAL,
    cursor: 'pointer',
    fontSize: 14,
  },
  error: { color: '#dc2626' },
};

export default LoginPage;
