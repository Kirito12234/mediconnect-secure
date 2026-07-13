import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const TEAL = '#0d9488';

interface SetupData {
  qrCode: string;
  secret: string;
  recoveryCodes: string[];
}

/**
 * Dedicated two-factor (TOTP) setup page.
 *
 * Flow (uses the existing MFA backend endpoints):
 *   1. "Enable 2FA"  -> POST /api/auth/mfa/setup        => { qrCode, secret, recoveryCodes }
 *   2. Scan the QR, enter the 6-digit code
 *   3. "Verify"      -> POST /api/auth/mfa/verify-setup => enables 2FA on the account
 */
const TwoFactorSetup: React.FC = () => {
  const { user, checkAuth } = useAuth();

  const [setup, setSetup] = useState<SetupData | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);

  // Step 1: request a secret + QR code from the server.
  const enable2fa = async () => {
    setBusy(true);
    try {
      const { data } = await api.post<SetupData>('/auth/mfa/setup');
      setSetup(data);
      setVerified(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not start 2FA setup');
    } finally {
      setBusy(false);
    }
  };

  // Step 3: verify the 6-digit OTP and enable 2FA.
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setup) return;
    setBusy(true);
    try {
      await api.post('/auth/mfa/verify-setup', {
        token: code.trim(),
        secret: setup.secret,
        recoveryCodes: setup.recoveryCodes,
      });
      setVerified(true);
      setCode('');
      toast.success('Two-factor authentication enabled');
      await checkAuth();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || 'Invalid code. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout>
      <h1 style={{ marginTop: 0, color: '#065f46' }}>Two-Factor Authentication</h1>

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>
          <ShieldCheck size={20} color={TEAL} /> Setup 2FA
        </h2>

        {/* Already enabled (or just verified) */}
        {user?.mfaEnabled || verified ? (
          <div style={styles.success}>
            <CheckCircle2 size={18} />
            Two-factor authentication is enabled on your account.
          </div>
        ) : !setup ? (
          <>
            <p style={{ color: '#6b7280' }}>
              Protect your account with a time-based one-time code from an
              authenticator app (Google Authenticator, Authy, etc.).
            </p>
            <button
              type="button"
              style={styles.primaryBtn}
              onClick={enable2fa}
              disabled={busy}
            >
              {busy ? 'Loading...' : 'Enable 2FA'}
            </button>
          </>
        ) : (
          <>
            <p>1. Scan this QR code with your authenticator app:</p>
            <img
              src={setup.qrCode}
              alt="2FA QR code"
              width={180}
              height={180}
              style={{ borderRadius: 8 }}
            />
            <p style={{ fontSize: 13, color: '#6b7280' }}>
              Or enter this secret manually: <code>{setup.secret}</code>
            </p>

            {setup.recoveryCodes?.length > 0 && (
              <div style={styles.warning}>
                <AlertTriangle size={18} />
                <div>
                  Save your recovery codes somewhere safe — they are shown once:
                  <ul style={styles.recoveryList}>
                    {setup.recoveryCodes.map((c) => (
                      <li key={c}>
                        <code>{c}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <form onSubmit={verify} style={styles.form}>
              <label style={{ fontSize: 14, color: '#374151' }}>
                2. Enter the 6-digit code
              </label>
              <input
                style={styles.input}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                maxLength={6}
                required
              />
              <button type="submit" style={styles.primaryBtn} disabled={busy}>
                {busy ? 'Verifying...' : 'Verify'}
              </button>
            </form>
          </>
        )}
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
    maxWidth: 520,
  },
  cardTitle: {
    marginTop: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#065f46',
  },
  form: { display: 'grid', gap: 12, marginTop: 12 },
  input: {
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid #d1d5db',
    fontSize: 15,
    outline: 'none',
    letterSpacing: 4,
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
  success: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#dcfce7',
    color: '#166534',
    padding: '12px 14px',
    borderRadius: 8,
  },
  warning: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    background: '#fef3c7',
    color: '#92400e',
    padding: '10px 12px',
    borderRadius: 8,
    margin: '12px 0',
  },
  recoveryList: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    padding: '8px 0 0 18px',
    margin: 0,
  },
};

export default TwoFactorSetup;
