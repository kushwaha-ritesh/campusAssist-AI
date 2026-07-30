import React, { useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { requestsApi } from '../../api/endpoints';
import type { HelpRequest } from '../../types';

const STATUS_BADGE: Record<string, string> = {
  open: 'badge-red', in_progress: 'badge-yellow', resolved: 'badge-green', closed: 'badge-gray',
};
const PRIORITY_BADGE: Record<string, string> = {
  low: 'badge-gray', medium: 'badge-yellow', high: 'badge-red',
};

export default function TrackRequestPage() {
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = () => {
    setLoading(true);
    requestsApi.list(filter === 'all' ? undefined : filter)
      .then(setRequests)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Track Requests</h1>
          <p className="page-subtitle">View and monitor your submitted support requests</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> Refresh</button>
      </div>

      {/* Filter tabs */}
      <div className="tabs">
        {['all', 'open', 'in_progress', 'resolved', 'closed'].map(s => (
          <button key={s} className={`tab-btn ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
            {s === 'all' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner spinner-lg" /></div>
      ) : requests.length === 0 ? (
        <div className="empty-state">
          <Activity size={40} className="empty-state-icon" />
          <p className="empty-state-text">No requests found</p>
          <p className="empty-state-sub">Use "Raise Request" to submit a new support ticket.</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{r.title}</td>
                    <td><span className="badge badge-blue">{r.category}</span></td>
                    <td><span className={`badge ${PRIORITY_BADGE[r.priority]}`}>{r.priority}</span></td>
                    <td><span className={`badge ${STATUS_BADGE[r.status]}`}>{r.status.replace('_', ' ')}</span></td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.813rem', color: 'var(--ibm-gray-60)' }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ fontSize: '0.813rem', color: 'var(--ibm-gray-60)', maxWidth: 200 }} className="truncate">
                      {r.admin_note ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
