import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import db, { STUDENT_STATUS } from '../db/db.js';
import {
  deleteClass,
  discardSession,
  getInProgressSession,
  getSessionsForClass,
  getStudentsForClass,
} from '../db/repositories.js';
import { formatDate } from '../lib/utils.js';
import { exportClass, downloadClassExport } from '../lib/classExport.js';
import { useApp } from '../state/AppContext.jsx';
import Dropdown from '../components/Dropdown.jsx';
import { EmptyState } from '../components/ui.jsx';
import { Confirm } from '../components/Modal.jsx';
import { Icons, Icon } from '../components/icons.jsx';
import WelcomeModal from '../components/WelcomeModal.jsx';
import FeatureTour from '../components/FeatureTour.jsx';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function ClassCard({ klass, navigate, onDelete }) {
  const { pushToast } = useApp();
  const students = useLiveQuery(() => getStudentsForClass(klass.id, { includeInactive: true }), [klass.id]);
  const activeCount = useMemo(
    () => (students || []).filter((s) => s.status === STUDENT_STATUS.ACTIVE).length,
    [students]
  );
  const sessions = useLiveQuery(() => getSessionsForClass(klass.id), [klass.id]);
  const inProgress = useLiveQuery(() => getInProgressSession(klass.id), [klass.id]);

  const lastSession = sessions && sessions.length ? sessions[sessions.length - 1] : null;

  const handleExport = async () => {
    try {
      const data = await exportClass(klass.id);
      const filename = `${(klass.class_name || 'class').replace(/\s+/g, '-').toLowerCase()}-export.json`;
      downloadClassExport(data, filename);
      pushToast({ type: 'success', title: 'Class exported', message: 'Downloaded class export file.' });
    } catch (err) {
      pushToast({ type: 'error', title: 'Export failed', message: err.message });
    }
  };

  const menu = [
    { label: 'Edit Class', icon: Icons.pencil, onClick: () => navigate(`/classes/${klass.id}/edit`) },
    { label: 'Export JSON', icon: Icons.download, onClick: handleExport },
    { label: 'Delete Class', icon: Icons.trash, danger: true, onClick: () => onDelete(klass) },
  ];

  return (
    <div className="card fade-in flex flex-col p-5 transition hover:shadow-lift" data-tour="tour-class-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 text-left">
          <h3 className="truncate text-lg font-bold text-slate-900">
            {klass.class_name}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {klass.year ? `Year ${klass.year}` : ''}{klass.semester ? `${klass.year ? ' · ' : ''}Semester ${klass.semester}` : ''}{klass.section ? `${klass.year || klass.semester ? ' · ' : ''}Section ${klass.section}` : ''}
          </p>
        </div>
        <Dropdown items={menu} />
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-sm text-slate-600">
        <Icon d={Icons.users} className="h-4 w-4 text-slate-400" />
        {activeCount} student{activeCount === 1 ? '' : 's'}
      </div>

      <div className="mt-1.5 text-sm text-slate-500">
        {lastSession ? (
          <span>
            Last attendance:{' '}
            <span className="font-semibold text-slate-700">{formatDate(new Date(lastSession.date))}</span>
          </span>
        ) : (
          <span className="text-slate-400">No attendance yet</span>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button className="btn-secondary flex-1" data-tour="tour-manage" onClick={() => navigate(`/classes/${klass.id}`)}>
          <Icon d={Icons.users} className="h-4 w-4" /> Manage
        </button>
        <button className="btn-primary flex-1" data-tour="tour-take-attendance" onClick={() => navigate(`/classes/${klass.id}/attendance`)}>
          {inProgress ? 'Continue' : 'Take Attendance'}
        </button>
      </div>
    </div>
  );
}

function ClassListItem({ klass, navigate, onDelete }) {
  const { pushToast } = useApp();
  const students = useLiveQuery(() => getStudentsForClass(klass.id, { includeInactive: true }), [klass.id]);
  const activeCount = useMemo(
    () => (students || []).filter((s) => s.status === STUDENT_STATUS.ACTIVE).length,
    [students]
  );
  const sessions = useLiveQuery(() => getSessionsForClass(klass.id), [klass.id]);
  const inProgress = useLiveQuery(() => getInProgressSession(klass.id), [klass.id]);

  const lastSession = sessions && sessions.length ? sessions[sessions.length - 1] : null;

  const handleExport = async () => {
    try {
      const data = await exportClass(klass.id);
      const filename = `${(klass.class_name || 'class').replace(/\s+/g, '-').toLowerCase()}-export.json`;
      downloadClassExport(data, filename);
      pushToast({ type: 'success', title: 'Class exported', message: 'Downloaded class export file.' });
    } catch (err) {
      pushToast({ type: 'error', title: 'Export failed', message: err.message });
    }
  };

  const menu = [
    { label: 'Edit Class', icon: Icons.pencil, onClick: () => navigate(`/classes/${klass.id}/edit`) },
    { label: 'Export JSON', icon: Icons.download, onClick: handleExport },
    { label: 'Delete Class', icon: Icons.trash, danger: true, onClick: () => onDelete(klass) },
  ];

  return (
    <div className="card fade-in flex items-center gap-4 p-4 transition hover:shadow-lift">
      <div className="min-w-0 flex-1 text-left">
        <h3 className="truncate text-base font-bold text-slate-900">
          {klass.class_name}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          {klass.year ? `Year ${klass.year}` : ''}{klass.semester ? `${klass.year ? ' · ' : ''}Semester ${klass.semester}` : ''}{klass.section ? `${klass.year || klass.semester ? ' · ' : ''}Section ${klass.section}` : ''}
        </p>
        <div className="mt-1.5 flex items-center gap-4 text-sm text-slate-500">
          <span className="flex items-center gap-1">
            <Icon d={Icons.users} className="h-3.5 w-3.5 text-slate-400" />
            {activeCount} student{activeCount === 1 ? '' : 's'}
          </span>
          <span>
            {lastSession ? `Last: ${formatDate(new Date(lastSession.date))}` : 'No attendance yet'}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button className="btn-secondary px-3 py-2 text-sm" onClick={() => navigate(`/classes/${klass.id}`)}>
          Manage
        </button>
        <button className="btn-primary px-3 py-2 text-sm" onClick={() => navigate(`/classes/${klass.id}/attendance`)}>
          {inProgress ? 'Continue' : 'Take Attendance'}
        </button>
        <Dropdown items={menu} />
      </div>
    </div>
  );
}

function UnfinishedCard({ klass, session, records, total }) {
  const { pushToast } = useApp();
  const navigate = useNavigate();
  const done = records ? Object.keys(records).length : 0;

  const discard = async () => {
    await discardSession(session.id);
    pushToast({ type: 'info', title: 'Session discarded', message: 'The unfinished attendance was removed.' });
  };

  return (
    <div className="card flex flex-col gap-3 border-amber-200 bg-amber-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          Unfinished attendance
        </p>
        <p className="mt-0.5 text-sm text-amber-800">
          {klass.class_name}
          {klass.section ? ` · ${klass.section}` : ''} — {done} / {total} students
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button className="btn-secondary" onClick={discard}>
          Discard
        </button>
        <button className="btn-primary" onClick={() => navigate(`/classes/${klass.id}/attendance`)}>
          Continue
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { teacher, pushToast } = useApp();
  const navigate = useNavigate();
  const classes = useLiveQuery(() => db.classes.orderBy('created_at').reverse().toArray(), []);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [viewMode, setViewMode] = useState('grid');

  const [showWelcome, setShowWelcome] = useState(false);
  const [showTour, setShowTour] = useState(false);

  const tourCompleted = useLiveQuery(() => db.settings.get('tour_completed'));

  useEffect(() => {
    if (tourCompleted !== undefined && tourCompleted?.value === false) {
      setShowWelcome(true);
    }
  }, [tourCompleted]);

  const handleSkipTour = async () => {
    await db.settings.put({ key: 'tour_completed', value: true });
    setShowWelcome(false);
  };

  const handleStartTour = () => {
    setShowWelcome(false);
    setShowTour(true);
  };

  const handleTourComplete = async () => {
    await db.settings.put({ key: 'tour_completed', value: true });
    setShowTour(false);
  };

  const unfinished = useLiveQuery(async () => {
    if (!classes || classes.length === 0) return [];
    const out = [];
    for (const c of classes) {
      const session = await getInProgressSession(c.id);
      if (session) {
        const students = await getStudentsForClass(c.id, { includeInactive: false });
        const records = await db.attendance_records.where('attendance_session_id').equals(session.id).toArray();
        out.push({ klass: c, session, records, total: students.length });
      }
    }
    return out;
  }, [classes]);

  return (
    <div className="mx-auto max-w-6xl px-4 overflow-hidden">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl mt-8">
            {greeting()}, Professor {teacher?.name?.split(' ')[0] || '…'}
          </h1>
        </div>
      </div>

      {unfinished && unfinished.length > 0 && (
        <div className="mb-6 space-y-3">
          {unfinished.map(({ klass, session, records, total }) => (
            <UnfinishedCard
              key={session.id}
              klass={klass}
              session={session}
              records={records}
              total={total}
            />
          ))}
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">My Classes <span className="text-slate-400">·</span> <span className="text-sm font-semibold text-slate-500">{classes?.length || 0} class{(classes || []).length === 1 ? '' : 'es'}</span></h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`rounded-md px-2 py-1 text-sm transition ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon d={Icons.grid} className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-md px-2 py-1 text-sm transition ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon d={Icons.list} className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {classes && classes.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((klass) => (
              <ClassCard key={klass.id} klass={klass} navigate={navigate} onDelete={setConfirmDelete} />
            ))}
            <Link
              to="/classes/new"
              data-tour="tour-add-class"
              className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white/40 p-6 text-center transition hover:border-brand-400 hover:bg-brand-50/40"
            >
              <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <Icon d={Icons.plus} className="h-6 w-6" />
              </span>
              <span className="text-sm font-bold text-brand-700">Add Class</span>
              <span className="mt-1 text-xs text-slate-500">Create a class and import your students</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {classes.map((klass) => (
              <ClassListItem key={klass.id} klass={klass} navigate={navigate} onDelete={setConfirmDelete} />
            ))}
            <Link
              to="/classes/new"
              data-tour="tour-add-class"
              className="flex items-center gap-4 rounded-xl border-2 border-dashed border-slate-300 bg-white/40 p-4 text-left transition hover:border-brand-400 hover:bg-brand-50/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Icon d={Icons.plus} className="h-5 w-5" />
              </span>
              <div>
                <span className="text-sm font-bold text-brand-700">Add Class</span>
                <span className="block text-xs text-slate-500">Create a class and import your students</span>
              </div>
            </Link>
          </div>
        )
      ) : (
        <EmptyState
          icon={Icons.users}
          title="No classes yet"
          message="Create your first class, then take attendance — completely offline."
          action={
            <Link to="/classes/new" data-tour="tour-add-class" className="btn-primary">
              <Icon d={Icons.plus} className="h-4 w-4" /> Add Class
            </Link>
          }
        />
      )}

      <Confirm
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          await deleteClass(confirmDelete.id);
          pushToast({ type: 'info', title: 'Class deleted', message: `${confirmDelete.class_name} and its data were removed.` });
        }}
        title="Delete class?"
        message={`This permanently removes "${confirmDelete?.class_name}" including students and attendance history. Consider exporting a backup first.`}
        confirmLabel="Delete Class"
        danger
      />

      <WelcomeModal
        open={showWelcome}
        onClose={handleSkipTour}
        onStartTour={handleStartTour}
      />
      <FeatureTour
        open={showTour}
        onComplete={handleTourComplete}
      />
    </div>
  );
}
