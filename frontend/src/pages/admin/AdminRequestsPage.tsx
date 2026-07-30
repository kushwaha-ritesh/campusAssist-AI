import React, { useEffect, useState } from 'react';
import { ClipboardList, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { requestsApi } from '../../api/endpoints';
import type { HelpRequest } from '../../types';

const STATUS_BADGE: Record<string, string> = { open: 'badge-red', in_progress: 'badge-yellow', resolved: 'badge-green', closed: 'badge-gray' };
const PRIORITY_BADGE: Record<string, string> = { low: 'badge-gray', medium: 'badge-yellow', high: 'badge-red' };

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<HelpRequest | null>(null);
  const [note, setNote] = useState('');
  const [updating, setUpdating] = useState(false);

  const load = () => {
    setLoading(true);
    requestsApi.list(filter === 'all' ? undefined : filter)
      .then(setRequests)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const openModal = (r: HelpRequest) => { setSelected(r); setNote(r.admin_note ?? ''); };
  const closeModal = () => { setSelected(null); setNote(''); };

  const handleUpdate = async (status: string) => {
    if (!selected) return;
    setUpdating(true);
    try {
      const updated = await requestsApi.update(selected.id, { status, admin_note: note || undefined });
      toast.success('Request updated.');
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      closeModal();
    } catch { toast.error('Update failed.'); }
    finally { setUpdating(false); }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardList size={20} /> Manage Requests
          </h1>
          <p className="page-subtitle">View and respond to student support tickets</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}><RefreshCw size={14} /> Refresh</button>
      </div>

      <div className="tabs">
        {['all', 'open', 'in_progress', 'resolved', 'closed'].map(s => (
          <button key={s} className={`tab-btn ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
            {s === 'all' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-center"><div className="spinner spinner-lg" /></div>
        ) : requests.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={40} className="empty-state-icon" />
            <p className="empty-state-text">No requests found</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Title</th><th>Student</th><th>Category</th><th>Priority</th><th>Status</th><th>Date</th><th>Action</th></tr>
              </thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500, maxWidth: 200 }} className="truncate">{r.title}</td>
                    <td>
                      <div>{r.student_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--ibm-gray-60)' }}>{r.student_id}</div>
                    </td>
                    <td><span className="badge badge-blue">{r.category}</span></td>
                    <td><span className={`badge ${PRIORITY_BADGE[r.priority]}`}>{r.priority}</span></td>
                    <td><span className={`badge ${STATUS_BADGE[r.status]}`}>{r.status.replace('_', ' ')}</span></td>
                    <td style={{ fontSize: '0.813rem', color: 'var(--ibm-gray-60)', whiteSpace: 'nowrap' }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => openModal(r)}>Update</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {selected && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Update Request</span>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{selected.title}</div>
                <div style={{ fontSize: '0.813rem', color: 'var(--ibm-gray-60)', marginBottom: 8 }}>
                  {selected.student_name} · {selected.student_id}
                </div>
                <p style={{ fontSize: '0.875rem' }}>{selected.description}</p>
              </div>
              <div className="form-group">
                <label className="form-label">Admin Note</label>
                <textarea className="form-textarea" value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note to the student…" rows={3} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['open', 'in_progress', 'resolved', 'closed'].map(s => (
                  <button
                    key={s}
                    className={`btn btn-sm ${s === 'resolved' ? 'btn-primary' : s === 'closed' ? 'btn-danger' : 'btn-secondary'}`}
                    onClick={() => handleUpdate(s)}
                    disabled={updating || selected.status === s}
                  >
                    {s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
