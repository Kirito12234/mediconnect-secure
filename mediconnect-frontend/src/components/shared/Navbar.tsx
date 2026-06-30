import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, Calendar, User, Settings, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '12px 24px',
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      <strong style={{ marginRight: 'auto' }}>MediConnect</strong>
      <Link to="/dashboard"><LayoutDashboard size={18} /> Dashboard</Link>
      <Link to="/appointments"><Calendar size={18} /> Appointments</Link>
      <Link to="/profile"><User size={18} /> Profile</Link>
      <Link to="/settings"><Settings size={18} /> Settings</Link>
      {user.role === 'admin' && (
        <Link to="/admin"><Shield size={18} /> Admin</Link>
      )}
      <button onClick={handleLogout} type="button">
        <LogOut size={18} /> Logout
      </button>
    </nav>
  );
};

export default Navbar;
