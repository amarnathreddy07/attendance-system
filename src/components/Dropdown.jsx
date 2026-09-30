import { useEffect, useRef, useState } from 'react';
import { Icons, Icon } from './icons.jsx';

export default function Dropdown({ button, items = [], align = 'right', className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="inline-flex items-center justify-center rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {button || <Icon d={Icons.dots} className="h-5 w-5" />}
      </button>
      {open && (
        <div
          role="menu"
          className={`fade-in absolute z-20 mt-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lift ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item, i) =>
            item.divider ? (
              <div key={i} className="my-1 border-t border-slate-100" />
            ) : (
              <button
                key={i}
                role="menuitem"
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  item.onClick?.();
                }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium transition disabled:opacity-40 ${
                  item.danger
                    ? 'text-rose-600 hover:bg-rose-50'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.icon && <Icon d={item.icon} className="h-4 w-4 shrink-0" />}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
