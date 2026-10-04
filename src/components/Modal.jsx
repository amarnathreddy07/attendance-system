import { useEffect } from 'react';
import { Icons, Icon } from './icons.jsx';

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`fade-in relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-lift sm:rounded-2xl ${sizes[size] || sizes.md}`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <Icon d={Icons.x} className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Confirm({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  confirmCode = null,
  userInput = '',
  onInputChange = null,
}) {
  const requiresCode = !!confirmCode;
  const codeMatches = userInput === confirmCode;

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm leading-6 text-slate-600">{message}</p>

      {requiresCode && (
        <div className="mt-6 space-y-4">
          <div className="rounded-lg border-2 border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Type these numbers to confirm:</p>
            <p className="mt-2 font-mono text-2xl font-black text-amber-900">{confirmCode}</p>
          </div>
          <div>
            <label className="label text-sm" htmlFor="clear-confirm-input">
              Confirmation Code
            </label>
            <input
              id="clear-confirm-input"
              type="text"
              className="input font-mono text-lg tracking-wider"
              placeholder="Enter the numbers above"
              value={userInput}
              onChange={(e) => onInputChange?.(e.target.value)}
              autoComplete="off"
            />
            {userInput && !codeMatches && (
              <p className="mt-2 text-xs font-medium text-rose-600">❌ Numbers don't match</p>
            )}
            {codeMatches && (
              <p className="mt-2 text-xs font-medium text-emerald-600">✓ Verified — ready to delete</p>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className={danger ? 'btn-danger' : 'btn-primary'}
          disabled={requiresCode && !codeMatches}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
