import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import db, { STUDENT_STATUS, RECORD_STATUS } from '../db/db.js';
import {
  getStudentsForClass,
  addStudent,
  updateStudent,
  setStudentStatus,
  deleteStudent,
  getSessionsForClass,
} from '../db/repositories.js';
import { useApp } from '../state/AppContext.jsx';
import { BackLink, StatusPill, PageHeader, EmptyState } from '../components/ui.jsx';
import Modal, { Confirm } from '../components/Modal.jsx';
import Dropdown from '../components/Dropdown.jsx';
import { Icons, Icon } from '../components/icons.jsx';
import { DEFAULT_ATTENDANCE_THRESHOLD, clampThreshold, formatDate, getRiskLevel } from '../lib/utils.js';
import { buildAttendanceMatrixCsv, downloadCsv } from '../lib/attendanceCsv.js';

function StudentForm({ open, onClose, student, classId, onSaved }) {
  const [app, setApp] = useState(student?.application_number || '');
  const [roll, setRoll] = useState(student?.roll_number || '');
  const [prn, setPrn] = useState(student?.prn_number || '');
  const [name, setName] = useState(student?.name || '');
  const [email, setEmail] = useState(student?.email || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setApp(student?.application_number || '');
      setRoll(student?.roll_number || '');
      setPrn(student?.prn_number || '');
      setName(student?.name || '');
      setEmail(student?.email || '');
      setError('');
    }
  }, [open, student]);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Student name is required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (student) {
        await updateStudent(student.id, {
          application_number: app,
          roll_number: roll,
          prn_number: prn,
          name,
          email,
        });
      } else {
        await addStudent({
          class_id: classId,
          application_number: app,
          roll_number: roll,
          prn_number: prn,
          name,
          email,
        });
      }
      onSaved?.(student ? 'edited' : 'added');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={student ? 'Edit Student' : 'Add Student'}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="stu-roll">
              Roll Number
            </label>
            <input id="stu-roll" className="input" value={roll} onChange={(e) => setRoll(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="stu-prn">
              PRN No.
            </label>
            <input id="stu-prn" className="input" value={prn} onChange={(e) => setPrn(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="stu-app">
            Application Number
          </label>
          <input id="stu-app" className="input" value={app} onChange={(e) => setApp(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="stu-name">
            Student Name
          </label>
          <input id="stu-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!student} />
        </div>
        <div>
          <label className="label" htmlFor="stu-email">
            Email
          </label>
          <input id="stu-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : student ? 'Save Changes' : 'Add Student'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function ClassDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pushToast } = useApp();

  const klass = useLiveQuery(() => db.classes.get(id), [id]);
  const allStudents = useLiveQuery(() => getStudentsForClass(id, { includeInactive: true }), [id]);
  const sessions = useLiveQuery(() => getSessionsForClass(id), [id]);
  const attendanceRecords = useLiveQuery(async () => {
    if (!sessions || sessions.length === 0) return {};
    const ids = sessions.map((session) => session.id);
    const records = await db.attendance_records.where('attendance_session_id').anyOf(ids).toArray();
    const map = {};
    for (const record of records) {
      if (!map[record.attendance_session_id]) map[record.attendance_session_id] = [];
      map[record.attendance_session_id].push(record);
    }
    return map;
  }, [sessions]);

  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [removing, setRemoving] = useState(null);

  const threshold = useMemo(() => clampThreshold(klass?.attendance_threshold ?? DEFAULT_ATTENDANCE_THRESHOLD), [klass]);
  const activeCount = useMemo(
    () => (allStudents || []).filter((s) => s.status === STUDENT_STATUS.ACTIVE).length,
    [allStudents]
  );

  const classStats = useMemo(() => {
    const activeStudents = (allStudents || []).filter((s) => s.status === STUDENT_STATUS.ACTIVE);
    const completedSessions = (sessions || []).filter((session) => session.status === 'completed');

    let lastSession = null;
    let lastSessionDate = null;
    let lastPresent = 0;
    let lastAbsent = 0;

    if (completedSessions.length > 0) {
      lastSession = [...completedSessions].sort((a, b) => b.date.localeCompare(a.date))[0];
      const sessionRecords = attendanceRecords?.[lastSession.id] || [];
      lastPresent = sessionRecords.filter((record) => record.status === RECORD_STATUS.PRESENT).length;
      lastAbsent = sessionRecords.filter((record) => record.status === RECORD_STATUS.ABSENT).length;
      const lastOd = sessionRecords.filter((record) => record.status === RECORD_STATUS.OD).length;
      lastPresent += lastOd;
      lastSessionDate = lastSession.date;
    }

    const percentages = activeStudents.map((student) => {
      let present = 0;
      for (const session of completedSessions) {
        const record = (attendanceRecords?.[session.id] || []).find((record) => record.student_id === student.id);
        if (record?.status === RECORD_STATUS.PRESENT || record?.status === RECORD_STATUS.OD) present += 1;
      }
      return {
        student,
        totalSessions: completedSessions.length,
        percentage: completedSessions.length ? (present / completedSessions.length) * 100 : 0,
      };
    });

    const average = percentages.length
      ? percentages.reduce((sum, item) => sum + item.percentage, 0) / percentages.length
      : 0;

    const summary = { safe: 0, atRisk: 0, critical: 0 };
    for (const item of percentages) {
      if (item.totalSessions === 0) continue;
      const risk = getRiskLevel(item.percentage, threshold);
      if (risk.label === 'SAFE') summary.safe += 1;
      else if (risk.label === 'AT RISK') summary.atRisk += 1;
      else summary.critical += 1;
    }

    return {
      hasData: completedSessions.length > 0,
      lastSession,
      lastSessionDate,
      lastPresent,
      lastAbsent,
      average,
      belowThreshold: percentages.filter((item) => item.totalSessions > 0 && item.percentage < threshold).length,
      risk: summary,
      percentages,
    };
  }, [allStudents, sessions, attendanceRecords, threshold]);

  const extraStats = useMemo(() => {
    const completedSessions = (sessions || []).filter((s) => s.status === 'completed');
    if (completedSessions.length === 0) return null;

    const sessionCounts = completedSessions.map((session) => {
      const records = attendanceRecords?.[session.id] || [];
      const present = records.filter((r) => r.status === RECORD_STATUS.PRESENT).length;
      const od = records.filter((r) => r.status === RECORD_STATUS.OD).length;
      const absent = records.filter((r) => r.status === RECORD_STATUS.ABSENT).length;
      const total = present + od + absent;
      return { session, present: present + od, absent, total, rate: total ? ((present + od) / total) * 100 : 0 };
    });

    const sorted = [...sessionCounts].sort((a, b) => a.rate - b.rate);
    const bestSession = sorted[sorted.length - 1];
    const worstSession = sorted[0];

    const dayMap = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
    const dayCounts = {};
    for (const s of completedSessions) {
      const day = new Date(s.date.split('-').join('/')).getDay();
      const name = dayMap[day];
      if (!dayCounts[name]) dayCounts[name] = { count: 0, totalPresent: 0 };
      dayCounts[name].count++;
      const records = attendanceRecords?.[s.id] || [];
      dayCounts[name].totalPresent += records.filter((r) => r.status === RECORD_STATUS.PRESENT || r.status === RECORD_STATUS.OD).length;
    }
    const bestDay = Object.entries(dayCounts)
      .map(([day, v]) => ({ day, rate: v.count ? (v.totalPresent / v.count) : 0 }))
      .sort((a, b) => b.rate - a.rate)[0];

    const activeStudents = (allStudents || []).filter((s) => s.status === STUDENT_STATUS.ACTIVE);
    const perfectCount = classStats.percentages.filter((p) => p.percentage === 100 && p.totalSessions > 0).length;

    return {
      totalSessions: completedSessions.length,
      bestSession,
      worstSession,
      bestDay,
      perfectCount,
      totalStudents: activeStudents.length,
    };
  }, [sessions, attendanceRecords, allStudents, classStats]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (allStudents || []).filter((s) => {
      if (!showInactive && s.status === STUDENT_STATUS.INACTIVE) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.application_number.toLowerCase().includes(q) ||
        s.roll_number.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      );
    });
  }, [allStudents, search, showInactive]);

  if (!klass) return null;

  const exportClassRoster = () => {
    const rows = [['Application Number', 'Roll Number', 'PRN Number', 'Student Name', 'Email', 'Status']];
    for (const student of allStudents || []) {
      rows.push([
        student.application_number,
        student.roll_number,
        student.prn_number || '',
        student.name,
        student.email,
        student.status === STUDENT_STATUS.ACTIVE ? 'Active' : 'Inactive',
      ]);
    }
    downloadCsv(`${(klass.class_name || 'class').replace(/\s+/g, '-').toLowerCase()}-roster.csv`, rows.map((row) => row.join(',')).join('\n'));
    pushToast({ type: 'success', title: 'Roster exported', message: 'Downloaded a local CSV file.' });
  };

  const exportAttendanceCsv = () => {
    const data = buildAttendanceMatrixCsv(klass, (allStudents || []).filter((s) => s.status === STUDENT_STATUS.ACTIVE), sessions || [], attendanceRecords || {});
    downloadCsv(data.filename, data.text);
    pushToast({ type: 'success', title: 'Attendance exported', message: 'Downloaded a local CSV file.' });
  };

  const afterSave = (kind) => {
    pushToast({
      type: 'success',
      title: kind === 'added' ? 'Student added' : 'Student updated',
      message: 'Saved locally on this device.',
    });
  };

  const removeStudent = async (student) => {
    await setStudentStatus(student.id, STUDENT_STATUS.INACTIVE);
    pushToast({
      type: 'info',
      title: 'Student removed',
      message: 'Marked Inactive. Attendance history is preserved.',
    });
  };

  const restoreStudent = async (student) => {
    await setStudentStatus(student.id, STUDENT_STATUS.ACTIVE);
    pushToast({
      type: 'success',
      title: 'Student restored',
      message: 'This student will appear in future attendance sessions.',
    });
  };

  const permanentlyDeleteStudent = async (student) => {
    await deleteStudent(student.id);
    pushToast({
      type: 'info',
      title: 'Student deleted',
      message: 'Student and their attendance records have been permanently removed.',
    });
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'students', label: 'Student Details' },
    { id: 'stats', label: 'Stats' },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4">
        <BackLink to="/" label="Dashboard" />
      </div>

      <PageHeader
        title={klass.class_name}
        subtitle={
          (() => {
            const parts = [];
            if (klass.section) parts.push(`Section ${klass.section}`);
            if (klass.year || klass.semester) parts.push(`Year ${klass.year || '—'} · Semester ${klass.semester || '—'}`);
            parts.push(`${activeCount} active student${activeCount === 1 ? '' : 's'}`);
            return parts.join(' · ');
          })()
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {tab === 'students' && (
          <>
            <button className="btn-secondary" onClick={exportClassRoster}>
              <Icon d={Icons.download} className="h-4 w-4" /> Export Roster
            </button>
            <button className="btn-secondary" onClick={exportAttendanceCsv}>
              <Icon d={Icons.download} className="h-4 w-4" /> Export Attendance CSV
            </button>
          </>
        )}
        <span className="flex-1" />
        <button className="btn-primary" onClick={() => { setEditingStudent(null); setFormOpen(true); }}>
          <Icon d={Icons.plus} className="h-4 w-4" /> Add Student
        </button>
      </div>

      <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === t.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
            <div className="card p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Class Snapshot</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Students</p>
                  <p className="mt-1 text-2xl font-black text-slate-900">{activeCount}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Last Attendance</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{classStats.lastSessionDate ? formatDate(new Date(classStats.lastSessionDate.split('-').join('/'))) : '—'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Last Session</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {classStats.lastSession ? `${classStats.lastPresent} Present · ${classStats.lastAbsent} Absent` : '—'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Average Attendance</p>
                  <p className="mt-1 text-2xl font-black text-slate-900">{classStats.hasData ? `${classStats.average.toFixed(1)}%` : '—'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Below {threshold}%</p>
                  <p className="mt-1 text-2xl font-black text-slate-900">{classStats.hasData ? classStats.belowThreshold : '—'}</p>
                </div>
              </div>
            </div>

            <div className="card p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Attendance Risk</p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <span>✓ Safe</span>
                  <span className="font-black">{classStats.risk.safe}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <span>⚠ At Risk</span>
                  <span className="font-black">{classStats.risk.atRisk}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  <span>● Critical</span>
                  <span className="font-black">{classStats.risk.critical}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6 card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Student Risk</p>
              <span className="text-xs text-slate-500">Threshold: {threshold}%</span>
            </div>
            {(() => {
              const atRiskStudents = (allStudents || []).filter((student) => {
                if (student.status !== STUDENT_STATUS.ACTIVE) return false;
                const item = classStats.percentages.find((entry) => entry.student.id === student.id);
                const pct = item?.percentage ?? 0;
                const noData = item?.totalSessions === 0;
                if (noData) return false;
                const risk = getRiskLevel(pct, threshold);
                return risk.label !== 'SAFE';
              });
              if (atRiskStudents.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center rounded-xl bg-emerald-50 p-6 text-center">
                    <Icon d={Icons.checkCircle} className="h-8 w-8 text-emerald-500" />
                    <p className="mt-2 font-semibold text-emerald-700">All students are above the threshold</p>
                    <p className="text-sm text-emerald-600">No students at risk.</p>
                  </div>
                );
              }
              return (
                <div className="grid gap-3 md:grid-cols-2">
                  {atRiskStudents.map((student) => {
                    const item = classStats.percentages.find((entry) => entry.student.id === student.id);
                    const pct = item?.percentage ?? 0;
                    const risk = getRiskLevel(pct, threshold);
                    const tone = risk.tone === 'emerald' ? 'bg-emerald-50 text-emerald-700' : risk.tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700';
                    return (
                      <div key={student.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{student.name}</p>
                          <p className="text-xs text-slate-500">{student.application_number} · {student.roll_number || '—'}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-slate-900">{pct.toFixed(0)}%</p>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone}`}>
                            {risk.icon} {risk.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </>
      )}

      {tab === 'students' && (
        <>
          <div className="card mb-2 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                <Icon d={Icons.users} className="h-4 w-4" />
              </span>
              <input
                className="input pl-9"
                placeholder="Search students…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Show inactive
            </label>
          </div>

          {filtered.length > 0 ? (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-center">Roll Number</th>
                      <th className="px-4 py-3 text-center">PRN No.</th>
                      <th className="px-4 py-3 text-center">Application Number</th>
                      <th className="px-4 py-3 text-center">Student Name</th>
                      <th className="hidden px-4 py-3 text-center md:table-cell">Email</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">{s.roll_number}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">{s.prn_number}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">{s.application_number}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                              {s.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">{s.name}</p>
                              <p className="truncate text-xs text-slate-400 md:hidden">{s.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-slate-500 md:table-cell">{s.email}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            s.status === STUDENT_STATUS.ACTIVE
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {s.status === STUDENT_STATUS.ACTIVE ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end">
                            <Dropdown
                              align="right"
                              items={[
                                { label: 'Edit', icon: Icons.pencil, onClick: () => { setEditingStudent(s); setFormOpen(true); } },
                                { label: 'View Attendance', icon: Icons.history, onClick: () => navigate(`/classes/${id}/students/${s.id}`) },
                                { divider: true },
                                s.status === STUDENT_STATUS.ACTIVE
                                  ? { label: 'Mark Inactive', icon: Icons.x, onClick: () => removeStudent(s) }
                                  : { label: 'Mark Active', icon: Icons.check, onClick: () => restoreStudent(s) },
                                { divider: true },
                                { label: 'Remove', icon: Icons.trash, danger: true, onClick: () => setRemoving(s) },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Icons.users}
              title={search ? 'No students match your search' : 'No students yet'}
              message={
                search
                  ? 'Try a different search or show inactive students.'
                  : 'Add your first student or import from a CSV.'
              }
              action={
                !search && (
                  <button className="btn-primary" onClick={() => { setEditingStudent(null); setFormOpen(true); }}>
                    <Icon d={Icons.plus} className="h-4 w-4" /> Add Student
                  </button>
                )
              }
            />
          )}
        </>
      )}

      {tab === 'stats' && (
        <>
          {extraStats ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="card p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Total Sessions</p>
                  <p className="mt-1 text-3xl font-black text-slate-900">{extraStats.totalSessions}</p>
                </div>
                <div className="card p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Perfect Attendance</p>
                  <p className="mt-1 text-3xl font-black text-slate-900">{extraStats.perfectCount}</p>
                  <p className="text-xs text-slate-500">{extraStats.totalStudents ? `${((extraStats.perfectCount / extraStats.totalStudents) * 100).toFixed(0)}% of students` : ''}</p>
                </div>
                <div className="card p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Best Day</p>
                  <p className="mt-1 text-3xl font-black text-slate-900">{extraStats.bestDay?.day || '—'}</p>
                  <p className="text-xs text-slate-500">{extraStats.bestDay?.rate != null ? `${extraStats.bestDay.rate.toFixed(1)}% avg attendance` : ''}</p>
                </div>
              </div>

              {extraStats.bestSession && extraStats.worstSession && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="card p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Best Session</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{formatDate(new Date(extraStats.bestSession.session.date.split('-').join('/')))}</p>
                    <p className="text-sm text-slate-600">{extraStats.bestSession.present} present · {extraStats.bestSession.absent} absent</p>
                    <p className="mt-1 text-2xl font-black text-emerald-600">{extraStats.bestSession.rate.toFixed(1)}%</p>
                  </div>
                  <div className="card p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Worst Session</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{formatDate(new Date(extraStats.worstSession.session.date.split('-').join('/')))}</p>
                    <p className="text-sm text-slate-600">{extraStats.worstSession.present} present · {extraStats.worstSession.absent} absent</p>
                    <p className="mt-1 text-2xl font-black text-rose-600">{extraStats.worstSession.rate.toFixed(1)}%</p>
                  </div>
                </div>
              )}

              <div className="card p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500 mb-3">Attendance Distribution</p>
                <div className="grid gap-3 sm:grid-cols-4">
                  {[
                    { label: '100%', range: 'p === 100', count: classStats.percentages.filter((p) => p.percentage === 100 && p.totalSessions > 0).length, color: 'bg-emerald-500' },
                    { label: '75-99%', range: 'p >= 75', count: classStats.percentages.filter((p) => p.percentage >= 75 && p.percentage < 100 && p.totalSessions > 0).length, color: 'bg-brand-500' },
                    { label: '50-74%', range: 'p >= 50', count: classStats.percentages.filter((p) => p.percentage >= 50 && p.percentage < 75 && p.totalSessions > 0).length, color: 'bg-amber-500' },
                    { label: 'Below 50%', range: 'p < 50', count: classStats.percentages.filter((p) => p.percentage < 50 && p.totalSessions > 0).length, color: 'bg-rose-500' },
                  ].map((bucket) => {
                    const total = classStats.percentages.filter((p) => p.totalSessions > 0).length || 1;
                    const pct = (bucket.count / total) * 100;
                    return (
                      <div key={bucket.label} className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-slate-600">{bucket.label}</p>
                        <p className="mt-1 text-2xl font-black text-slate-900">{bucket.count}</p>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                          <div className={`h-full rounded-full ${bucket.color}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Icons.chart}
              title="No stats yet"
              message="Complete at least one attendance session to see statistics."
            />
          )}
        </>
      )}

      <StudentForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        student={editingStudent}
        classId={id}
        onSaved={afterSave}
      />

      <Confirm
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => permanentlyDeleteStudent(removing)}
        title="Delete student?"
        message={`"${removing?.name}" and all their attendance records will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
