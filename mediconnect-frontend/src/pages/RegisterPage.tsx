import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { User, Stethoscope, Check, X } from 'lucide-react';
import ReCAPTCHA from 'react-google-recaptcha';
import { useAuth } from '../context/AuthContext';
import { validatePassword } from '../utils/passwordValidator';
import GoogleLoginButton from '../components/auth/GoogleLoginButton';

const RECAPTCHA_SITE_KEY = process.env.REACT_APP_RECAPTCHA_SITE_KEY || '';

type Role = 'user' | 'doctor';

interface StrengthMeta {
  label: string;
  color: string;
}

// 0-4 strength score per the documented policy
const calculateStrength = (password: string): number => {
  let strength = 0;
  if (password.length >= 8) strength += 1;
  if (password.length >= 12) strength += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength += 1;
  if (/[0-9]/.test(password)) strength += 1;
  if (/[^A-Za-z0-9]/.test(password)) strength += 1;
  return Math.min(strength, 4);
};

const STRENGTH_META: StrengthMeta[] = [
  { label: 'Very Weak', color: '#dc2626' },
  { label: 'Weak', color: '#f97316' },
  { label: 'Fair', color: '#eab308' },
  { label: 'Strong', color: '#84cc16' },
  { label: 'Excellent! Your password is strong and secure.', color: '#16a34a' },
];

const TEAL = '#0d9488';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [role, setRole] = useState<Role>('user');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const passwordErrors = useMemo(
    () => (password ? validatePassword(password).errors : []),
    [password]
  );
  const strength = useMemo(() => calculateStrength(password), [password]);
  const strengthMeta = STRENGTH_META[strength];
  const passwordsMatch =
    confirmPassword.length === 0 || password === confirmPassword;

  const canSubmit =
    name.trim() &&
    phone.trim() &&
    phone.length >= 10 &&
    email.trim() &&
    password &&
    confirmPassword &&
    passwordErrors.length === 0 &&
    password === confirmPassword &&
    (!RECAPTCHA_SITE_KEY || !!captchaToken);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await register({
        name,
        phone,
        email,
        password,
        role,
        captchaToken: captchaToken || undefined,
      });
      toast.success('Registration successful. Please log in.');
      navigate('/login');
    } catch (err: any) {
      const data = err?.response?.data;
      if (Array.isArray(data?.errors)) {
        data.errors.forEach((e: any) =>
          toast.error(typeof e === 'string' ? e : e.message)
        );
      } else {
        toast.error(data?.message || 'Registration failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Create your MediConnect account</h1>

        {/* Role selector */}
        <div style={styles.roleRow}>
          <button
            type="button"
            onClick={() => setRole('user')}
            style={{
              ...styles.roleButton,
              ...(role === 'user' ? styles.roleButtonActive : {}),
            }}
          >
            <User size={18} /> Patient
          </button>
          <button
            type="button"
            onClick={() => setRole('doctor')}
            style={{
              ...styles.roleButton,
              ...(role === 'doctor' ? styles.roleButtonActive : {}),
            }}
          >
            <Stethoscope size={18} /> Doctor
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            style={styles.input}
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="tel"
            placeholder="Enter your 10-digit phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
            required
            minLength={10}
            maxLength={15}
          />
          {phone.length > 0 && phone.length < 10 && (
            <small style={{ color: '#dc2626' }}>
              Phone must be at least 10 digits
            </small>
          )}

          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          {/* Strength meter */}
          {password && (
            <div>
              <div style={styles.meterTrack}>
                <div
                  style={{
                    ...styles.meterFill,
                    width: `${((strength + 1) / 5) * 100}%`,
                    backgroundColor: strengthMeta.color,
                  }}
                />
              </div>
              <small style={{ color: strengthMeta.color }}>
                {strengthMeta.label}
              </small>
            </div>
          )}

          {/* Real-time validation errors */}
          {passwordErrors.length > 0 && (
            <ul style={styles.errorList}>
              {passwordErrors.map((err) => (
                <li key={err} style={styles.errorItem}>
                  <X size={14} /> {err}
                </li>
              ))}
            </ul>
          )}

          <input
            style={styles.input}
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          {!passwordsMatch && (
            <small style={styles.matchError}>
              <X size={14} /> Passwords do not match
            </small>
          )}
          {confirmPassword && passwordsMatch && (
            <small style={styles.matchOk}>
              <Check size={14} /> Passwords match
            </small>
          )}

          {RECAPTCHA_SITE_KEY && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <ReCAPTCHA
                sitekey={RECAPTCHA_SITE_KEY}
                onChange={(token) => setCaptchaToken(token)}
                onExpired={() => setCaptchaToken(null)}
              />
            </div>
          )}

          <button
            type="submit"
            style={{
              ...styles.submit,
              ...(canSubmit ? {} : styles.submitDisabled),
            }}
            disabled={!canSubmit || submitting}
          >
            {submitting ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <GoogleLoginButton label="Sign up with Google" />

        <p style={styles.footer}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: TEAL }}>
            Sign in
          </Link>
        </p>
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
    maxWidth: 420,
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
  roleRow: { display: 'flex', gap: 12, marginBottom: 20 },
  roleButton: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #d1d5db',
    background: '#fff',
    cursor: 'pointer',
    color: '#374151',
  },
  roleButtonActive: {
    borderColor: TEAL,
    background: '#ccfbf1',
    color: '#065f46',
    fontWeight: 600,
  },
  form: { display: 'grid', gap: 14 },
  input: {
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid #d1d5db',
    fontSize: 15,
    outline: 'none',
  },
  meterTrack: {
    height: 8,
    borderRadius: 4,
    background: '#e5e7eb',
    overflow: 'hidden',
    marginBottom: 4,
  },
  meterFill: {
    height: '100%',
    transition: 'width 0.3s ease, background-color 0.3s ease',
  },
  errorList: { margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4 },
  errorItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: '#dc2626',
    fontSize: 13,
  },
  matchError: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: '#dc2626',
  },
  matchOk: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: '#16a34a',
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
  submitDisabled: {
    background: '#9ca3af',
    cursor: 'not-allowed',
  },
  footer: { textAlign: 'center', marginTop: 20, color: '#6b7280' },
};

export default RegisterPage;
