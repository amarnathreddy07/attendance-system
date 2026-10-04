import { useEffect, useState } from 'react';
import { Icons, Icon } from './icons.jsx';
import { Spinner } from './ui.jsx';

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    navigator.standalone === true
  );
}

export default function InstallApp({ variant = 'settings' }) {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(isStandalone());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
    } catch {
      /* user dismissed the prompt */
    } finally {
      setBusy(false);
    }
  };

  if (variant === 'header') {
    if (installed || !deferred) return null;
    return (
      <button
        type="button"
        onClick={install}
        disabled={busy}
        title="Install AttendIt on this device"
        className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
      >
        {busy ? <Spinner className="h-4 w-4" /> : <Icon d={Icons.download} className="h-4 w-4" />}
        <span className="hidden sm:inline">Install</span>
      </button>
    );
  }

  return (
    <section className="card p-5">
      <h2 className="text-base font-bold text-slate-900">Install App</h2>
      <p className="mt-0.5 text-sm text-slate-500">Put AttendIt on your desktop or home screen — it works offline.</p>
      <div className="mt-4">
        {installed ? (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            AttendIt is installed and running as an app.
          </p>
        ) : deferred ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button className="btn-primary" onClick={install} disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : <Icon d={Icons.download} className="h-4 w-4" />} Install App
            </button>
            <p className="text-sm text-slate-500">
              Adds an app icon to your desktop or Start menu. Your data stays on this device.
            </p>
          </div>
        ) : (
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
            <p className="font-semibold text-slate-700">Install from your browser's menu:</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>
                <strong>Chrome / Edge:</strong> menu (⋮) → <em>Install app…</em> / <em>Cast, save and share</em> →{' '}
                <em>Install page as app</em>
              </li>
              <li>
                <strong>iPhone / iPad:</strong> Share → <em>Add to Home Screen</em>
              </li>
              <li>
                <strong>Android:</strong> menu (⋮) → <em>Add to Home screen</em>
              </li>
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
