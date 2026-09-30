import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import db, { RECORD_STATUS } from '../db/db.js';
import { getSession, getRecordMap, getStudentsForClass, upsertRecord } from '../db/repositories.js';
import { formatDate, fromDateKey } from '../lib/utils.js';
import { BackLink, EmptyState } from '../components/ui.jsx';
import { Icons, Icon } from '../components/icons.jsx';
import { useApp } from '../state/AppContext.jsx';

export default function SessionDetail() {
  const { id, sessionId } = useParams();
  const { pushToast } = useApp();
  const klass = useLiveQuery(() => db.classes.get(id), [id]);
  const session = useLiveQuery(() => getSession(sessionId), [sessionId]);
  const students = useLiveQuery(() => getStudentsForClass(id, { includeInactive: true }), [id]);
  const records = useLiveQuery(async () => (session ? getRecordMap(session.id) : {}), [session?.id]);

  const [localStatuses, setLocalStatuses] = useState({});
  const [saving, setSaving] = useState(null);
  const [selectedStudents, setSelectedStudents] = useState(new Set());
  const [odMode, setOdMode] = useState(false);

  const effectiveRecords = useMemo(() => {
    if (!records) return {};
    const merged = { ...records };
    for (const [studentId, status] of Object.entries(localStatuses)) {
      merged[studentId] = { ...merged[studentId], status };
    }
    return merged;
  }, [records, localStatuses]);

  const list = useMemo(() => {
    if (!students || !effectiveRecords) return [];
    return students.map((s) => ({ student: s, status: effectiveRecords[s.id]?.status }));
  }, [students, effectiveRecords]);

  const present = list.filter((x) => x.status === RECORD_STATUS.PRESENT).length;
  const absent = list.filter((x) => x.status === RECORD_STATUS.ABSENT).length;
  const odCount = list.filter((x) => x.status === RECORD_STATUS.OD).length;
  const notMarked = list.filter((x) => !x.status).length;
  const pct = list.length ? ((present / list.length) * 100).toFixed(1) : '0.0';

  const toggleStatus = async (studentId, newStatus) => {
    setLocalStatuses((prev) => ({ ...prev, [studentId]: newStatus }));
    setSaving(studentId);
    try {
      await upsertRecord(sessionId, studentId, newStatus);
    } catch (err) {
      pushToast({ type: 'error', title: 'Could not update', message: err.message });
      setLocalStatuses((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    } finally {
      setSaving(null);
    }
  };

  if (!klass || !session) return null;

  const date = fromDateKey(session.date);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <BackLink to="/history" label="Attendance History" />

      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{session.name || formatDate(date)}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {klass.class_name}
            {klass.section ? ` · Section ${klass.section}` : ''}
            {klass.year ? ` · Year ${klass.year}` : ''}
            {klass.semester ? ` · Semester ${klass.semester}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-slate-400">{notMarked}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Not Marked</p>
        </div>
      </div>

      <div className="mt-6 mb-6 grid grid-cols-4 gap-3">
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

      <div className="mt-4 mb-4 flex items-center justify-end">
        {odMode ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setOdMode(false); setSelectedStudents(new Set()); }}
              className="btn-secondary text-xs"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                for (const studentId of selectedStudents) {
                  await toggleStatus(studentId, RECORD_STATUS.OD);
                }
                setSelectedStudents(new Set());
                setOdMode(false);
              }}
              disabled={selectedStudents.size === 0}
              className="btn-secondary border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Mark Selected OD {selectedStudents.size > 0 && `(${selectedStudents.size})`}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                for (const { student, status } of list) {
                  if (status !== RECORD_STATUS.PRESENT) {
                    await toggleStatus(student.id, RECORD_STATUS.PRESENT);
                  }
                }
              }}
              className="btn-secondary border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            >
              Mark All Present
            </button>
            <button
              onClick={() => setOdMode(true)}
              className="btn-secondary border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
            >
              Mark Students OD
            </button>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                {odMode && <th className="px-4 py-3 w-10"></th>}
                <th className="px-4 py-3">Roll Number</th>
                <th className="px-4 py-3">PRN No.</th>
                <th className="px-4 py-3">Application Number</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map(({ student, status }) => {
                const isSaving = saving === student.id;
                return (
                  <tr key={student.id} className="hover:bg-slate-50/60">
                    {odMode && (
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedStudents.has(student.id)}
                          onChange={(e) => {
                            const next = new Set(selectedStudents);
                            if (e.target.checked) {
                              next.add(student.id);
                            } else {
                              next.delete(student.id);
                            }
                            setSelectedStudents(next);
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                      </td>
                    )}
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{student.roll_number}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{student.prn_number}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{student.application_number}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{student.name}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {status === RECORD_STATUS.OD ? (
                          <button
                            onClick={() => toggleStatus(student.id, RECORD_STATUS.ABSENT)}
                            disabled={isSaving}
                            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700 ring-1 ring-amber-300 transition hover:bg-amber-200 disabled:opacity-50"
                          >
                            {isSaving ? (
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
                            ) : null}
                            ON DUTY
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => toggleStatus(student.id, RECORD_STATUS.PRESENT)}
                              disabled={isSaving}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-50 ${
                                status === RECORD_STATUS.PRESENT
                                  ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300'
                                  : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
                              }`}
                            >
                              {isSaving ? (
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                              ) : (
                                <Icon d={Icons.check} className="h-3 w-3" />
                              )}
                              Present
                            </button>
                            <button
                              onClick={() => toggleStatus(student.id, RECORD_STATUS.ABSENT)}
                              disabled={isSaving}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-50 ${
                                status === RECORD_STATUS.ABSENT
                                  ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-300'
                                  : 'bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-700'
                              }`}
                            >
                              {isSaving ? (
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                              ) : (
                                <Icon d={Icons.x} className="h-3 w-3" />
                              )}
                              Absent
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {list.length === 0 && (
        <EmptyState icon={Icons.history} title="No records in this session" message="This session has no attendance records." />
      )}

      <div className="mt-6">
        <Link to={`/classes/${id}`} className="btn-secondary">
          <Icon d={Icons.arrowLeft} className="h-4 w-4" /> Back to Class
        </Link>
      </div>
    </div>
  );
}
