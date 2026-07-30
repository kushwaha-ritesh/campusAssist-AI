import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Bot, MapPin, FileText, MessageSquarePlus, Activity, CalendarPlus, Bell, BookOpen } from 'lucide-react';

const ACTIONS = [
  { label: 'Ask AI', icon: Bot, path: '/ask-ai', color: '#0f62fe' },
  { label: 'Find Office', icon: MapPin, path: '/find-office', color: '#0043ce' },
  { label: 'Required Documents', icon: FileText, path: '/documents', color: '#005d5d' },
  { label: 'Raise Request', icon: MessageSquarePlus, path: '/raise-request', color: '#8a3ffc' },
  { label: 'Track Request', icon: Activity, path: '/track-request', color: '#ff832b' },
  { label: 'Book Appointment', icon: CalendarPlus, path: '/book-appointment', color: '#198038' },
  { label: 'Notifications', icon: Bell, path: '/notifications', color: '#da1e28' },
  { label: 'Resources', icon: BookOpen, path: '/documents', color: '#b28600' },
];

export default function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div>
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--ibm-blue-70) 0%, var(--ibm-blue-60) 100%)',
        borderRadius: 6,
        padding: '1.75rem 2rem',
        marginBottom: '1.75rem',
        color: 'white',
      }}>
        <div style={{ fontSize: '0.813rem', opacity: 0.85 }}>{greeting}</div>
        <h1 style={{ fontSize: '1.625rem', fontWeight: 700, marginTop: 4 }}>
          Welcome, {user?.full_name?.split(' ')[0]}!
        </h1>
        <p style={{ opacity: 0.85, fontSize: '0.875rem', marginTop: 6 }}>
          {user?.department ? `${user.department} · ` : ''}{user?.student_id} — How can we help you today?
        </p>
      </div>

      {/* Quick Actions */}
      <div className="page-header">
        <h2 className="page-title">Quick Actions</h2>
        <p className="page-subtitle">Select a service to get started</p>
      </div>
      <div className="quick-actions-grid">
        {ACTIONS.map(({ label, icon: Icon, path, color }) => (
          <button
            key={path + label}
            className="quick-action-card"
            onClick={() => navigate(path)}
            style={{ '--accent': color } as React.CSSProperties}
          >
            <div className="quick-action-icon" style={{ background: `${color}18`, color }}>
              <Icon size={24} />
            </div>
            <span className="quick-action-label">{label}</span>
          </button>
        ))}
      </div>

      {/* Info strip */}
      <div style={{
        marginTop: '2rem',
        background: 'var(--ibm-blue-10)',
        border: '1px solid var(--ibm-blue-20)',
        borderRadius: 6,
        padding: '1rem 1.25rem',
        display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
      }}>
        <Bot size={20} color="var(--ibm-blue-60)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--ibm-blue-70)' }}>AI Assistant Available</div>
          <div style={{ fontSize: '0.813rem', color: 'var(--ibm-gray-60)', marginTop: 2 }}>
            Click <strong>Ask AI</strong> above to get instant answers about admissions, fees, exams, office locations and more.
          </div>
        </div>
      </div>
    </div>
  );
}
