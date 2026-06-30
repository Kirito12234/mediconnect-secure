import React, { ReactNode } from 'react';
import Sidebar from '../shared/Sidebar';

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => (
  <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
    <Sidebar />
    <main style={{ flex: 1, padding: 32, overflowX: 'hidden' }}>{children}</main>
  </div>
);

export default DashboardLayout;
