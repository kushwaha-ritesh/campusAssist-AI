import React from 'react';
import { Bell } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';

interface TopbarProps { onMenuClick: () => void; }

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? 'U';

  return (
    <header className="topbar">
      {/* On mobile the brand acts as the hamburger toggle; on desktop it is non-interactive */}
      <button className="topbar-brand" onClick={onMenuClick} aria-label="Toggle menu">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect width="24" height="24" rx="4" fill="rgba(255,255,255,0.15)" />
          <path d="M6 7h12M6 12h8M6 17h10" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        CampusAssist AI
        {user?.role === 'admin' && (
          <span style={{ fontSize: '0.688rem', background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '10px' }}>
            Admin
          </span>
        )}
      </button>
      <div className="topbar-spacer" />
      <button
        className="btn-icon"
        style={{ background: 'none', border: 'none', color: 'white' }}
        onClick={() => navigate(user?.role === 'admin' ? '/admin/notifications' : '/notifications')}
        aria-label="Notifications"
      >
        <Bell size={18} />
      </button>
      <div className="topbar-user">
        <div className="topbar-avatar">{initials}</div>
        <span style={{ fontSize: '0.813rem', fontWeight: 500 }}>{user?.full_name}</span>
      </div>
    </header>
  );
}
