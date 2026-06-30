import React from 'react';
import { Link } from 'react-router-dom';

const AccessDeniedPage: React.FC = () => (
  <div style={{ textAlign: 'center', padding: '50px' }}>
    <h1 style={{ color: 'red', fontSize: '48px', margin: 0 }}>403</h1>
    <h2>Access Denied</h2>
    <p>You do not have permission to access this page.</p>
    <Link to="/dashboard" style={{ color: '#0d9488' }}>
      Return to Dashboard
    </Link>
  </div>
);

export default AccessDeniedPage;
