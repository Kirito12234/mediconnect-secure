import React, { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import { validatePassword } from '../../utils/passwordValidator';
import PasswordStrengthMeter from './PasswordStrengthMeter';

interface ChangePasswordProps {
  /** Called after a successful password change (e.g. to redirect). */
  onSuccess?: () => void;
}

const ChangePassword: React.FC<ChangePasswordProps> = ({ onSuccess }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const passwordsMatch =
    confirmPassword.length === 0 || newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const check = validatePassword(newPassword);
    if (!check.valid) {
      setErrors(check.errors);
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrors(['Passwords do not match']);
      return;
    }
    setErrors([]);
    setSubmitting(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onSuccess?.();
    } catch (err: any) {
      const data = err?.response?.data;
      if (Array.isArray(data?.errors)) setErrors(data.errors);
      toast.error(data?.message || 'Could not change password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
      <h3 style={{ margin: 0, color: '#065f46' }}>Change password</h3>
      <input
        style={inputStyle}
        type="password"
        placeholder="Current password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        required
        autoComplete="current-password"
      />
      <input
        style={inputStyle}
        type="password"
        placeholder="New password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        required
        autoComplete="new-password"
      />
      <PasswordStrengthMeter password={newPassword} />
      <input
        style={inputStyle}
        type="password"
        placeholder="Confirm new password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        autoComplete="new-password"
      />
      {!passwordsMatch && (
        <small style={{ color: '#dc2626' }}>Passwords do not match</small>
      )}
      {errors.length > 0 && (
        <ul style={{ color: '#dc2626', margin: 0, paddingLeft: 18 }}>
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}
      <button type="submit" disabled={submitting} style={buttonStyle}>
        {submitting ? 'Saving...' : 'Update password'}
      </button>
    </form>
  );
};

const inputStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  fontSize: 15,
  outline: 'none',
};

const buttonStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 10,
  border: 'none',
  background: '#0d9488',
  color: '#fff',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
};

export default ChangePassword;
