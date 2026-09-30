import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import db, { RECORD_STATUS } from '../db/db.js';
import { getStudentAttendance, getStudentsForClass } from '../db/repositories.js';
import { formatDate, fromDateKey } from '../lib/utils.js';
import { BackLink, EmptyState, PageHeader } from '../components/ui.jsx';
import { Icons, Icon } from '../components/icons.jsx';

export default function StudentHistory() {
  const { id, studentId } = useParams();
  const klass = useLiveQuery(() => db.classes.get(id), [id]);
  const students = useLiveQuery(() => getStudentsForClass(id, { includeInactive: true }), [id]);
  const student = students?.find((s) => s.id === studentId);
  const attendance = useLiveQuery(() => getStudentAttendance(studentId), [studentId]);

  if (!klass) return null;

  if (!student) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <BackLink to={`/classes/${id}`} label="Back to class" />
        <div className="mt-6">
          <EmptyState icon={Icons.user} title="Student not found" message="This student may have been removed." />
        </div>
      </div>
    );
  }

  const presentCount = attendance ? attendance.filter((a) => a.status === RECORD_STATUS.PRESENT || a.status === RECORD_STATUS.OD).length : 0;
  const total = attendance?.length || 0;
  const pct = total ? ((presentCount / total) * 100).toFixed(0) : '0';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <BackLink to={`/classes/${id}`} label="Back to class" />
      <div className="mt-4">
        <PageHeader title={student.name} subtitle={`Application Number: ${student.application_number || '—'} · Roll: ${student.roll_number || '—'}`} />
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <p className="text-2xl font-black text-slate-900">{presentCount}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Present</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-black text-slate-900">{total}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sessions</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-black text-brand-600">{total ? `${pct}%` : '—'}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attendance</p>
        </div>
      </div>

      {attendance && attendance.length > 0 ? (
        <div className="card divide-y divide-slate-100">
          {attendance.map(({ session, status }) => {
            const d = fromDateKey(session.date);
            return (
              <div key={session.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium text-slate-700">{formatDate(d)}</span>
                {status === RECORD_STATUS.PRESENT ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    <Icon d={Icons.check} className="h-3.5 w-3.5" /> Present
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">
                    <Icon d={Icons.x} className="h-3.5 w-3.5" /> Absent
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Icons.history}
          title="No attendance yet"
          message="This student's attendance will appear here once sessions are submitted."
        />
      )}
    </div>
  );
}
