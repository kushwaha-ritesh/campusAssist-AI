import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { authApi } from '../../api/endpoints';

const PW_RULES = [
  { key: 'len',     label: 'At least 8 characters',        test: (p: string) => p.length >= 8 },
  { key: 'upper',   label: 'One uppercase letter (A–Z)',    test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower',   label: 'One lowercase letter (a–z)',    test: (p: string) => /[a-z]/.test(p) },
  { key: 'digit',   label: 'One number (0–9)',              test: (p: string) => /[0-9]/.test(p) },
  { key: 'special', label: 'One special character (!@#$…)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const OTP_EXPIRE_SECONDS = 10 * 60;
const RESEND_COOLDOWN    = 60;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  // ── Step: 'identify' | 'otp' | 'reset' ────────────────────────────────────
  const [step, setStep] = useState<'identify' | 'otp' | 'reset'>('identify');

  // ── Step 1 state ───────────────────────────────────────────────────────────
  const [identifier, setIdentifier] = useState('');  // email or student/admin ID

  // ── OTP state ──────────────────────────────────────────────────────────────
  const [otpEmail, setOtpEmail]             = useState('');
  const [otpCode, setOtpCode]               = useState('');
  const [attemptsLeft, setAttemptsLeft]     = useState(3);
  const [expiresSec, setExpiresSec]         = useState(OTP_EXPIRE_SECONDS);
  const [resendCooldown, setResendCooldown] = useState(0);
  const expireTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Step 3 state ───────────────────────────────────────────────────────────
  const [newPassword, setNewPassword]     = useState('');
  const [confirmPass, setConfirmPass]     = useState('');
  const [pwTouched, setPwTouched]         = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const pwResults = PW_RULES.map(r => ({ ...r, passed: r.test(newPassword) }));
  const pwValid   = pwResults.every(r => r.passed);

  // ── Countdown helpers ──────────────────────────────────────────────────────
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

  // ── Step 1 → send OTP ─────────────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!identifier.trim()) { setError('Please enter your email or Student/Admin ID.'); return; }
    setLoading(true);

    // Determine if input looks like an email
    const isEmail = identifier.includes('@');
    try {
      const res = await authApi.sendOtp(
        isEmail ? identifier.trim().toLowerCase() : undefined as any,
        'reset_password',
        isEmail ? undefined : identifier.trim(),
      );
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

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0 || attemptsLeft <= 0) return;
    setError('');
    setLoading(true);
    const isEmail = identifier.includes('@');
    try {
      const res = await authApi.sendOtp(
        isEmail ? identifier.trim().toLowerCase() : undefined as any,
        'reset_password',
        isEmail ? undefined : identifier.trim(),
      );
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

  // ── Step 2 → verify OTP ───────────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otpCode.length !== 6) { setError('Please enter the 6-digit code.'); return; }
    setLoading(true);
    try {
      await authApi.verifyOtp(otpEmail, 'reset_password', otpCode);
      setStep('reset');
      if (expireTimer.current) clearInterval(expireTimer.current);
      if (resendTimer.current) clearInterval(resendTimer.current);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3 → reset password ────────────────────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPwTouched(true);
    if (!pwValid)                       { setError('Password does not meet the requirements below.'); return; }
    if (newPassword !== confirmPass)    { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await authApi.resetPassword(otpEmail, newPassword);
      toast.success('Password reset successfully! Please log in.');
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Password reset failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: OTP screen ─────────────────────────────────────────────────────
  if (step === 'otp') {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ maxWidth: 440 }}>
          <div className="auth-header">
            <div className="auth-logo"><GraduationCap size={28} color="white" /></div>
            <h1 className="auth-title">Check Your Email</h1>
            <p className="auth-subtitle">CampusAssist AI – Student Help Desk</p>
          </div>
          <div className="auth-body">
            <p style={{ marginBottom: '1rem', color: 'var(--ibm-gray-70)', fontSize: '0.875rem', lineHeight: 1.6 }}>
              A 6-digit verification code was sent to<br />
              <strong style={{ color: 'var(--ibm-gray-100)' }}>{otpEmail}</strong>
            </p>
            <form onSubmit={handleVerifyOtp}>
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
                {loading ? <span className="spinner" /> : 'Verify Code'}
              </button>
            </form>
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleResend}
                disabled={loading || resendCooldown > 0 || attemptsLeft <= 0}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : attemptsLeft <= 0 ? 'Limit reached' : 'Resend OTP'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setStep('identify'); setError(''); }} disabled={loading}>
                ← Try different ID
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 3: New password ───────────────────────────────────────────────────
  if (step === 'reset') {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ maxWidth: 440 }}>
          <div className="auth-header">
            <div className="auth-logo"><GraduationCap size={28} color="white" /></div>
            <h1 className="auth-title">Set New Password</h1>
            <p className="auth-subtitle">CampusAssist AI – Student Help Desk</p>
          </div>
          <div className="auth-body">
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setPwTouched(true); }}
                  autoComplete="new-password"
                  autoFocus
                  required
                />
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
                <label className="form-label">Confirm New Password</label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="Repeat new password"
                  value={confirmPass}
                  onChange={e => setConfirmPass(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              {error && <p className="form-error" style={{ marginBottom: '0.75rem' }}>{error}</p>}
              <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Reset Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1: Enter email or ID ──────────────────────────────────────────────
  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 440 }}>
        <div className="auth-header">
          <div className="auth-logo"><GraduationCap size={28} color="white" /></div>
          <h1 className="auth-title">Forgot Password</h1>
          <p className="auth-subtitle">CampusAssist AI – Student Help Desk</p>
        </div>
        <div className="auth-body">
          <p style={{ marginBottom: '1.25rem', color: 'var(--ibm-gray-70)', fontSize: '0.875rem', lineHeight: 1.6 }}>
            Enter your registered email address or Student/Admin ID.
            We'll send a verification code to your email.
          </p>
          <form onSubmit={handleSendOtp}>
            <div className="form-group">
              <label className="form-label">Email or Student/Admin ID</label>
              <input
                className="form-input"
                type="text"
                placeholder="e.g. you@university.edu or STU20261234"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </div>
            {error && <p className="form-error" style={{ marginBottom: '0.75rem' }}>{error}</p>}
            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Send Verification Code'}
            </button>
          </form>
        </div>
        <div className="auth-footer">
          Remember your password? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
