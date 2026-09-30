import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTeacher } from '../db/repositories.js';
import { useApp } from '../state/AppContext.jsx';
import { Icons, Icon } from '../components/icons.jsx';
import db from '../db/db.js';

export default function Onboarding() {
  const { pushToast } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createTeacher({ name, email });
      await db.settings.put({ key: 'tour_completed', value: false });
      pushToast({ type: 'success', title: 'Profile created', message: `Welcome, ${name.trim()}!` });
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 via-white to-white px-4 py-12">
      <div className="fade-in w-full max-w-5xl">
        <div className="grid gap-8 sm:grid-cols-2">
          <div className="flex flex-col justify-center">
            <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lift">
              <Icon d={Icons.clipboard} className="h-8 w-8" />
            </span>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">Welcome</h1>
            <p className="mt-4 text-lg text-slate-600">
              Set up your teacher profile. Everything is stored privately on this device.
            </p>
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="flex items-start gap-2 text-sm text-slate-600">
                <Icon d={Icons.lock} className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                No account, no cloud — this profile lives only in your browser.
              </p>
            </div>
          </div>

          <div>
            <form onSubmit={submit} className="card p-6 sm:p-8">
              <h2 className="mb-6 text-xl font-bold text-slate-900">Create Your Profile</h2>
              <div className="mb-4">
                <label className="label" htmlFor="t-name">
                  Teacher Name
                </label>
                <input
                  id="t-name"
                  className="input"
                  placeholder="Professor Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="mb-2">
                <label className="label" htmlFor="t-email">
                  Email <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="t-email"
                  className="input"
                  type="email"
                  placeholder="you@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
              <button className="btn-primary mt-6 w-full py-3 text-base" disabled={saving}>
                {saving ? 'Creating…' : 'Create Profile'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
