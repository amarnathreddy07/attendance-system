import { useState, useLayoutEffect, useRef } from 'react';
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

const GAP = 12;
const EDGE = 12;

function TourOverlay({ step, onNext, onSkip, onPrev, total, current }) {
  const tooltipRef = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) {
      onNext();
      return;
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    setPos(null);

    const update = () => {
      const tip = tooltipRef.current;
      if (!tip) return;

      const target = el.getBoundingClientRect();
      const tipRect = tip.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let place = step.placement;
      const fitsTop = target.top - GAP - tipRect.height - EDGE >= 0;
      const fitsBottom = target.bottom + GAP + tipRect.height + EDGE <= vh;
      const fitsLeft = target.left - GAP - tipRect.width - EDGE >= 0;
      const fitsRight = target.right + GAP + tipRect.width + EDGE <= vw;

      if (place === 'top' && !fitsTop && fitsBottom) place = 'bottom';
      else if (place === 'bottom' && !fitsBottom && fitsTop) place = 'top';
      else if (place === 'left' && !fitsLeft && fitsRight) place = 'right';

      let top;
      let left;
      if (place === 'top') {
        top = target.top - GAP - tipRect.height;
        left = target.left + target.width / 2 - tipRect.width / 2;
      } else if (place === 'left') {
        top = target.top + target.height / 2 - tipRect.height / 2;
        left = target.left - GAP - tipRect.width;
      } else if (place === 'right') {
        top = target.top + target.height / 2 - tipRect.height / 2;
        left = target.right + GAP;
      } else {
        top = target.bottom + GAP;
        left = target.left + target.width / 2 - tipRect.width / 2;
      }

      top = Math.min(Math.max(top, EDGE), Math.max(EDGE, vh - tipRect.height - EDGE));
      left = Math.min(Math.max(left, EDGE), Math.max(EDGE, vw - tipRect.width - EDGE));

      setPos((prev) =>
        prev && Math.abs(prev.top - top) < 0.5 && Math.abs(prev.left - left) < 0.5
          ? prev
          : { top, left }
      );
      return { top, left };
    };

    let raf = 0;
    let stableFrames = 0;
    let last = null;
    const loop = () => {
      const next = update();
      if (last && next && Math.abs(last.top - next.top) < 0.5 && Math.abs(last.left - next.left) < 0.5) {
        stableFrames += 1;
      } else {
        stableFrames = 0;
      }
      last = next;
      if (stableFrames < 6) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [step]);

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/40" onClick={onSkip} />
      <div
        ref={tooltipRef}
        className={`fade-in absolute z-[101] w-72 max-w-[calc(100vw-24px)] rounded-xl bg-white p-4 shadow-xl ${pos ? '' : 'invisible opacity-0'}`}
        style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0 }}
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
