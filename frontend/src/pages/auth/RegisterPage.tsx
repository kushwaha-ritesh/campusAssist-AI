import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../../api/endpoints';
import { useAuthStore } from '../../store/authStore';

const DEPARTMENTS = [
  'Computer Science', 'Engineering', 'Business Administration',
  'Law', 'Medicine', 'Education', 'Arts & Humanities',
  'Natural Sciences', 'Social Sciences', 'Other',
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [tab, setTab] = useState<'student' | 'admin'>('student');
  const [form, setForm] = useState({
    student_id: '', full_name: '', email: '', department: '', password: '', confirm: '', admin_code: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setField = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      await authApi.register({
        student_id: form.student_id,
        full_name: form.full_name,
        email: form.email,
        department: form.department || undefined,
        password: form.password,
        role: tab,
        admin_code: tab === 'admin' ? form.admin_code : undefined,
      });
      toast.success('Account created! Please log in.');
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <div className="auth-header">
          <div className="auth-logo"><GraduationCap size={28} color="white" /></div>
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">CampusAssist AI – Student Help Desk</p>
        </div>
        <div className="auth-body">
          <div className="auth-toggle">
            <button className={`auth-toggle-btn ${tab === 'student' ? 'active' : ''}`} onClick={() => setTab('student')}>Student</button>
            <button className={`auth-toggle-btn ${tab === 'admin' ? 'active' : ''}`} onClick={() => setTab('admin')}>Admin</button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">{tab === 'admin' ? 'Admin ID' : 'Student ID'}</label>
              <input className="form-input" placeholder="e.g. STU2024001" value={form.student_id} onChange={e => setField('student_id', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" placeholder="Your full name" value={form.full_name} onChange={e => setField('full_name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" placeholder="you@university.edu" value={form.email} onChange={e => setField('email', e.target.value)} required />
            </div>
            {tab === 'student' && (
              <div className="form-group">
                <label className="form-label">Department</label>
                <select className="form-select" value={form.department} onChange={e => setField('department', e.target.value)}>
                  <option value="">Select department…</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}
            {tab === 'admin' && (
              <div className="form-group">
                <label className="form-label">Admin Registration Code</label>
                <input className="form-input" type="password" placeholder="Enter admin code" value={form.admin_code} onChange={e => setField('admin_code', e.target.value)} required />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="Min. 6 characters" value={form.password} onChange={e => setField('password', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input className="form-input" type="password" placeholder="Repeat password" value={form.confirm} onChange={e => setField('confirm', e.target.value)} required />
            </div>
            {error && <p className="form-error" style={{ marginBottom: '0.75rem' }}>{error}</p>}
            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Create Account'}
            </button>
          </form>
        </div>
        <div className="auth-footer">Already have an account? <Link to="/login">Sign in</Link></div>
      </div>
    </div>
  );
}
