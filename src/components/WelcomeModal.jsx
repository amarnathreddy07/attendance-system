import { useState } from 'react';
import { Icons, Icon } from './icons.jsx';

const features = [
  {
    icon: Icons.users,
    title: 'Class Management',
    desc: 'Create classes with year, semester, section, and attendance threshold.',
  },
  {
    icon: Icons.upload,
    title: 'CSV Import',
    desc: 'Import students from a CSV file with smart column detection.',
  },
  {
    icon: Icons.clipboard,
    title: 'Quick Attendance',
    desc: 'Mark Present/Absent with one tap or keyboard shortcuts.',
  },
  {
    icon: Icons.calendar,
    title: 'Calendar History',
    desc: 'View attendance records on a monthly calendar.',
  },
  {
    icon: Icons.download,
    title: 'Backup & Export',
    desc: 'Export your data as JSON backup or CSV reports.',
  },
];

const cautions = [
  'Clearing browser data will delete all attendance records.',
  'Export a backup regularly to avoid data loss.',
  'This app stores data locally in your browser (IndexedDB).',
  'No data is sent to any server unless you enable cloud sync.',
];

export default function WelcomeModal({ open, onClose, onStartTour }) {
  const [step, setStep] = useState(0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="fade-in w-full max-w-lg rounded-2xl bg-white shadow-xl">
        {step === 0 && (
          <div className="p-6 sm:p-8">
            <div className="mb-4 flex justify-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lift">
                <Icon d={Icons.clipboard} className="h-8 w-8" />
              </span>
            </div>
            <h2 className="text-center text-2xl font-bold text-slate-900">Welcome to AttendIt!</h2>
            <p className="mt-2 text-center text-slate-600">
              Your attendance management app is ready. Here's what you can do:
            </p>
            <div className="mt-6 space-y-3">
              {features.map((f, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <Icon d={f.icon} className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">{f.title}</p>
                    <p className="text-xs text-slate-500">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-bold text-amber-800">Important:</p>
              <ul className="mt-1 space-y-1">
                {cautions.map((c, i) => (
                  <li key={i} className="text-xs text-amber-700">• {c}</li>
                ))}
              </ul>
            </div>
            <div className="mt-6 flex gap-2">
              <button className="btn-secondary flex-1" onClick={onClose}>
                Skip Tour
              </button>
              <button className="btn-primary flex-1" onClick={() => { setStep(1); onStartTour?.(); }}>
                Take a Tour
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
