import React, { useState } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { ShieldCheck, ShieldOff, AlertTriangle, Download } from 'lucide-react';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import PasswordStrengthMeter from '../components/auth/PasswordStrengthMeter';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { validatePassword } from '../utils/passwordValidator';

const TEAL = '#0d9488';

interface MfaSetupData {
  qrCode: string;
  secret: string;
  recoveryCodes: string[];
}

const SettingsPage: React.FC = () => {
  const { user, checkAuth } = useAuth();

  // ----- 2FA state -----
  const [setupData, setSetupData] = useState<MfaSetupData | null>(null);
  const [verifyToken, setVerifyToken] = useState('');
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [mfaBusy, setMfaBusy] = useState(false);

  // ----- Change password state -----
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwErrors, setPwErrors] = useState<string[]>([]);
  const [pwBusy, setPwBusy] = useState(false);

  // ----- 2FA: begin setup -----
  const beginSetup = async () => {
    setMfaBusy(true);
    try {
      const { data } = await api.post<MfaSetupData>('/auth/mfa/setup');
      setSetupData(data);
      setShowRecoveryCodes(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not start 2FA setup');
    } finally {
      setMfaBusy(false);
    }
  };

  // ----- 2FA: verify and enable -----
  const verifySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupData) return;
    setMfaBusy(true);
    try {
      await api.post('/auth/mfa/verify-setup', {
        token: verifyToken,
        secret: setupData.secret,
        recoveryCodes: setupData.recoveryCodes,
      });
      toast.success('Two-factor authentication enabled');
      setShowRecoveryCodes(true);
      setVerifyToken('');
      await checkAuth();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Verification failed');
    } finally {
      setMfaBusy(false);
    }
  };

  // ----- 2FA: disable (requires password) -----
  const disableMfa = async () => {
    const { value: password } = await Swal.fire({
      title: 'Disable two-factor authentication',
      input: 'password',
      inputLabel: 'Confirm your password',
      inputPlaceholder: 'Current password',
      showCancelButton: true,
      confirmButtonText: 'Disable 2FA',
      confirmButtonColor: '#dc2626',
    });
    if (!password) return;

    try {
      await api.post('/auth/mfa/disable', { password });
      toast.success('Two-factor authentication disabled');
      setSetupData(null);
      setShowRecoveryCodes(false);
      await checkAuth();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not disable 2FA');
    }
  };

  // ----- Change password -----
  const submitPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = validatePassword(newPassword);
    if (!check.valid) {
      setPwErrors(check.errors);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwErrors(['Passwords do not match']);
      return;
    }
    setPwErrors([]);
    setPwBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const data = err?.response?.data;
      if (Array.isArray(data?.errors)) setPwErrors(data.errors);
      toast.error(data?.message || 'Could not change password');
    } finally {
      setPwBusy(false);
    }
  };

  // ----- Export personal data -----
  const exportData = async () => {
    try {
      const [profileRes, apptRes, logRes] = await Promise.all([
        api.get('/users/profile'),
        api.get('/appointments'),
        api.get('/users/audit-log'),
      ]);
      const payload = {
        exportedAt: new Date().toISOString(),
        profile: profileRes.data.user,
        appointments: apptRes.data.appointments,
        auditLog: logRes.data.logs,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mediconnect-data-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Your data has been downloaded');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Export failed');
    }
  };

  const passwordsMatch =
    confirmPassword.length === 0 || newPassword === confirmPassword;

  return (
    <DashboardLayout>
      <h1 style={{ marginTop: 0, color: '#065f46' }}>Settings</h1>

      {/* ---------- Two-Factor Authentication ---------- */}
      <section style={styles.card}>
        <h2 style={styles.cardTitle}>
          <ShieldCheck size={20} color={TEAL} /> Two-Factor Authentication
        </h2>

        {user?.mfaEnabled ? (
          <>
            <p style={{ color: '#16a34a' }}>2FA is currently enabled.</p>
            <button type="button" style={styles.dangerBtn} onClick={disableMfa}>
              <ShieldOff size={16} /> Disable 2FA
            </button>
          </>
        ) : !setupData ? (
          <>
            <p style={{ color: '#6b7280' }}>
              Add an extra layer of security to your account.
            </p>
            <button
              type="button"
              style={styles.primaryBtn}
              onClick={beginSetup}
              disabled={mfaBusy}
            >
              {mfaBusy ? 'Loading...' : 'Enable 2FA'}
            </button>
          </>
        ) : showRecoveryCodes ? (
          <div>
            <h3 style={{ color: '#065f46' }}>Save Your Recovery Codes</h3>
            <div style={styles.warning}>
              <AlertTriangle size={18} />
              These codes will only be shown once. Save them in a safe place!
            </div>
            <ul style={styles.recoveryList}>
              {setupData.recoveryCodes.map((c) => (
                <li key={c}>
                  <code>{c}</code>
                </li>
              ))}
            </ul>
            <button
              type="button"
              style={styles.primaryBtn}
              onClick={() => {
                setSetupData(null);
                setShowRecoveryCodes(false);
              }}
            >
              I've saved my codes
            </button>
          </div>
        ) : (
          <form onSubmit={verifySetup} style={styles.form}>
            <p>Scan this QR code with your authenticator app:</p>
            <img
              src={setupData.qrCode}
              alt="2FA QR code"
              width={180}
              height={180}
            />
            <p style={{ fontSize: 13, color: '#6b7280' }}>
              Or enter this secret manually: <code>{setupData.secret}</code>
            </p>
            <input
              style={styles.input}
              placeholder="6-digit code"
              value={verifyToken}
              onChange={(e) => setVerifyToken(e.target.value)}
              maxLength={6}
              inputMode="numeric"
              required
            />
            <button
              type="submit"
              style={styles.primaryBtn}
              disabled={mfaBusy}
            >
              {mfaBusy ? 'Verifying...' : 'Verify and enable'}
            </button>
          </form>
        )}
      </section>

      {/* ---------- Change Password ---------- */}
      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Change Password</h2>
        <form onSubmit={submitPasswordChange} style={styles.form}>
          <input
            style={styles.input}
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <input
            style={styles.input}
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          <PasswordStrengthMeter password={newPassword} />
          <input
            style={styles.input}
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          {!passwordsMatch && (
            <small style={{ color: '#dc2626' }}>Passwords do not match</small>
          )}
          {pwErrors.length > 0 && (
            <ul style={{ color: '#dc2626', margin: 0, paddingLeft: 18 }}>
              {pwErrors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          )}
          <button type="submit" style={styles.primaryBtn} disabled={pwBusy}>
            {pwBusy ? 'Saving...' : 'Update password'}
          </button>
        </form>
      </section>

      {/* ---------- Export My Data ---------- */}
      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Export My Data</h2>
        <p style={{ color: '#6b7280' }}>
          Download a copy of your personal data, appointments, and account
          activity as a JSON file.
        </p>
        <button type="button" style={styles.primaryBtn} onClick={exportData}>
          <Download size={16} /> Download my data
        </button>
      </section>
    </DashboardLayout>
  );
};

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    maxWidth: 520,
  },
  cardTitle: {
    marginTop: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#065f46',
  },
  form: { display: 'grid', gap: 12 },
  input: {
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid #d1d5db',
    fontSize: 15,
    outline: 'none',
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 16px',
    borderRadius: 10,
    border: 'none',
    background: TEAL,
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  dangerBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    borderRadius: 10,
    border: 'none',
    background: '#dc2626',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  warning: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#fef3c7',
    color: '#92400e',
    padding: '10px 12px',
    borderRadius: 8,
    margin: '8px 0',
  },
  recoveryList: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    background: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    listStyle: 'none',
  },
};

export default SettingsPage;
