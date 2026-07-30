import React, { useEffect, useState } from 'react';
import { Users, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/endpoints';
import type { User } from '../../types';

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = () => {
    setLoading(true);
    adminApi.students().then(setStudents).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (student_id: string) => {
    try {
      const res = await adminApi.toggleActive(student_id);
      setStudents(prev => prev.map(s => s.student_id === student_id ? { ...s, is_active: res.is_active } : s));
      toast.success(`Account ${res.is_active ? 'activated' : 'deactivated'}.`);
    } catch { toast.error('Failed to update status.'); }
  };

  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.student_id.toLowerCase().includes(search.toLowerCase()) ||
    (s.email ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={20} /> Manage Students
          </h1>
          <p className="page-subtitle">{students.length} registered students</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> Refresh</button>
      </div>

      <input
        className="form-input"
        style={{ maxWidth: 360, marginBottom: '1.25rem' }}
        placeholder="Search by name, ID, or email…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="card">
        {loading ? (
          <div className="loading-center"><div className="spinner spinner-lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Users size={40} className="empty-state-icon" />
            <p className="empty-state-text">No students found</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Student ID</th><th>Full Name</th><th>Email</th><th>Department</th><th>Joined</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{s.student_id}</td>
                    <td>{s.full_name}</td>
                    <td style={{ fontSize: '0.813rem' }}>{s.email}</td>
                    <td style={{ fontSize: '0.813rem' }}>{s.department ?? '—'}</td>
                    <td style={{ fontSize: '0.813rem', color: 'var(--ibm-gray-60)', whiteSpace: 'nowrap' }}>
                      {s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <span className={`badge ${s.is_active ? 'badge-green' : 'badge-red'}`}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`btn btn-sm ${s.is_active ? 'btn-danger' : 'btn-primary'}`}
                        onClick={() => toggleActive(s.student_id)}
                      >
                        {s.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
