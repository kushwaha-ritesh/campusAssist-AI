import React, { useEffect, useState } from 'react';
import { Megaphone, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { notificationsApi } from '../../api/endpoints';
import type { Notification } from '../../types';

const TYPE_OPTIONS = ['info', 'success', 'warning', 'error'];
const BADGE: Record<string, string> = { info: 'badge-blue', success: 'badge-green', warning: 'badge-yellow', error: 'badge-red' };

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ student_id: string; title: string; message: string; type: import('../../types').NotifType }>({ student_id: 'all', title: '', message: '', type: 'info' });
  const [sending, setSending] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    notificationsApi.list().then(setNotifications).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const setField = (f: string, v: string) => setForm(prev => ({ ...prev, [f]: v }));

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) { toast.error('Fill in all fields.'); return; }
    setSending(true);
    try {
      await notificationsApi.create(form);
      toast.success('Notification sent!');
      setForm({ student_id: 'all', title: '', message: '', type: 'info' });
      setShowForm(false);
      load();
    } catch { toast.error('Failed to send notification.'); }
    finally { setSending(false); }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Megaphone size={20} /> Notifications
          </h1>
          <p className="page-subtitle">Broadcast alerts and messages to students</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
          <Send size={14} /> {showForm ? 'Hide' : 'Send Notification'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ maxWidth: 560, marginBottom: '1.5rem' }}>
          <div className="card-header"><span className="card-title">Compose Notification</span></div>
          <div className="card-body">
            <form onSubmit={handleSend}>
              <div className="form-group">
                <label className="form-label">Recipient</label>
                <input className="form-input" placeholder='Student ID or "all" for broadcast' value={form.student_id} onChange={e => setField('student_id', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input className="form-input" placeholder="Notification title" value={form.title} onChange={e => setField('title', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-select" value={form.type} onChange={e => setField('type', e.target.value)}>
                    {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Message *</label>
                <textarea className="form-textarea" placeholder="Notification body…" value={form.message} onChange={e => setField('message', e.target.value)} rows={3} required />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={sending}>
                  {sending ? <span className="spinner" /> : <><Send size={14} /> Send</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="loading-center"><div className="spinner spinner-lg" /></div>
        ) : notifications.length === 0 ? (
          <div className="empty-state">
            <Megaphone size={36} className="empty-state-icon" />
            <p className="empty-state-text">No notifications sent yet</p>
          </div>
        ) : (
          notifications.map(n => (
            <div key={n.id} className="notif-item">
              <div className={`notif-dot ${n.type}`} />
              <div className="notif-content">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="notif-title">{n.title}</span>
                  <span className={`badge ${BADGE[n.type]}`}>{n.type}</span>
                </div>
                <div className="notif-msg">{n.message}</div>
                <div className="notif-time">To: {n.student_id} · {timeAgo(n.created_at)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
