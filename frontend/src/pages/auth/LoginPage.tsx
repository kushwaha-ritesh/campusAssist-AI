import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff } from 'lucide-react';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.student_id || !form.password) { setError('Please fill all fields.'); return; }
    setLoading(true);
    try {
      const data = await authApi.login({ username: form.student_id, password: form.password });
      if (tab === 'admin' && data.user.role !== 'admin') {
        setError('This account does not have admin privileges.');
        return;
      }
      if (tab === 'student' && data.user.role !== 'student') {
        setError('Please use the Admin login tab.');
        return;
      }
      setAuth(data.user, data.access_token);
      toast.success(`Welcome back, ${data.user.full_name}!`);
      navigate(data.user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Login failed. Please try again.');
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
            <button className={`auth-toggle-btn ${tab === 'student' ? 'active' : ''}`} onClick={() => setTab('student')}>
              Student
            </button>
            <button className={`auth-toggle-btn ${tab === 'admin' ? 'active' : ''}`} onClick={() => setTab('admin')}>
              Admin
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">{tab === 'admin' ? 'Admin ID' : 'Student ID'}</label>
              <input
                className="form-input"
                type="text"
                placeholder={tab === 'admin' ? 'e.g. ADMIN001' : 'e.g. STU2024001'}
                value={form.student_id}
                onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}
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
