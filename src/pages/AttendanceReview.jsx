import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import db, { RECORD_STATUS } from '../db/db.js';
import {
  getSession,
  getStudentsForClass,
  getRecordMap,
  upsertRecord,
  markSessionSubmitted,
} from '../db/repositories.js';
import { formatDateLabel } from '../lib/utils.js';
import { useApp } from '../state/AppContext.jsx';
import { BackLink, Spinner } from '../components/ui.jsx';
import { Icons, Icon } from '../components/icons.jsx';

export default function AttendanceReview() {
  const { id, sessionId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { pushToast } = useApp();

  const session = useLiveQuery(() => getSession(sessionId), [sessionId]);
  const students = useLiveQuery(() => getStudentsForClass(id, { includeInactive: false }), [id]);
  const klass = useLiveQuery(() => db.classes.get(id), [id]);
  const records = useLiveQuery(async () => (session ? getRecordMap(session.id) : {}), [session?.id]);

  const [submitting, setSubmitting] = useState(false);
  const absentOnly = searchParams.get('mode') === 'absent';

  const list = useMemo(() => {
    if (!students || !records) return [];
    return students.map((s) => ({ student: s, status: records[s.id]?.status }));
  }, [students, records]);

  const filteredList = useMemo(() => {
    if (!absentOnly) return list;
    return list.filter((entry) => entry.status === RECORD_STATUS.ABSENT);
  }, [absentOnly, list]);

  const present = useMemo(() => list.filter((x) => x.status === RECORD_STATUS.PRESENT).length, [list]);
  const absent = useMemo(() => list.filter((x) => x.status === RECORD_STATUS.ABSENT).length, [list]);
  const odCount = useMemo(() => list.filter((x) => x.status === RECORD_STATUS.OD).length, [list]);
  const pct = list.length ? (((present + odCount) / list.length) * 100).toFixed(1) : '0.0';

  const toggle = async (studentId) => {
    const current = records?.[studentId]?.status;
    let next;
    if (!current || current === RECORD_STATUS.ABSENT) {
      next = RECORD_STATUS.PRESENT;
    } else if (current === RECORD_STATUS.PRESENT) {
      next = RECORD_STATUS.OD;
    } else {
      next = RECORD_STATUS.ABSENT;
    }
    await upsertRecord(session.id, studentId, next);
  };

  const submit = async () => {
    if (!list.some((x) => !x.status)) {
      setSubmitting(true);
      try {
        await markSessionSubmitted(session.id);
        pushToast({
          type: 'success',
          title: 'Attendance saved locally',
          message: 'All records are stored on this device.',
        });
        navigate(`/classes/${id}/history`);
      } finally {
        setSubmitting(false);
      }
    }
  };

  if (!session || !students || !records || !klass) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <BackLink to={`/classes/${id}`} label="Back to class" />

      <div className="mb-6 mt-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
          {absentOnly ? 'Absent Students' : 'Attendance Complete'}
        </p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">{klass.class_name}</h1>
        <p className="text-sm text-slate-600">
          {klass.section ? `${klass.section} · ` : ''}
          {session.date ? formatDateLabel(session.date) : ''} · {list.length} student{list.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-3">
        <div className="card p-4 text-center">
          <p className="text-2xl font-black text-emerald-600">{present}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Present</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-black text-rose-600">{absent}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Absent</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-black text-amber-600">{odCount}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">OD</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-black text-slate-900">{pct}%</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attendance</p>
        </div>
      </div>

      <div className="card mb-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
          <span>{absentOnly ? 'Absent students only' : 'Review list — tap a row to toggle Present / Absent'}</span>
          {absent > 0 && !absentOnly && (
            <button className="btn-ghost px-2 py-1 text-xs" onClick={() => navigate(`/classes/${id}/review/${sessionId}?mode=absent`)}>
              Review Absent Students
            </button>
          )}
        </div>
        <ul className="max-h-[50vh] divide-y divide-slate-100 overflow-y-auto">
          {filteredList.length === 0 ? (
            <li className="px-4 py-6 text-sm text-slate-500">
              {absentOnly ? 'No students are marked absent.' : 'No records to review.'}
            </li>
          ) : (
            filteredList.map(({ student, status }) => (
              <li key={student.id}>
                <div className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50">
                  <span className="w-24 shrink-0 font-mono text-xs text-slate-500">{student.application_number}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{student.name}</span>
                  {status === RECORD_STATUS.PRESENT ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      <Icon d={Icons.check} className="h-3.5 w-3.5" /> Present
                    </span>
                  ) : status === RECORD_STATUS.OD ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                        <Icon d={Icons.check} className="h-3.5 w-3.5" /> OD
                      </span>
                      <button className="btn-secondary px-2 py-1 text-[11px]" onClick={() => toggle(student.id)}>
                        Change to Absent
                      </button>
                    </div>
                  ) : status === RECORD_STATUS.ABSENT ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">
                        <Icon d={Icons.x} className="h-3.5 w-3.5" /> Absent
                      </span>
                      <button className="btn-secondary px-2 py-1 text-[11px]" onClick={() => toggle(student.id)}>
                        Change to Present
                      </button>
                    </div>
                  ) : (
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                      Not marked
                    </span>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <button className="btn-secondary" onClick={() => navigate(`/classes/${id}/attendance`)}>
          <Icon d={Icons.pencil} className="h-4 w-4" /> Edit Attendance
        </button>
        <button className="btn-primary" onClick={submit} disabled={submitting || list.length === 0}>
          {submitting ? (
            <>
              <Spinner className="h-4 w-4" /> Submitting…
            </>
          ) : (
            <>
              <Icon d={Icons.checkCircle} className="h-4 w-4" /> Submit Attendance
            </>
          )}
        </button>
      </div>
    </div>
  );
}
