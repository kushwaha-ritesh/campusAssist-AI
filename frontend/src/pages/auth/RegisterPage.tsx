import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../../api/endpoints';

const DEPARTMENTS = [
  'Computer Science', 'Engineering', 'Business Administration',
  'Law', 'Medicine', 'Education', 'Arts & Humanities',
  'Natural Sciences', 'Social Sciences', 'Other',
];

const PW_RULES = [
  { key: 'len',     label: 'At least 8 characters',        test: (p: string) => p.length >= 8 },
  { key: 'upper',   label: 'One uppercase letter (A–Z)',    test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower',   label: 'One lowercase letter (a–z)',    test: (p: string) => /[a-z]/.test(p) },
  { key: 'digit',   label: 'One number (0–9)',              test: (p: string) => /[0-9]/.test(p) },
  { key: 'special', label: 'One special character (!@#$…)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function toTitleCase(str: string) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

const OTP_EXPIRE_SECONDS = 10 * 60; // 10 minutes
const RESEND_COOLDOWN = 60;          // 1 minute between resends

export default function RegisterPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'student' | 'admin'>('student');

  // ── Form state ──────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    full_name: '', email: '', department: '', password: '', confirm: '', admin_code: '',
  });
  const [pwTouched, setPwTouched] = useState(false);

  // ── Step: 'form' | 'otp' | 'success' ───────────────────────────────────────
  const [step, setStep] = useState<'form' | 'otp' | 'success'>('form');

  // ── OTP state ───────────────────────────────────────────────────────────────
  const [otpCode, setOtpCode]               = useState('');
  const [otpEmail, setOtpEmail]             = useState('');
  const [attemptsLeft, setAttemptsLeft]     = useState(3);
  const [expiresSec, setExpiresSec]         = useState(OTP_EXPIRE_SECONDS);
  const [resendCooldown, setResendCooldown] = useState(0);
  const expireTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const resendTimer  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Result ──────────────────────────────────────────────────────────────────
  const [assignedId, setAssignedId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const setField = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const pwResults = PW_RULES.map(r => ({ ...r, passed: r.test(form.password) }));
  const pwValid   = pwResults.every(r => r.passed);

  // ── Countdown helpers ───────────────────────────────────────────────────────
  const startExpireCountdown = () => {
    if (expireTimer.current) clearInterval(expireTimer.current);
    setExpiresSec(OTP_EXPIRE_SECONDS);
    expireTimer.current = setInterval(() => {
      setExpiresSec(s => { if (s <= 1) { clearInterval(expireTimer.current!); return 0; } return s - 1; });
    }, 1000);
  };

  const startResendCooldown = () => {
    if (resendTimer.current) clearInterval(resendTimer.current);
    setResendCooldown(RESEND_COOLDOWN);
    resendTimer.current = setInterval(() => {
      setResendCooldown(s => { if (s <= 1) { clearInterval(resendTimer.current!); return 0; } return s - 1; });
    }, 1000);
  };

  useEffect(() => () => {
    if (expireTimer.current) clearInterval(expireTimer.current);
    if (resendTimer.current) clearInterval(resendTimer.current);
  }, []);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ── Step 1 → send OTP ───────────────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPwTouched(true);
    if (!pwValid)                          { setError('Password does not meet the requirements below.'); return; }
    if (form.password !== form.confirm)    { setError('Passwords do not match.'); return; }
    if (!form.full_name.trim())            { setError('Full name is required.'); return; }
    setLoading(true);
    try {
      const res = await authApi.sendOtp(form.email, 'register');
      setOtpEmail(res.email);
      setAttemptsLeft(res.attempts_remaining);
      setStep('otp');
      setOtpCode('');
      startExpireCountdown();
      startResendCooldown();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ──────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0 || attemptsLeft <= 0) return;
    setError('');
    setLoading(true);
    try {
      const res = await authApi.sendOtp(form.email, 'register');
      setAttemptsLeft(res.attempts_remaining);
      startExpireCountdown();
      startResendCooldown();
      setOtpCode('');
      toast.success('A new code has been sent.');
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Failed to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2 → verify OTP + register ─────────────────────────────────────────
  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otpCode.length !== 6) { setError('Please enter the 6-digit code.'); return; }
    setLoading(true);
    try {
      // 1. Verify OTP
      await authApi.verifyOtp(otpEmail, 'register', otpCode);
      // 2. Create account
      const user = await authApi.register({
        student_id: '',
        full_name: form.full_name,
        email: otpEmail,
        department: form.department || undefined,
        password: form.password,
        role: tab,
        admin_code: tab === 'admin' ? form.admin_code : undefined,
      });
      setAssignedId(user.student_id);
      setStep('success');
      if (expireTimer.current) clearInterval(expireTimer.current);
      if (resendTimer.current) clearInterval(resendTimer.current);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (step === 'success' && assignedId) {
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
              display: 'inline-block', background: 'var(--ibm-gray-10)',
              border: '1px solid var(--ibm-gray-30)', borderRadius: 6,
              padding: '0.6rem 1.5rem', fontSize: '1.4rem', fontWeight: 700,
              letterSpacing: '0.05em', margin: '1rem 0 1.5rem', color: 'var(--ibm-blue-60)',
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

  // ── OTP entry screen ────────────────────────────────────────────────────────
  if (step === 'otp') {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ maxWidth: 440 }}>
          <div className="auth-header">
            <div className="auth-logo"><GraduationCap size={28} color="white" /></div>
            <h1 className="auth-title">Verify Your Email</h1>
            <p className="auth-subtitle">CampusAssist AI – Student Help Desk</p>
          </div>
          <div className="auth-body">
            <p style={{ marginBottom: '1rem', color: 'var(--ibm-gray-70)', fontSize: '0.875rem', lineHeight: 1.6 }}>
              A 6-digit verification code was sent to<br />
              <strong style={{ color: 'var(--ibm-gray-100)' }}>{otpEmail}</strong>
            </p>

            <form onSubmit={handleVerifyAndRegister}>
              <div className="form-group">
                <label className="form-label">Verification Code</label>
                <input
                  className="form-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit code"
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  style={{ fontSize: '1.5rem', letterSpacing: '0.3em', textAlign: 'center' }}
                  autoFocus
                />
              </div>

              {/* Expiry countdown */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--ibm-gray-60)', marginBottom: '1rem' }}>
                <span>
                  {expiresSec > 0
                    ? <>Code expires in <strong style={{ color: expiresSec < 60 ? '#dc2626' : 'inherit' }}>{fmtTime(expiresSec)}</strong></>
                    : <span style={{ color: '#dc2626' }}>Code expired — please resend.</span>
                  }
                </span>
                <span>{attemptsLeft} send{attemptsLeft !== 1 ? 's' : ''} remaining</span>
              </div>

              {error && <p className="form-error" style={{ marginBottom: '0.75rem' }}>{error}</p>}

              <button
                type="submit"
                className="btn btn-primary btn-full btn-lg"
                disabled={loading || otpCode.length !== 6}
              >
                {loading ? <span className="spinner" /> : 'Verify & Create Account'}
              </button>
            </form>

            {/* Resend + back */}
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleResend}
                disabled={loading || resendCooldown > 0 || attemptsLeft <= 0}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : attemptsLeft <= 0 ? 'Limit reached' : 'Resend OTP'}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setStep('form'); setError(''); }}
                disabled={loading}
              >
                ← Change email
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1: Registration form ───────────────────────────────────────────────
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
          <form onSubmit={handleSendOtp}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" placeholder="Your full name" value={form.full_name}
                onChange={e => setField('full_name', toTitleCase(e.target.value))} autoComplete="name" required />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" placeholder="you@university.edu" value={form.email}
                onChange={e => setField('email', e.target.value.toLowerCase())} autoComplete="email" required />
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
                <input className="form-input" type="password" placeholder="Enter admin code"
                  value={form.admin_code} onChange={e => setField('admin_code', e.target.value)} required />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="Min. 8 characters"
                value={form.password}
                onChange={e => { setField('password', e.target.value); setPwTouched(true); }}
                autoComplete="new-password" required />
              {pwTouched && (
                <ul style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0, fontSize: '0.78rem', lineHeight: '1.7' }}>
                  {pwResults.map(r => (
                    <li key={r.key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: r.passed ? '#16a34a' : '#dc2626' }}>
                      {r.passed ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                      {r.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input className="form-input" type="password" placeholder="Repeat password"
                value={form.confirm} onChange={e => setField('confirm', e.target.value)} autoComplete="new-password" required />
            </div>
            {error && <p className="form-error" style={{ marginBottom: '0.75rem' }}>{error}</p>}
            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Send Verification Code'}
            </button>
          </form>
        </div>
        <div className="auth-footer">Already have an account? <Link to="/login">Sign in</Link></div>
      </div>
    </div>
  );
}
