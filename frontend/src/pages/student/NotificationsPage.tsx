import React, { useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { notificationsApi } from '../../api/endpoints';
import type { Notification } from '../../types';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    notificationsApi.list().then(setNotifications).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const markAll = async () => {
    await notificationsApi.markAllRead();
    setNotifications(n => n.map(x => ({ ...x, is_read: true })));
    toast.success('All notifications marked as read');
  };

  const markOne = async (id: string) => {
    await notificationsApi.markRead(id);
    setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={20} /> Notifications
            {unreadCount > 0 && <span className="badge badge-red" style={{ marginLeft: '0.375rem' }}>{unreadCount}</span>}
          </h1>
          <p className="page-subtitle">Your latest campus updates and alerts</p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={markAll}>
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-center"><div className="spinner spinner-lg" /></div>
        ) : notifications.length === 0 ? (
          <div className="empty-state">
            <Bell size={36} className="empty-state-icon" />
            <p className="empty-state-text">No notifications yet</p>
          </div>
        ) : (
          notifications.map(n => (
            <div
              key={n.id}
              className={`notif-item ${!n.is_read ? 'unread' : ''}`}
              onClick={() => !n.is_read && markOne(n.id)}
              style={{ cursor: !n.is_read ? 'pointer' : 'default' }}
            >
              <div className={`notif-dot ${n.type}`} />
              <div className="notif-content">
                <div className="notif-title">{n.title}</div>
                <div className="notif-msg">{n.message}</div>
                <div className="notif-time">{timeAgo(n.created_at)}</div>
              </div>
              {!n.is_read && (
                <span className="badge badge-blue" style={{ flexShrink: 0, alignSelf: 'flex-start' }}>New</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
