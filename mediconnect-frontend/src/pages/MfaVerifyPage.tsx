import React from 'react';
import MfaVerify from '../components/auth/MfaVerify';

const MfaVerifyPage: React.FC = () => (
  <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
    <MfaVerify />
  </div>
);

export default MfaVerifyPage;
