import React from 'react';
import { Menu, Bell } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';

interface TopbarProps { onMenuClick: () => void; }

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? 'U';

  return (
    <header className="topbar">
      <button className="hamburger-btn" onClick={onMenuClick} aria-label="Toggle menu">
        <Menu size={20} />
      </button>
      <div className="topbar-brand">
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
      </div>
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
