import React, { useEffect, useState } from 'react';
import { CalendarCheck, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { appointmentsApi } from '../../api/endpoints';
import type { Appointment } from '../../types';

const BADGE: Record<string, string> = { pending: 'badge-yellow', confirmed: 'badge-green', cancelled: 'badge-red' };

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = () => {
    setLoading(true);
    appointmentsApi.list().then(setAppointments).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? appointments : appointments.filter(a => a.status === filter);

  const updateStatus = async (id: string, status: string) => {
    try {
      const updated = await appointmentsApi.updateStatus(id, status);
      setAppointments(prev => prev.map(a => a.id === id ? updated : a));
      toast.success(`Appointment ${status}.`);
    } catch { toast.error('Update failed.'); }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CalendarCheck size={20} /> Manage Appointments
          </h1>
          <p className="page-subtitle">Review and confirm student appointment requests</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> Refresh</button>
      </div>

      <div className="tabs">
        {['all', 'pending', 'confirmed', 'cancelled'].map(s => (
          <button key={s} className={`tab-btn ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-center"><div className="spinner spinner-lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <CalendarCheck size={40} className="empty-state-icon" />
            <p className="empty-state-text">No appointments found</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Student</th><th>Office</th><th>Purpose</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{a.student_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--ibm-gray-60)' }}>{a.student_id}</div>
                    </td>
                    <td style={{ fontWeight: 500 }}>{a.office}</td>
                    <td style={{ maxWidth: 160 }} className="truncate">{a.purpose}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{a.date}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{a.time_slot}</td>
                    <td><span className={`badge ${BADGE[a.status]}`}>{a.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        {a.status === 'pending' && (
                          <>
                            <button className="btn btn-primary btn-sm" onClick={() => updateStatus(a.id, 'confirmed')}>Confirm</button>
                            <button className="btn btn-danger btn-sm" onClick={() => updateStatus(a.id, 'cancelled')}>Cancel</button>
                          </>
                        )}
                      </div>
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
