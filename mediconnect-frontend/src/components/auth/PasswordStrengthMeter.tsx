import React from 'react';

// 0-4 strength score (matches the registration policy)
export const calculateStrength = (password: string): number => {
  let strength = 0;
  if (password.length >= 8) strength += 1;
  if (password.length >= 12) strength += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength += 1;
  if (/[0-9]/.test(password)) strength += 1;
  if (/[^A-Za-z0-9]/.test(password)) strength += 1;
  return Math.min(strength, 4);
};

const STRENGTH_META = [
  { label: 'Very Weak', color: '#dc2626' },
  { label: 'Weak', color: '#f97316' },
  { label: 'Fair', color: '#eab308' },
  { label: 'Strong', color: '#84cc16' },
  { label: 'Excellent! Your password is strong and secure.', color: '#16a34a' },
];

interface PasswordStrengthMeterProps {
  password: string;
}

const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  password,
}) => {
  if (!password) return null;
  const strength = calculateStrength(password);
  const meta = STRENGTH_META[strength];

  return (
    <div>
      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: '#e5e7eb',
          overflow: 'hidden',
          marginBottom: 4,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${((strength + 1) / 5) * 100}%`,
            backgroundColor: meta.color,
            transition: 'width 0.3s ease, background-color 0.3s ease',
          }}
        />
      </div>
      <small style={{ color: meta.color }}>{meta.label}</small>
    </div>
  );
};

export default PasswordStrengthMeter;
