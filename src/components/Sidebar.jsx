import { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Icons, Icon } from './icons.jsx';
import { useApp } from '../state/AppContext.jsx';
import { useAuth } from '../state/AuthContext.jsx';

function LiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  const day = now.toLocaleDateString('en-US', { weekday: 'long' });

  return (
    <div className="px-4 pt-2 pb-4">
      <p className="text-center text-3xl font-bold tabular-nums text-slate-900">{time}</p>
      <div className="mt-0.5 pl-[3.5ch]">
        <p className="text-sm text-slate-500">{day}</p>
        <p className="text-sm text-slate-500">{date}</p>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { isAdmin, teacher, pendingSync } = useApp();
  const { signOut } = useAuth();

  const links = [
    { to: '/', icon: Icons.home, label: 'Dashboard' },
    { to: '/history', icon: Icons.history, label: 'Attendance History' },
  ];
  if (isAdmin) {
    links.push({ to: '/admin', icon: Icons.users, label: 'Admin' });
  }

  return (
    <aside className="hidden w-[260px] shrink-0 border-r border-slate-200 bg-white/80 backdrop-blur-xl lg:flex lg:flex-col">
      <div className="sticky top-0 flex h-16 items-center border-b border-slate-200 bg-white/80 px-4">
        <Link to="/" className="flex items-center gap-2.5" data-tour="tour-logo">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/20">
            <Icon d={Icons.clipboard} className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            Attend<span className="text-brand-600">It</span>
          </span>
        </Link>
      </div>

      <div className="px-4 pb-3 pt-4">
        <LiveClock />
      </div>

      <nav className="flex flex-1 flex-col gap-1 border-t border-slate-200 px-4 pt-4">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            data-tour={link.to === '/history' ? 'tour-history' : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-100'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${isActive ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>
                  <Icon d={link.icon} className="h-4 w-4" />
                </span>
                {link.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-3 border-t border-slate-200 p-4">
        <NavLink
          to="/faq"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
              isActive
                ? 'bg-brand-50 text-brand-700 shadow-sm ring-1 ring-brand-100'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${isActive ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>
                <Icon d={Icons.info} className="h-4 w-4" />
              </span>
              FAQ
            </>
          )}
        </NavLink>

        {pendingSync > 0 && (
          <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
            <Icon d={Icons.cloud} className="h-4 w-4" />
            {pendingSync} change{pendingSync === 1 ? '' : 's'} waiting to sync
          </p>
        )}

        {teacher && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-sm font-bold text-brand-700">
                {teacher.name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{teacher.name}</p>
                <p className="truncate text-xs text-slate-500">{teacher.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              <Icon d={Icons.logout} className="h-4 w-4" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
