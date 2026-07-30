import React, { useEffect, useState } from 'react';
import { Users, ClipboardList, CalendarCheck, TrendingUp, RefreshCw } from 'lucide-react';
import { adminApi, requestsApi, appointmentsApi } from '../../api/endpoints';
import type { AdminStats, HelpRequest, Appointment } from '../../types';
import toast from 'react-hot-toast';

const APPT_BADGE: Record<string, string> = { pending: 'badge-yellow', confirmed: 'badge-green', cancelled: 'badge-red' };
const STATUS_BADGE: Record<string, string> = { open: 'badge-red', in_progress: 'badge-yellow', resolved: 'badge-green', closed: 'badge-gray' };

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      adminApi.stats(),
      requestsApi.list('open'),
      appointmentsApi.list(),
    ]).then(([s, r, a]) => {
      setStats(s);
      setRequests(r.slice(0, 5));
      setAppointments(a.slice(0, 5));
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="loading-center"><div className="spinner spinner-lg" /></div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">Overview of the Student Help Desk</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> Refresh</button>
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total_students}</div>
            <div className="stat-label">Registered Students</div>
          </div>
          <div className="stat-card red">
            <div className="stat-value">{stats.open_requests}</div>
            <div className="stat-label">Open Requests</div>
          </div>
          <div className="stat-card yellow">
            <div className="stat-value">{stats.in_progress_requests}</div>
            <div className="stat-label">In Progress</div>
          </div>
          <div className="stat-card green">
            <div className="stat-value">{stats.resolved_requests}</div>
            <div className="stat-label">Resolved</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.total_appointments}</div>
            <div className="stat-label">Total Appointments</div>
          </div>
          <div className="stat-card yellow">
            <div className="stat-value">{stats.pending_appointments}</div>
            <div className="stat-label">Pending Appointments</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {/* Open Requests */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ClipboardList size={16} /> Latest Open Requests
            </span>
          </div>
          {requests.length === 0 ? (
            <div className="empty-state"><p className="empty-state-text">No open requests</p></div>
          ) : (
            <div>
              {requests.map(r => (
                <div key={r.id} style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--ibm-gray-20)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }} className="truncate">{r.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--ibm-gray-60)' }}>{r.student_name} · {r.category}</div>
                  </div>
                  <span className={`badge ${STATUS_BADGE[r.status]}`} style={{ marginLeft: '0.75rem', flexShrink: 0 }}>{r.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Appointments */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CalendarCheck size={16} /> Recent Appointments
            </span>
          </div>
          {appointments.length === 0 ? (
            <div className="empty-state"><p className="empty-state-text">No appointments yet</p></div>
          ) : (
            <div>
              {appointments.map(a => (
                <div key={a.id} style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--ibm-gray-20)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }} className="truncate">{a.office}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--ibm-gray-60)' }}>{a.student_name} · {a.date} {a.time_slot}</div>
                  </div>
                  <span className={`badge ${APPT_BADGE[a.status]}`} style={{ marginLeft: '0.75rem', flexShrink: 0 }}>{a.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
