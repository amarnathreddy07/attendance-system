import { useState, useEffect, useRef } from 'react';
import { Icons, Icon } from './icons.jsx';

const TOUR_STEPS = [
  {
    target: 'tour-add-class',
    title: 'Create a Class',
    text: 'Start here — create a class and import students via CSV or manually.',
    placement: 'bottom',
  },
  {
    target: 'tour-class-card',
    title: 'Class Card',
    text: 'Each class shows student count, last attendance date, and quick actions.',
    placement: 'top',
  },
  {
    target: 'tour-take-attendance',
    title: 'Take Attendance',
    text: 'Click here to start marking students Present or Absent. Use keyboard shortcuts for speed!',
    placement: 'top',
  },
  {
    target: 'tour-manage',
    title: 'Manage Class',
    text: 'View and edit students, upload CSVs, change class settings, and export data.',
    placement: 'top',
  },
  {
    target: 'tour-history',
    title: 'Attendance History',
    text: 'View past sessions on a calendar. Click any day with a ✓ to see details.',
    placement: 'bottom',
  },
  {
    target: 'tour-settings',
    title: 'Settings',
    text: 'Edit your profile, export/import backups, and manage app preferences.',
    placement: 'left',
  },
];

function TourOverlay({ step, onNext, onSkip, onPrev, total, current }) {
  const targetRef = useRef(null);
  const tooltipRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) {
      onNext();
      return;
    }
    targetRef.current = el;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const rect = el.getBoundingClientRect();
    const gap = 12;
    let top, left;

    switch (step.placement) {
      case 'bottom':
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2;
        break;
      case 'top':
        top = rect.top - gap;
        left = rect.left + rect.width / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - gap;
        break;
      default:
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2;
    }

    setPos({ top, left });
  }, [step]);

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/40" onClick={onSkip} />
      <div
        ref={tooltipRef}
        className="fade-in absolute z-[101] w-72 rounded-xl bg-white p-4 shadow-xl"
        style={{
          top: pos.top,
          left: pos.left,
          transform:
            step.placement === 'top'
              ? 'translate(-50%, -100%)'
              : step.placement === 'left'
              ? 'translate(-100%, -50%)'
              : 'translate(-50%, 0)',
        }}
      >
        <p className="text-sm font-bold text-slate-900">{step.title}</p>
        <p className="mt-1 text-xs text-slate-600">{step.text}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-400">
            {current + 1} of {total}
          </span>
          <div className="flex gap-1.5">
            {current > 0 && (
              <button className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100" onClick={onPrev}>
                Back
              </button>
            )}
            <button className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100" onClick={onSkip}>
              Skip Tour
            </button>
            <button className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-brand-700" onClick={onNext}>
              {current === total - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FeatureTour({ open, onComplete }) {
  const [step, setStep] = useState(0);

  if (!open || step >= TOUR_STEPS.length) return null;

  const handleNext = () => {
    if (step === TOUR_STEPS.length - 1) {
      onComplete();
    } else {
      setStep(step + 1);
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <TourOverlay
      step={TOUR_STEPS[step]}
      onNext={handleNext}
      onPrev={handlePrev}
      onSkip={onComplete}
      total={TOUR_STEPS.length}
      current={step}
    />
  );
}
