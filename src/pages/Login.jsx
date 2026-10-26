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
    <div className="flex min-h-screen items-center justify-center bg-transparent px-4 py-10 sm:px-6 lg:px-8">
      <div className="fade-in w-full max-w-6xl">
        <div className="grid items-center gap-8 rounded-[30px] border border-slate-200/80 bg-white/80 p-4 shadow-lift backdrop-blur-xl sm:p-6 lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
          <div className="flex flex-col justify-center rounded-[26px] bg-gradient-to-br from-brand-50 via-white to-indigo-50 p-6 sm:p-8">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/20">
              <Icon d={Icons.clipboard} className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Welcome back
            </h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-slate-600 sm:text-lg">
              Sign in with your university Google account. Access is limited to teachers listed by an
              administrator.
            </p>

            <div className="mt-7 rounded-2xl border border-brand-100 bg-white/80 p-4 shadow-sm">
              <p className="flex items-start gap-3 text-sm leading-6 text-slate-600">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon d={Icons.lock} className="h-4 w-4" />
                </span>
                Attendance you mark offline is saved on this device and synced automatically once you are
                back online.
              </p>
            </div>
          </div>

          <div className="flex h-full items-center">
            <div className="card w-full p-6 sm:p-7">
              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Sign In</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Your role and class access are decided by the server, not by this device.
                </p>
              </div>

              <div className="flex min-h-[52px] items-center justify-center">
                <div ref={buttonRef} className="google-button-host" />
                {signingIn || pending ? (
                  <p className="ml-3 text-sm font-medium text-slate-500">Signing in…</p>
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

              <p className="mt-6 text-center text-xs leading-5 text-slate-400">
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
