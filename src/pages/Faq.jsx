import { useState } from 'react';
import { BackLink, PageHeader } from '../components/ui.jsx';
import { Icons, Icon } from '../components/icons.jsx';

const faqs = [
  {
    q: 'Where is my data stored?',
    a: 'All data is stored locally in your browser using IndexedDB. Nothing is sent to any server unless you manually export a backup file.',
  },
  {
    q: 'Will I lose my data if I clear my browser?',
    a: 'Yes. Clearing browser data will delete all attendance records. Always export a backup regularly from Settings to avoid data loss.',
  },
  {
    q: 'How do I back up my data?',
    a: 'Go to Settings → Export Local Data. This downloads a JSON file with all your classes, students, and attendance. You can import it later to restore.',
  },
  {
    q: 'Can I use this on my phone?',
    a: 'Yes. The app works on mobile browsers. You can also install it as a PWA (Progressive Web App) for an app-like experience.',
  },
  {
    q: 'How do I add students to a class?',
    a: 'Open the class → go to Students tab → click Add Student. You can add them manually or import a CSV file.',
  },
  {
    q: 'What CSV format is supported?',
    a: 'The CSV should have columns for Name, Roll Number, Application Number, Email, and optionally PRN Number. The app auto-detects columns.',
  },
  {
    q: 'Can I edit a student\'s details after adding them?',
    a: 'Yes. Go to the Students tab, find the student, and click the edit (pencil) icon to update their information.',
  },
  {
    q: 'How do I mark attendance?',
    a: 'Open a class → click Take Attendance → mark each student as Present or Absent. Use keyboard shortcuts: P for Present, A for Absent, arrow keys to navigate.',
  },
  {
    q: 'Can I change attendance after submitting?',
    a: 'Yes. Go to Attendance History → click on a session → click on any student\'s status badge to toggle between Present and Absent.',
  },
  {
    q: 'What is Presentation Mode?',
    a: 'Presentation Mode is a fullscreen view for taking attendance on a projector or large screen. Click the Presentation Mode button during attendance to activate it.',
  },
  {
    q: 'How do I view attendance reports?',
    a: 'Go to a class → Stats tab to see attendance percentages, trends, and best/worst sessions. You can also export the data as CSV.',
  },
  {
    q: 'Can I delete a class?',
    a: 'Yes. On the Dashboard, click the three-dot menu on a class card and select Delete Class. Consider exporting a backup first.',
  },
  {
    q: 'What does "Marked Inactive" mean?',
    a: 'Inactive students are hidden from attendance but their history is preserved. You can toggle their status back to active from the Students tab.',
  },
  {
    q: 'How do I set the attendance threshold?',
    a: 'The threshold determines the minimum attendance percentage required. Edit a class to change this setting. Students below the threshold are flagged in stats.',
  },
  {
    q: 'Can I undo an attendance mark?',
    a: 'Yes. During an active attendance session, click the undo button to revert the last mark. After submission, go to Session Detail to toggle statuses.',
  },
];

function FaqItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card overflow-hidden">
      <button
        className="flex w-full items-center justify-between px-5 py-4 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-bold text-slate-900">{item.q}</span>
        <Icon
          d={open ? Icons.x : Icons.plus}
          className="h-4 w-4 shrink-0 text-slate-400"
        />
      </button>
      {open && (
        <div className="border-t border-slate-100 px-5 py-4">
          <p className="text-sm leading-6 text-slate-600">{item.a}</p>
        </div>
      )}
    </div>
  );
}

export default function Faq() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <BackLink to="/" label="Dashboard" />
      <div className="mt-4">
        <PageHeader title="FAQ" subtitle="Frequently asked questions about AttendIt." />
      </div>
      <div className="space-y-3">
        {faqs.map((item, i) => (
          <FaqItem key={i} item={item} />
        ))}
      </div>
    </div>
  );
}
