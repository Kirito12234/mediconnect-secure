import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const ProfilePage: React.FC = () => {
  const { user, checkAuth } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone || '');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/users/profile', { name, phone });
      await checkAuth();
      toast.success('Profile updated');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <h1>Profile</h1>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, maxWidth: 360 }}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <p>Email: {user?.email}</p>
        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </form>
    </DashboardLayout>
  );
};

export default ProfilePage;
