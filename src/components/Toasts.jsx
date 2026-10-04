import { useEffect } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { Icons, Icon } from './icons.jsx';

const STYLES = {
  success: { border: 'border-emerald-200', bg: 'bg-white', icon: Icons.checkCircle, color: 'text-emerald-600' },
  error: { border: 'border-rose-200', bg: 'bg-white', icon: Icons.alert, color: 'text-rose-600' },
  info: { border: 'border-sky-200', bg: 'bg-white', icon: Icons.info, color: 'text-sky-600' },
};

export default function Toasts() {
  const { toasts } = useApp();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => {
        const s = STYLES[t.type] || STYLES.success;
        return (
          <div
            key={t.id}
            className={`fade-in pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border ${s.border} ${s.bg} px-4 py-3 shadow-lift`}
          >
            <Icon d={s.icon} className={`mt-0.5 h-5 w-5 shrink-0 ${s.color}`} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{t.title}</p>
              {t.message && <p className="mt-0.5 text-sm text-slate-600">{t.message}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
