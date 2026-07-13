import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  User,
  Settings,
  ShieldCheck,
  Shield,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const TEAL = '#0d9488';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/appointments', label: 'Appointments', icon: Calendar },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/2fa-setup', label: 'Setup 2FA', icon: ShieldCheck },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const items = [...navItems];
  if (user?.role === 'admin') {
    items.push({ to: '/admin', label: 'Admin', icon: Shield });
  }

  return (
    <aside style={styles.sidebar}>
      <div style={styles.brand}>MediConnect</div>
      <nav style={styles.nav}>
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              ...styles.link,
              ...(isActive ? styles.linkActive : {}),
            })}
          >
            <Icon size={18} /> {label}
          </NavLink>
        ))}
      </nav>
      <button type="button" onClick={handleLogout} style={styles.logout}>
        <LogOut size={18} /> Logout
      </button>
    </aside>
  );
};

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 220,
    background: '#065f46',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 16px',
    minHeight: '100vh',
  },
  brand: { fontSize: 20, fontWeight: 700, marginBottom: 32, paddingLeft: 8 },
  nav: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  link: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 8,
    color: '#d1fae5',
    textDecoration: 'none',
  },
  linkActive: { background: TEAL, color: '#fff', fontWeight: 600 },
  logout: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    color: '#d1fae5',
    cursor: 'pointer',
    fontSize: 15,
  },
};

export default Sidebar;
