import React from 'react';

// Backend base URL, derived the same way as the axios client (services/api.ts)
// so the flow works via localhost or a LAN/VM IP. Google OAuth is a full-page
// redirect, so this is a plain link/navigation rather than an XHR.
const API_HOST = window.location.hostname || 'localhost';
const GOOGLE_LOGIN_URL = `http://${API_HOST}:5001/api/auth/google`;

/**
 * "Continue with Google" button. Navigates the browser to the backend OAuth
 * initiation endpoint, which redirects to Google and ultimately back to the
 * app with an authenticated session cookie set.
 */
const GoogleLoginButton: React.FC<{ label?: string }> = ({
  label = 'Login with Google',
}) => (
  <div style={{ textAlign: 'center', margin: '20px 0 0' }}>
    <p style={{ color: '#6b7280', marginBottom: 12, fontSize: 13 }}>— OR —</p>
    <a
      href={GOOGLE_LOGIN_URL}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 24px',
        border: '1px solid #ddd',
        borderRadius: 8,
        textDecoration: 'none',
        color: '#333',
        backgroundColor: '#fff',
        fontSize: 14,
        fontWeight: 500,
        cursor: 'pointer',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"
        />
        <path
          fill="#34A853"
          d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01c-.72.47-1.63.77-2.7.77-2.08 0-3.84-1.4-4.47-3.29H1.83v2.07A8 8 0 0 0 8.98 17z"
        />
        <path
          fill="#FBBC05"
          d="M4.51 10.53a4.8 4.8 0 0 1 0-3.07V5.39H1.83a8 8 0 0 0 0 7.22l2.68-2.08z"
        />
        <path
          fill="#EA4335"
          d="M8.98 3.58c1.16 0 2.2.4 3.02 1.2l2.27-2.27A8 8 0 0 0 1.83 5.39l2.68 2.07c.63-1.89 2.39-3.29 4.47-3.88z"
        />
      </svg>
      {label}
    </a>
  </div>
);

export default GoogleLoginButton;
