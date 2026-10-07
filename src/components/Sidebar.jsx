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
    <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
      <div className="sticky top-0 flex h-16 items-center border-b border-slate-200 bg-white px-4">
        <Link to="/" className="flex items-center gap-2.5" data-tour="tour-logo">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Icon d={Icons.clipboard} className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            Attend<span className="text-brand-600">It</span>
          </span>
        </Link>
      </div>
      <LiveClock />
      <nav className="flex flex-1 flex-col gap-1 border-t border-slate-200 px-4 pt-4">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            data-tour={link.to === '/history' ? 'tour-history' : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <Icon d={link.icon} className="h-5 w-5" />
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-3 border-t border-slate-200 p-4">
        <NavLink
          to="/faq"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              isActive
                ? 'bg-brand-50 text-brand-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`
          }
        >
          <Icon d={Icons.info} className="h-5 w-5" />
          FAQ
        </NavLink>

        {pendingSync > 0 && (
          <p className="flex items-center gap-2 px-3 text-xs font-semibold text-amber-600">
            <Icon d={Icons.cloud} className="h-4 w-4" />
            {pendingSync} change{pendingSync === 1 ? '' : 's'} waiting to sync
          </p>
        )}

        {teacher && (
          <div className="rounded-xl bg-slate-50 px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-slate-800">{teacher.name}</p>
            <p className="truncate text-xs text-slate-500">{teacher.email}</p>
            <button
              type="button"
              onClick={() => signOut()}
              className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
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
