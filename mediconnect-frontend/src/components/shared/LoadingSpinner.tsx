import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: number;
  label?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 32,
  label = 'Loading...',
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 24,
    }}
    role="status"
    aria-live="polite"
  >
    <Loader2 className="spin" size={size} />
    <span>{label}</span>
  </div>
);

export default LoadingSpinner;
