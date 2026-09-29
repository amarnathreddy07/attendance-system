import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import db, { RECORD_STATUS } from '../db/db.js';
import {
  getStudentsForClass,
  getInProgressSession,
  createSession,
  upsertRecord,
  getRecordMap,
  deleteRecordByStudent,
  getSessionsOnDate,
} from '../db/repositories.js';
import { toDateKey, formatDateLabel } from '../lib/utils.js';
import { useApp } from '../state/AppContext.jsx';
import Modal from '../components/Modal.jsx';
import { BackLink, EmptyState } from '../components/ui.jsx';
import { Icons, Icon } from '../components/icons.jsx';

function CountPill({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-center">
      <p className={`text-lg font-bold ${tone}`}>{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

function KeyCap({ children, dark = false }) {
  return (
    <kbd
      className={`rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-bold ${
        dark ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-300 bg-white text-slate-900'
      }`}
    >
      {children}
    </kbd>
  );
}

function Legend({ dark = false }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold">
      <span className="flex items-center gap-1.5">
        <KeyCap dark={dark}>A</KeyCap> <span className="text-slate-400">→</span> Absent
      </span>
      <span className="flex items-center gap-1.5">
        <KeyCap dark={dark}>→</KeyCap> / <KeyCap dark={dark}>Next</KeyCap> <span className="text-slate-400">→</span> Present + Forward
      </span>
      <span className="flex items-center gap-1.5">
        <KeyCap dark={dark}>←</KeyCap> / <KeyCap dark={dark}>Back</KeyCap> <span className="text-slate-400">→</span> Backward traversal only
      </span>
    </div>
  );
}

export default function AttendanceSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pushToast } = useApp();
  const klass = useLiveQuery(() => db.classes.get(id), [id]);

  const students = useLiveQuery(() => getStudentsForClass(id, { includeInactive: false }), [id]);
  const session = useLiveQuery(() => getInProgressSession(id), [id]);
  const records = useLiveQuery(async () => (session ? getRecordMap(session.id) : {}), [session?.id]);
  const todaySessions = useLiveQuery(async () => getSessionsOnDate(id, toDateKey(new Date())), [id]);

  const [index, setIndex] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [actions, setActions] = useState([]);
  const [sessionName, setSessionName] = useState('');
  const [namePageReady, setNamePageReady] = useState(false);
  const lastMark = useRef(0);
  const creating = useRef(false);
  const onKeyRef = useRef(() => {});

  useEffect(() => {
    if (session || creating.current || namePageReady) return;
    if (todaySessions === undefined) return;
    if (todaySessions.length > 0) {
      setSessionName(`Session ${todaySessions.length + 1}`);
      setNamePageReady(true);
    } else {
      creating.current = true;
      createSession(id)
        .catch((err) => pushToast({ type: 'error', title: 'Could not start session', message: err.message }))
        .finally(() => {
          creating.current = false;
        });
    }
  }, [session, todaySessions, namePageReady, id, pushToast]);

  const startWithName = () => {
    setNamePageReady(false);
    creating.current = true;
    createSession(id, sessionName.trim() || undefined)
      .catch((err) => pushToast({ type: 'error', title: 'Could not start session', message: err.message }))
      .finally(() => {
        creating.current = false;
      });
  };

  useEffect(() => {
    if (!students || !records || initialized) return;
    const firstUnmarked = students.findIndex((s) => !records[s.id]);
    setIndex(firstUnmarked === -1 ? 0 : firstUnmarked);
    setInitialized(true);
  }, [students, records, initialized]);

  const markedCount = useMemo(() => (records ? Object.keys(records).length : 0), [records]);
  const presentCount = useMemo(
    () => (records ? Object.values(records).filter((r) => r.status === RECORD_STATUS.PRESENT).length : 0),
    [records]
  );
  const odCount = useMemo(
    () => (records ? Object.values(records).filter((r) => r.status === RECORD_STATUS.OD).length : 0),
    [records]
  );
  const absentCount = markedCount - presentCount - odCount;
  const total = students?.length || 0;
  const remaining = Math.max(0, total - markedCount);

  const current = students?.[index];

  const progressPct = total ? Math.round((markedCount / total) * 100) : 0;

  const mark = async (status) => {
    if (!students || !session || !current || index >= students.length) return;
    const now = Date.now();
    if (now - lastMark.current < 250) return;
    lastMark.current = now;

    if (records[current.id]) {
      // Already marked — preserve the recorded status and just continue.
      setIndex((i) => Math.min(i + 1, students.length - 1));
      return;
    }

    try {
      await upsertRecord(session.id, current.id, status);
      setActions((a) => [...a, { studentId: current.id }]);
      setIndex((i) => Math.min(i + 1, students.length - 1));
    } catch (err) {
      pushToast({ type: 'error', title: 'Could not save attendance', message: err.message });
    }
  };

  const goPrevious = () => {
    if (index > 0) setIndex((i) => i - 1);
  };

  const undoLast = async () => {
    if (!session || actions.length === 0) return;
    const action = actions[actions.length - 1];
    try {
      await deleteRecordByStudent(session.id, action.studentId);
    } catch (err) {
      pushToast({ type: 'error', title: 'Could not undo', message: err.message });
      return;
    }
    setActions((a) => a.slice(0, -1));
    const student = students.find((s) => s.id === action.studentId);
    if (student) setIndex(students.indexOf(student));
  };

  const startPresentation = () => {
    setPresentationMode(true);
    const firstUnmarked = students.findIndex((s) => !records[s.id]);
    if (firstUnmarked !== -1) setIndex(firstUnmarked);
  };

  useEffect(() => {
    document.body.classList.toggle('presentation-mode', presentationMode);
    if (presentationMode && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    if (!presentationMode && document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    return () => {
      document.body.classList.remove('presentation-mode');
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [presentationMode]);

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setPresentationMode(false);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      const target = e.target;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isTyping || e.repeat) return;

      const handled =
        e.key === 'ArrowRight' ||
        e.key === 'Enter' ||
        e.key === ' ' ||
        e.key === 'a' ||
        e.key === 'A' ||
        e.key === 'ArrowLeft' ||
        e.key === 'Backspace' ||
        e.key === 'ArrowUp' ||
        (presentationMode && e.key === 'Escape');
      if (!handled) return;

      e.preventDefault();
      if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
        document.activeElement.blur();
      }

      if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
        mark(RECORD_STATUS.PRESENT);
      } else if (e.key === 'a' || e.key === 'A') {
        mark(RECORD_STATUS.ABSENT);
      } else if (e.key === 'o' || e.key === 'O') {
        mark(RECORD_STATUS.OD);
      } else if (e.key === 'Backspace' || e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        goPrevious();
      } else if (presentationMode && e.key === 'Escape') {
        setPresentationMode(false);
      }
    };
    onKeyRef.current = onKey;
  });

  useEffect(() => {
    const listener = (e) => onKeyRef.current(e);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);

  if (namePageReady && !session) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-slate-100">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-6">
          <div className="card w-full p-8">
            <div className="text-center">
              <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
                <Icon d={Icons.clipboard} className="h-6 w-6 text-brand-600" />
              </span>
              <h1 className="text-xl font-bold text-slate-900">Name This Session</h1>
              <p className="mt-2 text-sm text-slate-500">
                Enter a name for this attendance session or continue with the default.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                This helps keep track of sessions if more than one is created per day.
              </p>
            </div>

            <div className="mt-6">
              <label className="label" htmlFor="session-name">
                Session Name
              </label>
              <input
                id="session-name"
                className="input"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') startWithName(); }}
              />
              <p className="mt-1 text-xs text-slate-400">
                Default: {sessionName}
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <button className="btn-primary w-full py-3" onClick={startWithName}>
                Start Session
              </button>
              <button className="btn-ghost w-full" onClick={() => navigate('/')}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!students || !session || !records) return null;

  if (presentationMode) {
    if (markedCount >= total && total > 0) {
      return (
        <div className="fixed inset-0 z-40 bg-slate-950 text-white">
          <div className="flex h-full flex-col items-center justify-center px-6 py-8 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <Icon d={Icons.checkCircle} className="h-10 w-10" />
            </span>
            <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">Attendance complete</h1>
            <p className="mt-3 text-lg font-semibold text-slate-300">All {total} students have been marked</p>

            <div className="mt-8 grid w-full max-w-md grid-cols-2 gap-4 text-xl font-black">
              <div className="rounded-2xl border border-emerald-700 bg-emerald-900/40 px-4 py-4 text-emerald-200">
                {presentCount} <span className="text-base font-bold text-emerald-400">Present</span>
              </div>
              <div className="rounded-2xl border border-rose-700 bg-rose-900/40 px-4 py-4 text-rose-200">
                {absentCount} <span className="text-base font-bold text-rose-400">Absent</span>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button className="btn-primary px-6 py-3 text-base" onClick={() => navigate(`/classes/${id}/review/${session.id}`)}>
                Review Attendance
              </button>
              {absentCount > 0 && (
                <button
                  className="btn-secondary border-slate-600 bg-slate-900 px-6 py-3 text-base text-slate-100"
                  onClick={() => navigate(`/classes/${id}/review/${session.id}?mode=absent`)}
                >
                  Review Absent Students
                </button>
              )}
              <button className="btn-ghost px-6 py-3 text-base text-slate-300" onClick={() => navigate(`/classes/${id}`)}>
                Back to Class
              </button>
            </div>

            <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-slate-500">Esc exits presentation mode</p>
          </div>
        </div>
      );
    }

    const alreadyMarked = records[current?.id];
    const isLast = index === students.length - 1;
    const studentId = current?.prn_number || current?.application_number || '—';
    return (
      <div className="fixed inset-0 z-40 bg-slate-950 text-white">
        <div className="flex h-full flex-col items-center justify-center overflow-y-auto px-6 py-8 text-center">
          <div className="w-full max-w-3xl">
            <div className="absolute top-6 right-6">
              {alreadyMarked ? (
                <span className="inline-flex rounded-full border border-slate-700 bg-slate-900 px-5 py-2 text-sm font-bold text-slate-300">
                  Already marked {alreadyMarked.status === RECORD_STATUS.PRESENT ? 'Present' : 'Absent'}
                </span>
              ) : (
                <span className="inline-flex rounded-full border border-emerald-900 bg-emerald-950/60 px-5 py-2 text-sm font-bold text-emerald-300">
                  {index + 1} / {total} — waiting for mark
                </span>
              )}
            </div>

            <p className="mt-10 text-lg font-bold tracking-tight text-slate-400 sm:text-xl">{studentId}</p>
            <h1 className="mx-auto mt-3 max-w-4xl break-words text-5xl font-black leading-tight tracking-tight text-white sm:text-7xl">
              {current?.name}
            </h1>
            <p className="mt-3 text-base font-semibold text-slate-300 sm:text-lg">Roll No: {current?.roll_number || '—'}</p>

            <div className="mt-8 flex items-center justify-center gap-5 text-lg font-black">
              <span className="text-emerald-400">{presentCount} Present</span>
              <span className="text-slate-600">·</span>
              <span className="text-rose-400">{absentCount} Absent</span>
            </div>

            <div className="mx-auto mt-6 h-2 w-72 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-brand-400 transition-all duration-300" style={{ width: `${progressPct}%` }} />
            </div>

            <div className="mx-auto mt-10 grid w-full max-w-lg grid-cols-2 gap-4 text-xl font-black sm:text-2xl">
              <button
                onClick={(e) => { e.currentTarget.blur(); mark(RECORD_STATUS.ABSENT); }}
                className="rounded-2xl border border-rose-700 bg-rose-900/40 px-5 py-4 text-rose-200 transition hover:bg-rose-900/70 active:bg-rose-900"
              >
                Absent
              </button>
              <button
                onClick={(e) => { e.currentTarget.blur(); mark(RECORD_STATUS.PRESENT); }}
                className="rounded-2xl bg-emerald-600 px-5 py-4 text-white transition hover:bg-emerald-500 active:bg-emerald-700"
              >
                {isLast ? 'Present & Finish ✓' : 'Present ✓'}
              </button>
            </div>

            <div className="mt-8">
              <Legend dark />
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Esc — Exit presentation mode</p>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
              <button className="btn-secondary border-slate-600 bg-slate-900 text-slate-100" onClick={undoLast} disabled={actions.length === 0}>
                ↶ Undo
              </button>
              <button className="btn-secondary border-slate-600 bg-slate-900 text-slate-100" onClick={goPrevious} disabled={index === 0}>
                ← Previous
              </button>
              <button className="btn-primary" onClick={() => setPresentationMode(false)}>
                Exit Presentation Mode
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <BackLink to="/" label="Dashboard" />
        <div className="mt-6">
          <EmptyState
            icon={Icons.users}
            title="No active students"
            message="Add students to this class before taking attendance."
            action={
              <button className="btn-primary" onClick={() => navigate(`/classes/${id}`)}>
                <Icon d={Icons.plus} className="h-4 w-4" /> Manage Students
              </button>
            }
          />
        </div>
      </div>
    );
  }

  if (markedCount >= total && total > 0) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-100 px-4">
        <div className="card fade-in w-full max-w-md p-8 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            <Icon d={Icons.checkCircle} className="h-7 w-7" />
          </span>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Attendance complete</h1>
          <p className="mt-2 text-sm text-slate-600">
            All {total} students have been marked. Review the list and submit to save it locally.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-emerald-50 px-3 py-2.5">
              <p className="text-xl font-black text-emerald-700">{presentCount}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Present</p>
            </div>
            <div className="rounded-xl bg-rose-50 px-3 py-2.5">
              <p className="text-xl font-black text-rose-700">{absentCount}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Absent</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-2">
            <button className="btn-primary py-3 text-base" onClick={() => navigate(`/classes/${id}/review/${session.id}`)}>
              Review Attendance
            </button>
            {absentCount > 0 && (
              <button className="btn-secondary py-3 text-base" onClick={() => navigate(`/classes/${id}/review/${session.id}?mode=absent`)}>
                Review Absent Students
              </button>
            )}
            <button className="btn-ghost" onClick={() => navigate(`/classes/${id}`)}>
              Back to Class
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-slate-100">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <BackLink to="/" label="Exit" />
          <div className="text-right">
            <p className="text-sm font-bold text-slate-900">{session?.date ? formatDateLabel(session.date) : ''}</p>
            <p className="text-xs text-slate-500">
              {markedCount} / {total} marked
            </p>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
          <span className="truncate">
            {klass?.class_name}
            {klass?.section ? ` · ${klass.section}` : ''}
          </span>
          <span>{index + 1} / {total}</span>
        </div>
        <div className="mb-6 h-3 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="card flex flex-1 flex-col justify-between p-6 sm:p-10">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">
              Application Number
            </p>
            <p className="mt-2 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
              {current?.application_number || '—'}
            </p>
          </div>

          <div className="my-8 text-center">
            <h1 className="text-4xl font-black leading-tight tracking-tight text-slate-900 sm:text-6xl">
              {current?.name}
            </h1>
            <p className="mt-3 text-lg font-semibold text-slate-500">Roll No: {current?.roll_number || '—'}</p>
            {records[current?.id] && (
              <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1.5 text-sm font-bold text-slate-600">
                Already marked {records[current.id].status === RECORD_STATUS.PRESENT ? 'Present' : records[current.id].status === RECORD_STATUS.OD ? 'OD' : 'Absent'} — Next continues
              </p>
            )}
          </div>

          <div className="mb-6 grid grid-cols-4 gap-3">
            <CountPill label="Present" value={presentCount} tone="text-emerald-600" />
            <CountPill label="Absent" value={absentCount} tone="text-rose-600" />
            <CountPill label="OD" value={odCount} tone="text-amber-600" />
            <CountPill label="Remaining" value={remaining} tone="text-slate-700" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              onClick={(e) => { e.currentTarget.blur(); mark(RECORD_STATUS.PRESENT); }}
              className="rounded-2xl bg-emerald-600 py-5 text-2xl font-bold text-white hover:bg-emerald-700 active:bg-emerald-800"
            >
              Present
            </button>
            <button
              onClick={(e) => { e.currentTarget.blur(); mark(RECORD_STATUS.ABSENT); }}
              className="btn-danger rounded-2xl py-5 text-2xl font-bold"
            >
              Absent
            </button>
            <button
              onClick={(e) => { e.currentTarget.blur(); mark(RECORD_STATUS.OD); }}
              className="rounded-2xl bg-amber-500 py-5 text-2xl font-bold text-white hover:bg-amber-600 active:bg-amber-700"
            >
              OD
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Keyboard Shortcuts</p>
            <Legend />
          </div>

          <div className="mt-4 flex justify-center gap-3">
            <button className="btn-secondary px-6" onClick={goPrevious} disabled={index === 0}>
              <Icon d={Icons.arrowLeft} className="h-4 w-4" /> Previous
            </button>
            <button className="btn-secondary px-6" onClick={undoLast} disabled={actions.length === 0}>
              <Icon d={Icons.undo} className="h-4 w-4" /> Undo
            </button>
            <button
              className="rounded-xl border border-emerald-300 bg-emerald-50 px-6 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
              onClick={async () => {
                if (!students || !session) return;
                let count = 0;
                for (const s of students) {
                  if (records?.[s.id]) continue;
                  try {
                    await upsertRecord(session.id, s.id, RECORD_STATUS.PRESENT);
                    count += 1;
                  } catch (_) {}
                }
                setIndex(students.length - 1);
                pushToast({ type: 'success', title: 'Marked all present', message: `${count} student${count === 1 ? '' : 's'} marked present.` });
              }}
            >
              Mark All Present
            </button>
            <button className="btn-ghost px-6" onClick={startPresentation}>
              Presentation mode
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
