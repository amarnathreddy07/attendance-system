import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import { Icons, Icon } from '../components/icons.jsx';

export default function Login() {
  const { teacher, signInWithGoogle, bindGoogleButton, authError, backendConfigured, signingIn } = useAuth();
  const navigate = useNavigate();
  const buttonRef = useRef(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

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
      onSuccess: () => setPending(false),
      onError: (err) => {
        setPending(false);
        setError(err?.message || 'Sign-in failed. Please try again.');
      },
    });
  }, [bindGoogleButton, backendConfigured]);

  const message = error || authError || '';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 via-white to-white px-4 py-12">
      <div className="fade-in w-full max-w-5xl">
        <div className="grid gap-8 sm:grid-cols-2">
          <div className="flex flex-col justify-center">
            <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lift">
              <Icon d={Icons.clipboard} className="h-8 w-8" />
            </span>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">Welcome back</h1>
            <p className="mt-4 text-lg text-slate-600">
              Sign in with your university Google account. Access is limited to teachers listed by an
              administrator.
            </p>
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="flex items-start gap-2 text-sm text-slate-600">
                <Icon d={Icons.lock} className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                Attendance you mark offline is saved on this device and synced automatically once you are
                back online.
              </p>
            </div>
          </div>

          <div>
            <div className="card p-6 sm:p-8">
              <h2 className="mb-2 text-xl font-bold text-slate-900">Sign In</h2>
              <p className="mb-6 text-sm text-slate-500">
                Your role and class access are decided by the server, not by this device.
              </p>

              <div className="flex min-h-[44px] items-center justify-center">
                <div ref={buttonRef} className="google-button-host" />
                {signingIn || pending ? (
                  <p className="text-sm text-slate-500">Signing in…</p>
                ) : null}
              </div>

              {!backendConfigured ? (
                <button type="button" className="btn-primary mt-6 w-full py-3 text-base" disabled>
                  Sign In with Google
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-secondary mt-6 w-full py-3 text-base"
                  onClick={() => {
                    setPending(true);
                    setError('');
                    signInWithGoogle().catch(() => setPending(false));
                  }}
                >
                  Use a Google popup
                </button>
              )}

              {message ? <p className="mt-4 text-sm font-medium text-rose-600">{message}</p> : null}

              <p className="mt-6 text-center text-xs text-slate-400">
                Signed out devices never lose attendance — it stays queued until this account signs in
                again.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
