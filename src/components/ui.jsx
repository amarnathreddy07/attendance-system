import { Link } from 'react-router-dom';
import { Icons, Icon } from './icons.jsx';

export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v3a5 5 0 0 0-5 5H4z"
      />
    </svg>
  );
}

export function EmptyState({ icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/50 px-6 py-12 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon d={icon} className="h-6 w-6" />
      </span>
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-600">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function BackLink({ to, label }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
    >
      <Icon d={Icons.arrowLeft} className="h-4 w-4" />
      {label || 'Back'}
    </Link>
  );
}

export function StatusPill({ status }) {
  const s = String(status || '').toLowerCase();
  if (s === 'active') {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
        Active
      </span>
    );
  }
  if (s === 'inactive') {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
        Inactive
      </span>
    );
  }
  return <span className="text-xs text-slate-500">{status}</span>;
}

export function PageHeader({ title, subtitle, actions, className = '' }) {
  return (
    <div className={`mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
