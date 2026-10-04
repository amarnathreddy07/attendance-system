import { Link, NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../state/AppContext.jsx';
import { Icons, Icon } from './icons.jsx';
import Sidebar from './Sidebar.jsx';
import InstallApp from './InstallApp.jsx';

export default function Layout() {
  const { teacher, online } = useApp();

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden lg:flex-row">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
            <div className="lg:hidden">
              <Link to="/" className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
                  <Icon d={Icons.clipboard} className="h-5 w-5" />
                </span>
                <span className="text-lg font-bold tracking-tight text-slate-900">
                  Attend<span className="text-brand-600">It</span>
                </span>
              </Link>
            </div>
            <div className="flex flex-1 items-center justify-end gap-2">
              <span
                className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex ${
                  online
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-rose-50 text-rose-700'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                {online ? 'Online' : 'Offline'}
              </span>
              <InstallApp variant="header" />
              <NavLink
                to="/settings"
                data-tour="tour-settings"
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icon d={Icons.settings} className="h-4.5 w-4.5" />
                <span className="hidden sm:inline">Settings</span>
              </NavLink>
            </div>
          </div>
        </header>

        <main className="flex-1 lg:pl-2">
          <Outlet />
        </main>

        <footer className="sticky bottom-0 border-t border-slate-200 bg-white py-2">
          <div className="mx-auto flex max-w-6xl items-center justify-center gap-1 px-4 text-center text-[11px] text-slate-500">
            <Icon d={Icons.lock} className="h-3 w-3" />
            Your application data is stored locally on this device. Signed in locally as {teacher?.name || 'demo'}.
          </div>
        </footer>
      </div>
    </div>
  );
}
