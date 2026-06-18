import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { X, Mail, Lock, KeyRound, Loader2, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AuthModal({ isOpen, onClose }) {
  const {
    loginWithEmail,
    loginWithGoogle,
    sendRegistrationOtp,
    verifyOtpAndRegister,
    authError,
    setAuthError
  } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [registerStep, setRegisterStep] = useState(1); // 1: form, 2: otp
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Clear errors when switching modes
  useEffect(() => {
    setAuthError('');
  }, [mode, registerStep, isOpen]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    const result = await loginWithEmail(email, password);
    setSubmitting(false);
    if (result.success) {
      onClose();
    }
  };

  const handleGoogleSubmit = async () => {
    setSubmitting(true);
    const result = await loginWithGoogle();
    setSubmitting(false);
    if (result.success) {
      onClose();
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const result = await sendRegistrationOtp(email);
    setSubmitting(false);

    if (result.success) {
      setRegisterStep(2);
      setResendCooldown(60);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp || otp.trim().length !== 6) {
      setAuthError('Please enter a valid 6-digit verification code.');
      return;
    }

    setSubmitting(true);
    const result = await verifyOtpAndRegister(email, password, otp);
    setSubmitting(false);

    if (result.success) {
      onClose();
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || submitting) return;
    setSubmitting(true);
    const result = await sendRegistrationOtp(email);
    setSubmitting(false);
    if (result.success) {
      setResendCooldown(60);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold bg-gradient-to-r from-stone-900 to-stone-600 dark:from-white dark:to-stone-400 bg-clip-text text-transparent">
              AI Research Agent
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition min-w-[40px] min-h-[40px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switchers if on main screens */}
        {!(mode === 'register' && registerStep === 2) && (
          <div className="flex border-b border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50">
            <button
              onClick={() => { setMode('login'); setRegisterStep(1); }}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition ${
                mode === 'login'
                  ? 'border-stone-900 dark:border-white text-stone-900 dark:text-white'
                  : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('register'); setRegisterStep(1); }}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition ${
                mode === 'register'
                  ? 'border-stone-900 dark:border-white text-stone-900 dark:text-white'
                  : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        <div className="p-6">
          {/* Error Banner */}
          {authError && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs sm:text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
              <div className="flex-1 leading-snug">{authError}</div>
            </div>
          )}

          {/* MODE: LOGIN */}
          {mode === 'login' && (
            <div>
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1.5 uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="w-full pl-10 pr-4 py-2.5 text-base sm:text-sm bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1.5 uppercase tracking-wider">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full pl-10 pr-4 py-2.5 text-base sm:text-sm bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-white transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-4 bg-stone-900 hover:bg-black dark:bg-white dark:hover:bg-stone-200 text-white dark:text-stone-900 rounded-xl font-medium text-sm transition shadow-sm disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
                </button>
              </form>

              <div className="my-5 flex items-center gap-3">
                <div className="flex-1 h-px bg-stone-200 dark:bg-stone-800" />
                <span className="text-xs uppercase tracking-wider text-stone-400">or</span>
                <div className="flex-1 h-px bg-stone-200 dark:bg-stone-800" />
              </div>

              {/* Google Button */}
              <button
                type="button"
                onClick={handleGoogleSubmit}
                disabled={submitting}
                className="w-full min-h-[44px] flex items-center justify-center gap-3 py-2.5 px-4 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-700 dark:text-stone-200 font-medium text-sm transition shadow-sm disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.28-2.1 3.665-5.2 3.665-9.12z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.28 21.44 7.33 24 12 24z" />
                  <path fill="#FBBC05" d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.13z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.28 2.56 1.25 6.58l4.03 3.13c.95-2.83 3.6-4.96 6.72-4.96z" />
                </svg>
                Continue with Google
              </button>

              <p className="mt-5 text-center text-xs text-stone-500">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('register'); setRegisterStep(1); }}
                  className="font-semibold text-stone-900 dark:text-white underline hover:opacity-80"
                >
                  Create one with email
                </button>
              </p>
            </div>
          )}

          {/* MODE: REGISTER - STEP 1 (Enter Email + Password) */}
          {mode === 'register' && registerStep === 1 && (
            <div>
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1.5 uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="w-full pl-10 pr-4 py-2.5 text-base sm:text-sm bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1.5 uppercase tracking-wider">
                    Password (Min 6 Characters)
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="w-full pl-10 pr-4 py-2.5 text-base sm:text-sm bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1.5 uppercase tracking-wider">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="w-full pl-10 pr-4 py-2.5 text-base sm:text-sm bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-white transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-4 bg-stone-900 hover:bg-black dark:bg-white dark:hover:bg-stone-200 text-white dark:text-stone-900 rounded-xl font-medium text-sm transition shadow-sm disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Send Verification Code'
                  )}
                </button>
              </form>

              <div className="my-5 flex items-center gap-3">
                <div className="flex-1 h-px bg-stone-200 dark:bg-stone-800" />
                <span className="text-xs uppercase tracking-wider text-stone-400">or</span>
                <div className="flex-1 h-px bg-stone-200 dark:bg-stone-800" />
              </div>

              {/* Google Option */}
              <button
                type="button"
                onClick={handleGoogleSubmit}
                disabled={submitting}
                className="w-full min-h-[44px] flex items-center justify-center gap-3 py-2.5 px-4 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 rounded-xl text-stone-700 dark:text-stone-200 font-medium text-sm transition shadow-sm disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.28-2.1 3.665-5.2 3.665-9.12z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.28 21.44 7.33 24 12 24z" />
                  <path fill="#FBBC05" d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.13z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.28 2.56 1.25 6.58l4.03 3.13c.95-2.83 3.6-4.96 6.72-4.96z" />
                </svg>
                Sign up with Google
              </button>

              <p className="mt-5 text-center text-xs text-stone-500">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setRegisterStep(1); }}
                  className="font-semibold text-stone-900 dark:text-white underline hover:opacity-80"
                >
                  Sign In
                </button>
              </p>
            </div>
          )}

          {/* MODE: REGISTER - STEP 2 (Verify 6-Digit OTP) */}
          {mode === 'register' && registerStep === 2 && (
            <div>
              <button
                type="button"
                onClick={() => setRegisterStep(1)}
                className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 mb-4 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to edit email
              </button>

              <div className="text-center mb-6">
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-900 dark:text-white">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-stone-900 dark:text-white">
                  Check your email
                </h3>
                <p className="text-xs text-stone-500 mt-1 max-w-xs mx-auto">
                  We sent a 6-digit verification code to <span className="font-semibold text-stone-800 dark:text-stone-200">{email}</span>
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div>
                  <label className="block text-center text-xs font-semibold text-stone-600 dark:text-stone-400 mb-2 uppercase tracking-wider">
                    Enter 6-Digit Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="w-full text-center tracking-[0.5em] font-mono text-2xl font-bold py-3 bg-stone-50 dark:bg-stone-800/80 border border-stone-300 dark:border-stone-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-white transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || otp.length !== 6}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-4 bg-stone-900 hover:bg-black dark:bg-white dark:hover:bg-stone-200 text-white dark:text-stone-900 rounded-xl font-medium text-sm transition shadow-sm disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Verify & Complete Registration
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 text-center">
                {resendCooldown > 0 ? (
                  <p className="text-xs text-stone-400">
                    Resend code in <span className="font-semibold text-stone-600 dark:text-stone-300">{resendCooldown}s</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={submitting}
                    className="text-xs font-medium text-stone-900 dark:text-white underline hover:opacity-80"
                  >
                    Didn't receive code? Resend
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

