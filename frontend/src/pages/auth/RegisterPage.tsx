import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../../api/endpoints';

const DEPARTMENTS = [
  'Computer Science', 'Engineering', 'Business Administration',
  'Law', 'Medicine', 'Education', 'Arts & Humanities',
  'Natural Sciences', 'Social Sciences', 'Other',
];

// Password rules — each has a label and a test function
const PW_RULES = [
  { key: 'len',     label: 'At least 8 characters',          test: (p: string) => p.length >= 8 },
  { key: 'upper',   label: 'One uppercase letter (A–Z)',      test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower',   label: 'One lowercase letter (a–z)',      test: (p: string) => /[a-z]/.test(p) },
  { key: 'digit',   label: 'One number (0–9)',                test: (p: string) => /[0-9]/.test(p) },
  { key: 'special', label: 'One special character (!@#$…)',   test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

/** Title-case every word in a string */
function toTitleCase(str: string) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'student' | 'admin'>('student');
  const [form, setForm] = useState({
    full_name: '', email: '', department: '', password: '', confirm: '', admin_code: '',
  });
  const [assignedId, setAssignedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pwTouched, setPwTouched] = useState(false);

  const setField = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  // Auto-format: title-case full_name, lowercase email
  const handleFullName = (e: React.ChangeEvent<HTMLInputElement>) =>
    setField('full_name', toTitleCase(e.target.value));
  const handleEmail = (e: React.ChangeEvent<HTMLInputElement>) =>
    setField('email', e.target.value.toLowerCase());

  const pwResults = PW_RULES.map(r => ({ ...r, passed: r.test(form.password) }));
  const pwValid   = pwResults.every(r => r.passed);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPwTouched(true);
    if (!pwValid) { setError('Password does not meet the requirements below.'); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const user = await authApi.register({
        student_id: '',   // ignored — server generates it
        full_name: form.full_name,
        email: form.email,
        department: form.department || undefined,
        password: form.password,
        role: tab,
        admin_code: tab === 'admin' ? form.admin_code : undefined,
      });
      setAssignedId(user.student_id);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen: show the assigned ID ──────────────────────────────────
  if (assignedId) {
    const label = tab === 'admin' ? 'Admin ID' : 'Student ID';
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ maxWidth: 480 }}>
          <div className="auth-header">
            <div className="auth-logo"><GraduationCap size={28} color="white" /></div>
            <h1 className="auth-title">Account Created!</h1>
            <p className="auth-subtitle">CampusAssist AI – Student Help Desk</p>
          </div>
          <div className="auth-body" style={{ textAlign: 'center' }}>
            <p style={{ marginBottom: '0.5rem', color: 'var(--ibm-gray-70)' }}>
              Your {label} has been assigned. Save it — you'll need it to log in.
            </p>
            <div style={{
              display: 'inline-block',
              background: 'var(--ibm-gray-10)',
              border: '1px solid var(--ibm-gray-30)',
              borderRadius: 6,
              padding: '0.6rem 1.5rem',
              fontSize: '1.4rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
              margin: '1rem 0 1.5rem',
              color: 'var(--ibm-blue-60)',
            }}>
              {assignedId}
            </div>
            <button
              className="btn btn-primary btn-full btn-lg"
              onClick={() => { toast.success('Account created! Please log in.'); navigate('/login'); }}
            >
              Continue to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

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
              <label className="form-label">Full Name</label>
              <input className="form-input" placeholder="Your full name" value={form.full_name} onChange={handleFullName} autoComplete="name" required />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" placeholder="you@university.edu" value={form.email} onChange={handleEmail} autoComplete="email" required />
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
              <input
                className="form-input"
                type="password"
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={e => { setField('password', e.target.value); setPwTouched(true); }}
                autoComplete="new-password"
                required
              />
              {/* Live password rule checklist — shown as soon as user starts typing */}
              {pwTouched && (
                <ul style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0, fontSize: '0.78rem', lineHeight: '1.7' }}>
                  {pwResults.map(r => (
                    <li key={r.key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: r.passed ? '#16a34a' : '#dc2626' }}>
                      {r.passed
                        ? <Check size={12} strokeWidth={3} />
                        : <X size={12} strokeWidth={3} />}
                      {r.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input className="form-input" type="password" placeholder="Repeat password" value={form.confirm} onChange={e => setField('confirm', e.target.value)} autoComplete="new-password" required />
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
