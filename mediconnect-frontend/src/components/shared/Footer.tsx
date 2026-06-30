import React from 'react';

const Footer: React.FC = () => (
  <footer
    style={{
      padding: '16px 24px',
      borderTop: '1px solid #e5e7eb',
      textAlign: 'center',
      color: '#6b7280',
      fontSize: 14,
    }}
  >
    &copy; {new Date().getFullYear()} MediConnect. All rights reserved.
  </footer>
);

export default Footer;
