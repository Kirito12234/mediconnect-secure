import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const MfaVerify: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const mfaToken = (location.state as { mfaToken?: string })?.mfaToken;

  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: Record<string, string> = { mfaToken: mfaToken || '' };
      if (useRecovery) payload.recoveryCode = recoveryCode;
      else payload.code = code;

      const { data } = await api.post('/auth/mfa/verify', payload);
      setUser(data.user);
      toast.success('Verified');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, maxWidth: 360 }}>
      <h2>Two-factor verification</h2>
      {useRecovery ? (
        <input
          placeholder="Recovery code"
          value={recoveryCode}
          onChange={(e) => setRecoveryCode(e.target.value)}
          required
        />
      ) : (
        <input
          placeholder="6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          maxLength={6}
          required
        />
      )}
      <button type="button" onClick={() => setUseRecovery(!useRecovery)}>
        {useRecovery ? 'Use authenticator code' : 'Use a recovery code'}
      </button>
      <button type="submit" disabled={submitting}>
        {submitting ? 'Verifying...' : 'Verify'}
      </button>
    </form>
  );
};

export default MfaVerify;
