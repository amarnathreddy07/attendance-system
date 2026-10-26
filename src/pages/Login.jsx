import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import { Icons, Icon } from '../components/icons.jsx';

export default function Login() {
  const { teacher, bindGoogleButton, authError, backendConfigured, signingIn } = useAuth();
  const navigate = useNavigate();
  const buttonRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (teacher) navigate('/', { replace: true });
  }, [teacher, navigate]);

  useEffect(() => {
    const element = buttonRef.current;
    if (!element) return undefined;
    if (!backendConfigured) {
      setError('Backend is not configured. Set VITE_GOOGLE_CLIENT_ID and VITE_API_URL, then rebuild.');
      return undefined;
    }
    return bindGoogleButton(element, {
      onError: (err) => {
        setError(err?.message || 'Sign-in failed. Please try again.');
      },
    });
  }, [bindGoogleButton, backendConfigured]);

  const message = error || authError || '';

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent px-4 py-10 sm:px-6 lg:px-8">
      <div className="fade-in w-full max-w-6xl">
        <div className="grid items-stretch gap-5 rounded-[32px] border border-slate-200/80 bg-white/80 p-3 shadow-lift backdrop-blur-xl sm:gap-6 sm:p-5 lg:grid-cols-2 lg:gap-6 lg:p-6">
          <div className="flex h-full flex-col justify-center rounded-[26px] bg-gradient-to-br from-brand-50 via-white to-indigo-50 p-5 sm:p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
              <Icon d={Icons.clipboard} className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Welcome back
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600 sm:text-base">
              Sign in with your university Google account. Access is limited to teachers listed by an
              administrator.
            </p>

            <div className="mt-4 rounded-xl border border-brand-100 bg-white/80 p-3 shadow-sm">
              <p className="flex items-start gap-2.5 text-xs leading-5 text-slate-600 sm:text-sm">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Icon d={Icons.lock} className="h-3.5 w-3.5" />
                </span>
                Attendance you mark offline is saved on this device and synced automatically once you are
                back online.
              </p>
            </div>
          </div>

          <div className="card w-full rounded-[26px] p-6 sm:p-8">
            <div className="mb-4">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Sign in to AttendIt</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Your role and class access are decided by the server, not by this device.
              </p>
            </div>

            {backendConfigured ? (
              <div className="flex min-h-[52px] w-full items-center justify-center">
                <div ref={buttonRef} className="google-button-host" />
                {signingIn ? (
                  <p className="ml-3 text-sm font-medium text-slate-500">Signing in…</p>
                ) : null}
              </div>
            ) : (
              <button type="button" className="btn-primary mt-6 w-full py-3 text-base" disabled>
                Sign In with Google
              </button>
            )}

            {message ? <p className="mt-4 text-sm font-medium text-rose-600">{message}</p> : null}

            <p className="mt-4 text-center text-xs leading-5 text-slate-400">
              Signed out devices never lose attendance — it stays queued until this account signs in
              again.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
