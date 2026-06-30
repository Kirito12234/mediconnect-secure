import React from 'react';

export interface AuditLogEntry {
  _id: string;
  action: string;
  email?: string;
  ipAddress?: string;
  details?: string;
  success: boolean;
  timestamp: string;
}

interface AuditLogTableProps {
  logs: AuditLogEntry[];
}

const AuditLogTable: React.FC<AuditLogTableProps> = ({ logs }) => (
  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
    <thead>
      <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
        <th>Time</th>
        <th>Action</th>
        <th>Email</th>
        <th>IP</th>
        <th>Status</th>
        <th>Details</th>
      </tr>
    </thead>
    <tbody>
      {logs.map((log) => (
        <tr
          key={log._id}
          style={{
            borderBottom: '1px solid #f3f4f6',
            background: log.success ? 'transparent' : '#fef2f2',
          }}
        >
          <td>{new Date(log.timestamp).toLocaleString()}</td>
          <td>{log.action}</td>
          <td>{log.email || '-'}</td>
          <td>{log.ipAddress || '-'}</td>
          <td style={{ color: log.success ? '#10b981' : '#dc2626' }}>
            {log.success ? 'OK' : 'FAILED'}
          </td>
          <td>{log.details || '-'}</td>
        </tr>
      ))}
      {logs.length === 0 && (
        <tr>
          <td colSpan={6} style={{ textAlign: 'center', padding: 16 }}>
            No audit entries.
          </td>
        </tr>
      )}
    </tbody>
  </table>
);

export default AuditLogTable;
