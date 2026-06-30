import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { Users, Stethoscope, ShieldAlert, Lock } from 'lucide-react';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import AuditLogTable, {
  AuditLogEntry,
} from '../components/dashboard/AuditLogTable';
import api from '../services/api';

interface Stats {
  totalUsers: number;
  totalDoctors: number;
  failedLoginsToday: number;
  lockedAccounts: number;
  totalAppointments: number;
}

interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'doctor' | 'admin';
  lastLogin?: string;
  lockUntil?: string;
  isActive: boolean;
}

const TEAL = '#0d9488';

const AdminPage: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [actionFilter, setActionFilter] = useState<string>('all');

  const loadAll = useCallback(async () => {
    try {
      const [statsRes, usersRes, logsRes] = await Promise.all([
        api.get<Stats>('/admin/stats'),
        api.get<{ users: AdminUser[] }>('/admin/users'),
        api.get<{ logs: AuditLogEntry[] }>('/admin/audit-logs'),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data.users);
      setLogs(logsRes.data.logs);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load admin data');
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const isLocked = (u: AdminUser) =>
    !!(u.lockUntil && new Date(u.lockUntil).getTime() > Date.now());

  const handleUnlock = async (user: AdminUser) => {
    try {
      await api.put(`/admin/users/${user._id}/unlock`);
      toast.success(`${user.email} unlocked`);
      loadAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to unlock');
    }
  };

  const handleChangeRole = async (user: AdminUser) => {
    const { value: role } = await Swal.fire({
      title: `Change role for ${user.email}`,
      input: 'select',
      inputOptions: { user: 'Patient', doctor: 'Doctor', admin: 'Admin' },
      inputValue: user.role,
      showCancelButton: true,
      confirmButtonText: 'Update role',
      confirmButtonColor: TEAL,
    });
    if (!role || role === user.role) return;

    try {
      await api.put(`/admin/users/${user._id}/role`, { role });
      toast.success('Role updated');
      loadAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update role');
    }
  };

  const actionTypes = Array.from(new Set(logs.map((l) => l.action))).sort();
  const filteredLogs =
    actionFilter === 'all'
      ? logs
      : logs.filter((l) => l.action === actionFilter);

  return (
    <DashboardLayout>
      <h1 style={{ marginTop: 0, color: '#065f46' }}>Admin Panel</h1>

      {/* Stats cards */}
      {stats && (
        <div style={styles.statsRow}>
          <StatCard
            icon={<Users size={22} color={TEAL} />}
            label="Total Users"
            value={stats.totalUsers}
          />
          <StatCard
            icon={<Stethoscope size={22} color={TEAL} />}
            label="Doctors"
            value={stats.totalDoctors}
          />
          <StatCard
            icon={<ShieldAlert size={22} color="#dc2626" />}
            label="Failed Logins Today"
            value={stats.failedLoginsToday}
          />
          <StatCard
            icon={<Lock size={22} color="#f59e0b" />}
            label="Locked Accounts"
            value={stats.lockedAccounts}
          />
        </div>
      )}

      {/* User management */}
      <section style={styles.card}>
        <h2 style={{ marginTop: 0 }}>User Management</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.headRow}>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Role</th>
                <th style={styles.th}>Last Login</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const locked = isLocked(u);
                return (
                  <tr key={u._id} style={styles.row}>
                    <td style={styles.td}>{u.name}</td>
                    <td style={styles.td}>{u.email}</td>
                    <td style={styles.td}>
                      <span style={styles.roleBadge}>{u.role}</span>
                    </td>
                    <td style={styles.td}>
                      {u.lastLogin
                        ? new Date(u.lastLogin).toLocaleString()
                        : 'Never'}
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          color: locked ? '#dc2626' : '#16a34a',
                          fontWeight: 600,
                        }}
                      >
                        {locked ? 'Locked' : 'Active'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          style={styles.actionBtn}
                          onClick={() => handleUnlock(u)}
                          disabled={!locked}
                        >
                          Unlock
                        </button>
                        <button
                          type="button"
                          style={styles.actionBtnOutline}
                          onClick={() => handleChangeRole(u)}
                        >
                          Change Role
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ ...styles.td, textAlign: 'center' }}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent security events */}
      <section style={styles.card}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <h2 style={{ margin: 0 }}>Recent Security Events</h2>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
            }}
          >
            <option value="all">All actions</option>
            {actionTypes.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <AuditLogTable logs={filteredLogs} />
        </div>
      </section>
    </DashboardLayout>
  );
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
}> = ({ icon, label, value }) => (
  <div style={styles.statCard}>
    {icon}
    <div style={{ fontSize: 26, fontWeight: 700, color: '#065f46' }}>
      {value}
    </div>
    <div style={{ color: '#6b7280' }}>{label}</div>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  statsRow: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap',
    margin: '24px 0',
  },
  statCard: {
    flex: '1 1 180px',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 20,
    display: 'grid',
    gap: 6,
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  headRow: { textAlign: 'left', borderBottom: '2px solid #e5e7eb' },
  th: { padding: '10px 8px', color: '#374151' },
  row: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '10px 8px' },
  roleBadge: {
    background: '#ccfbf1',
    color: '#065f46',
    borderRadius: 6,
    padding: '2px 8px',
    fontSize: 13,
    textTransform: 'capitalize',
  },
  actionBtn: {
    padding: '6px 12px',
    borderRadius: 8,
    border: 'none',
    background: TEAL,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
  },
  actionBtnOutline: {
    padding: '6px 12px',
    borderRadius: 8,
    border: `1px solid ${TEAL}`,
    background: '#fff',
    color: TEAL,
    cursor: 'pointer',
    fontSize: 13,
  },
};

export default AdminPage;
