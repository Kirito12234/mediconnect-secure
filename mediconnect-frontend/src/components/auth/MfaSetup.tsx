import React, { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../services/api';

interface SetupData {
  qrCode: string;
  secret: string;
  recoveryCodes: string[];
}

const MfaSetup: React.FC = () => {
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  const beginSetup = async () => {
    setLoading(true);
    try {
      const { data } = await api.post<SetupData>('/auth/mfa/setup');
      setSetup(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not start MFA setup');
    } finally {
      setLoading(false);
    }
  };

  const verifySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setup) return;
    try {
      await api.post('/auth/mfa/verify-setup', {
        token,
        secret: setup.secret,
        recoveryCodes: setup.recoveryCodes,
      });
      toast.success('MFA enabled');
      setSetup(null);
      setToken('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Verification failed');
    }
  };

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 360 }}>
      <h3>Two-factor authentication</h3>
      {!setup ? (
        <button type="button" onClick={beginSetup} disabled={loading}>
          {loading ? 'Loading...' : 'Set up MFA'}
        </button>
      ) : (
        <form onSubmit={verifySetup} style={{ display: 'grid', gap: 12 }}>
          <img src={setup.qrCode} alt="MFA QR code" width={180} height={180} />
          <p>Scan with an authenticator app, then enter the 6-digit code.</p>
          <div>
            <strong>Recovery codes (store safely):</strong>
            <ul>
              {setup.recoveryCodes.map((c) => (
                <li key={c}><code>{c}</code></li>
              ))}
            </ul>
          </div>
          <input
            placeholder="6-digit code"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            maxLength={6}
            inputMode="numeric"
            required
          />
          <button type="submit">Verify and enable</button>
        </form>
      )}
    </div>
  );
};

export default MfaSetup;
