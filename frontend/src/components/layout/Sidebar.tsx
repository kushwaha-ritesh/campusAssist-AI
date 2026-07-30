import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Bot, MapPin, FileText, MessageSquarePlus,
  Activity, CalendarPlus, Bell, LogOut, Users, ClipboardList,
  CalendarCheck, Megaphone, GraduationCap,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';

interface SidebarProps { role: string; isOpen: boolean; onClose: () => void; }

const STUDENT_NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Ask AI', icon: Bot, path: '/ask-ai' },
  { label: 'Find Office', icon: MapPin, path: '/find-office' },
  { label: 'Required Documents', icon: FileText, path: '/documents' },
  { label: 'Raise Request', icon: MessageSquarePlus, path: '/raise-request' },
  { label: 'Track Request', icon: Activity, path: '/track-request' },
  { label: 'Book Appointment', icon: CalendarPlus, path: '/book-appointment' },
  { label: 'Notifications', icon: Bell, path: '/notifications' },
];

const ADMIN_NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
  { label: 'Requests', icon: ClipboardList, path: '/admin/requests' },
  { label: 'Appointments', icon: CalendarCheck, path: '/admin/appointments' },
  { label: 'Students', icon: Users, path: '/admin/students' },
  { label: 'Notifications', icon: Megaphone, path: '/admin/notifications' },
];

export default function Sidebar({ role, isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearAuth, user } = useAuthStore();

  const navItems = role === 'admin' ? ADMIN_NAV : STUDENT_NAV;

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleLogout = () => {
    clearAuth();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <GraduationCap size={20} color="white" />
        </div>
        <div>
          <div className="sidebar-logo-text">CampusAssist AI</div>
          <div className="sidebar-logo-sub">Smart Help Desk</div>
        </div>
      </div>

      {/* User pill */}
      <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
        <div className="topbar-avatar" style={{ width: 36, height: 36, fontSize: '0.875rem' }}>
          {user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.813rem', fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.full_name}
          </div>
          <div style={{ fontSize: '0.688rem', color: 'var(--ibm-gray-40)' }}>{user?.student_id}</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">{role === 'admin' ? 'Admin Menu' : 'Quick Access'}</div>
        {navItems.map(({ label, icon: Icon, path }) => {
          const isActive = location.pathname === path ||
            (path !== '/admin' && path !== '/dashboard' && location.pathname.startsWith(path));
          return (
            <button
              key={path}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => handleNav(path)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
