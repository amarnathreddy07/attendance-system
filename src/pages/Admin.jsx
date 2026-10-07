import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/apiClient.js';
import { parseCsv } from '../lib/sample.js';
import { parseStudentRows } from '../lib/studentSheet.js';
import { useApp } from '../state/AppContext.jsx';
import { PageHeader, Spinner, EmptyState } from '../components/ui.jsx';
import { Icons, Icon } from '../components/icons.jsx';

const TABS = [
  { id: 'teachers', label: 'Teachers' },
  { id: 'classes', label: 'Classes' },
  { id: 'students', label: 'Students' },
  { id: 'reports', label: 'Reports' },
];

function ErrorNote({ error }) {
  if (!error) return null;
  return <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>;
}

function TeachersTab({ pushToast }) {
  const [teachers, setTeachers] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', role: 'teacher' });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const data = await api.adminGetTeachers();
      setTeachers(data.teachers);
      setError('');
    } catch (err) {
      setError(err.message);
      setTeachers([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.adminCreateTeacher({
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        active: true,
      });
      setForm({ name: '', email: '', role: 'teacher' });
      pushToast({ type: 'success', title: 'Teacher added' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (teacher) => {
    try {
      await api.adminUpdateTeacher({ teacher_id: teacher.teacher_id, active: !teacher.active });
      pushToast({
        type: 'success',
        title: teacher.active ? 'Access revoked' : 'Access restored',
        message: teacher.name,
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="card p-5">
        <h3 className="mb-4 text-base font-semibold text-slate-900">Add a teacher</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          <input
            className="input"
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <input
            className="input"
            type="email"
            placeholder="name@university.edu"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
          <select
            className="input"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          >
            <option value="teacher">Teacher</option>
            <option value="admin">Admin</option>
          </select>
          <button className="btn-primary" disabled={busy}>
            {busy ? 'Adding…' : 'Add teacher'}
          </button>
        </div>
        <ErrorNote error={error} />
      </form>

      {teachers === null ? (
        <Spinner />
      ) : teachers.length === 0 ? (
        <EmptyState icon={Icons.clipboard} title="No teachers yet" message="Add the first teacher above." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5">Classes</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teachers.map((teacher) => (
                  <tr key={teacher.teacher_id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-medium text-slate-900">{teacher.name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{teacher.email}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          teacher.role === 'admin'
                            ? 'bg-brand-50 text-brand-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {teacher.role}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{teacher.class_count}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          teacher.active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {teacher.active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        className={teacher.active ? 'btn-secondary py-1 text-xs' : 'btn-primary py-1 text-xs'}
                        onClick={() => toggleActive(teacher)}
                      >
                        {teacher.active ? 'Suspend' : 'Restore'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ClassesTab({ pushToast }) {
  const [classes, setClasses] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ class_name: '', section: '', subject: '', year: '', semester: '' });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const data = await api.adminGetClasses();
      setClasses(data.classes);
      setError('');
    } catch (err) {
      setError(err.message);
      setClasses([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.adminCreateClass({
        class_name: form.class_name.trim(),
        section: form.section.trim(),
        subject: form.subject.trim(),
        year: form.year.trim(),
        semester: form.semester.trim(),
      });
      setForm({ class_name: '', section: '', subject: '', year: '', semester: '' });
      pushToast({ type: 'success', title: 'Class created' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="card p-5">
        <h3 className="mb-4 text-base font-semibold text-slate-900">Create a class</h3>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <input
            className="input"
            placeholder="Class name"
            value={form.class_name}
            onChange={(e) => setForm((f) => ({ ...f, class_name: e.target.value }))}
            required
          />
          <input
            className="input"
            placeholder="Section"
            value={form.section}
            onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Subject"
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Year"
            value={form.year}
            onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Semester"
            value={form.semester}
            onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))}
          />
          <button className="btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create class'}
          </button>
        </div>
        <ErrorNote error={error} />
      </form>

      {classes === null ? (
        <Spinner />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={Icons.clipboard}
          title="No classes yet"
          message="Create a class above, then import its students."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Class</th>
                  <th className="px-4 py-2.5">Teacher</th>
                  <th className="px-4 py-2.5">Students</th>
                  <th className="px-4 py-2.5">Sessions</th>
                  <th className="px-4 py-2.5">Threshold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classes.map((klass) => (
                  <tr key={klass.class_id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {klass.class_name}
                      {klass.section ? ` · ${klass.section}` : ''}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {klass.teacher_name || (
                        <span className="text-slate-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{klass.student_count}</td>
                    <td className="px-4 py-2.5 text-slate-600">{klass.session_count}</td>
                    <td className="px-4 py-2.5 text-slate-600">{klass.attendance_threshold}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentsTab({ pushToast }) {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [students, setStudents] = useState(null);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    api
      .adminGetClasses()
      .then((data) => {
        setClasses(data.classes);
        if (data.classes.length && !classId) setClassId(data.classes[0].class_id);
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!classId) return;
    setStudents(null);
    api
      .adminGetStudents(classId, 1000)
      .then((data) => setStudents(data.students))
      .catch((err) => {
        setError(err.message);
        setStudents([]);
      });
  }, [classId]);

  const importFile = async (file) => {
    setBusy(true);
    setImportResult(null);
    setError('');
    try {
      const text = await file.text();
      const rawRows = parseCsv(text);
      const parsed = parseStudentRows(rawRows);
      if (!parsed.ok) {
        setError(parsed.error || 'The file could not be read as a student CSV.');
        return;
      }
      const issues = parsed.summary?.issues || {};
      const rejected = [
        ...(issues.invalid || []).map((row) => ({ row: row.row, reason: row.reason })),
        ...(issues.duplicates || []).map((row) => ({
          row: row.row,
          reason: 'Duplicate roll or application number in this file.',
        })),
      ];
      const rows = (parsed.students || [])
        .map((row) => ({
          application_number: row.application_number || '',
          roll_number: row.roll_number || '',
          prn_number: row.prn_number || '',
          name: row.name || '',
          email: row.email || '',
          status: row.status || 'active',
        }))
        .filter((row) => row.name);

      if (!rows.length) {
        setError('No valid student rows found in the file.');
        return;
      }

      const result = await api.adminImportStudents(classId, rows);
      setImportResult({
        added: result.added,
        updated: result.updated,
        rejected: [...rejected, ...(result.rejected || [])],
      });
      pushToast({
        type: 'success',
        title: 'Import finished',
        message: `${result.added} added, ${result.updated} updated`,
      });
      setStudents(await api.adminGetStudents(classId, 1000).then((d) => d.students));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeStudent = async (student) => {
    try {
      await api.adminDeleteStudent(student.student_id);
      pushToast({ type: 'success', title: 'Student deactivated', message: student.name });
      setStudents(await api.adminGetStudents(classId, 1000).then((d) => d.students));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="label" htmlFor="admin-class">
              Class
            </label>
            <select
              id="admin-class"
              className="input"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              {classes.map((klass) => (
                <option key={klass.class_id} value={klass.class_id}>
                  {klass.class_name}
                  {klass.section ? ` · ${klass.section}` : ''}
                </option>
              ))}
            </select>
          </div>
          <label className="btn-primary cursor-pointer py-2 text-sm">
            {busy ? 'Importing…' : 'Import CSV'}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={busy || !classId}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importFile(file);
              }}
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Columns: name, application_number, roll_number, prn_number, email. Rows matching an existing
          roll or application number are updated, not duplicated.
        </p>
        <ErrorNote error={error} />
        {importResult ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <p>
              <strong>{importResult.added}</strong> added · <strong>{importResult.updated}</strong> updated
              · <strong>{importResult.rejected.length}</strong> rejected
            </p>
            {importResult.rejected.length > 0 && (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-slate-600">
                {importResult.rejected.slice(0, 40).map((row, i) => (
                  <li key={i}>
                    Row {row.row}: {row.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      {!classId ? (
        <EmptyState
          icon={Icons.clipboard}
          title="No classes yet"
          message="Create a class before importing students."
        />
      ) : students === null ? (
        <Spinner />
      ) : students.length === 0 ? (
        <EmptyState icon={Icons.clipboard} title="No students" message="Import a CSV to add the roster." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Roll</th>
                  <th className="px-4 py-2.5">Application</th>
                  <th className="px-4 py-2.5">PRN</th>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => (
                  <tr key={student.student_id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2 font-mono text-xs text-slate-600">{student.roll_number}</td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-600">
                      {student.application_number}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-600">{student.prn_number}</td>
                    <td className="px-4 py-2 font-medium text-slate-900">{student.name}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          student.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {student.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {student.status === 'active' && (
                        <button
                          type="button"
                          className="btn-secondary py-1 text-xs"
                          onClick={() => removeStudent(student)}
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportsTab() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .adminReport({})
      .then((data) => setReport(data.report))
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <ErrorNote error={error} />;
  if (report === null) return <Spinner />;
  if (!report.length) {
    return (
      <EmptyState
        icon={Icons.clipboard}
        title="Nothing to report yet"
        message="Reports appear once classes have submitted attendance."
      />
    );
  }

  return (
    <div className="space-y-6">
      {report.map((entry) => (
        <div key={entry.class.class_id} className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-base font-semibold text-slate-900">{entry.class.class_name}</h3>
            <p className="text-sm text-slate-500">
              {entry.student_count} students · {entry.session_count} sessions
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Roll</th>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Present</th>
                  <th className="px-4 py-2.5">Sessions</th>
                  <th className="px-4 py-2.5">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entry.students.map((student) => (
                  <tr key={student.student_id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2 font-mono text-xs text-slate-600">{student.roll_number}</td>
                    <td className="px-4 py-2 font-medium text-slate-900">{student.name}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {student.present}/{student.sessions}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{student.sessions}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          student.percentage >= 75
                            ? 'bg-emerald-50 text-emerald-700'
                            : student.percentage >= 60
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {student.percentage}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('teachers');
  const { pushToast } = useApp();

  const body = useMemo(() => {
    if (tab === 'teachers') return <TeachersTab pushToast={pushToast} />;
    if (tab === 'classes') return <ClassesTab pushToast={pushToast} />;
    if (tab === 'students') return <StudentsTab pushToast={pushToast} />;
    return <ReportsTab />;
  }, [tab, pushToast]);

  return (
    <div className="fade-in space-y-6">
      <PageHeader
        title="Admin"
        subtitle="Teachers, classes, rosters and reports — all served from the backend."
      />
      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={tab === item.id ? 'btn-primary py-2 text-sm' : 'btn-secondary py-2 text-sm'}
          >
            {item.label}
          </button>
        ))}
      </div>
      {body}
    </div>
  );
}
