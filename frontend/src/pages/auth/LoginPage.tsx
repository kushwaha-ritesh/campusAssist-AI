import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../../api/endpoints';
import { useAuthStore } from '../../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [tab, setTab] = useState<'student' | 'admin'>('student');
  const [form, setForm] = useState({ student_id: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = tab === 'admin';

  const errorFor = (status: number | undefined, serverDetail: string): string => {
    if (status === 401 || status === 400) {
      return isAdmin
        ? 'Invalid Admin ID or password. Please check your credentials.'
        : 'Invalid Student ID, email, or password. Please check your credentials.';
    }
    if (status === 503) return 'Service unavailable. Please try again later.';
    return serverDetail || 'Login failed. Please try again.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.student_id || !form.password) {
      setError(isAdmin ? 'Please enter your Admin ID and password.' : 'Please enter your Student ID (or email) and password.');
      return;
    }
    setLoading(true);
    try {
      const data = await authApi.login({ username: form.student_id, password: form.password });
      if (isAdmin && data.user.role !== 'admin') {
        setError('This account does not have admin privileges. Please use the Student login tab.');
        return;
      }
      if (!isAdmin && data.user.role !== 'student') {
        setError('This is an admin account. Please use the Admin login tab.');
        return;
      }
      setAuth(data.user, data.access_token);
      toast.success(`Welcome back, ${data.user.full_name}!`);
      navigate(data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail ?? '';
      setError(errorFor(status, detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo"><GraduationCap size={28} color="white" /></div>
          <h1 className="auth-title">CampusAssist AI</h1>
          <p className="auth-subtitle">Smart Student Help Desk</p>
        </div>
        <div className="auth-body">
          <div className="auth-toggle">
            <button className={`auth-toggle-btn ${tab === 'student' ? 'active' : ''}`} onClick={() => { setTab('student'); setError(''); }}>
              Student
            </button>
            <button className={`auth-toggle-btn ${tab === 'admin' ? 'active' : ''}`} onClick={() => { setTab('admin'); setError(''); }}>
              Admin
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">{tab === 'admin' ? 'Admin ID' : 'Student ID or Email'}</label>
              <input
                className="form-input"
                type="text"
                placeholder={tab === 'admin' ? 'e.g. ADMIN001' : 'e.g. STU2024001 or email'}
                value={form.student_id}
                onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}
                autoComplete="username"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  autoComplete="current-password"
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--ibm-gray-60)', cursor: 'pointer' }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {/* Forgot password link */}
            <div style={{ textAlign: 'right', marginBottom: '0.75rem', marginTop: '-0.25rem' }}>
              <Link
                to="/forgot-password"
                style={{ fontSize: '0.8rem', color: 'var(--ibm-blue-60)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <KeyRound size={13} /> Forgot password?
              </Link>
            </div>
            {error && <p className="form-error" style={{ marginBottom: '0.75rem' }}>{error}</p>}
            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? <span className="spinner" /> : `Sign in as ${tab === 'admin' ? 'Admin' : 'Student'}`}
            </button>
          </form>
        </div>
        <div className="auth-footer">
          Don't have an account?{' '}
          <Link to="/register">Register here</Link>
        </div>
      </div>
    </div>
  );
}
