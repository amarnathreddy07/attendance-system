import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/apiClient.js';
import { parseCsv } from '../lib/sample.js';
import { parseStudentRows } from '../lib/studentSheet.js';
import { useApp } from '../state/AppContext.jsx';
import { PageHeader, Spinner, EmptyState } from '../components/ui.jsx';
import { Icons, Icon } from '../components/icons.jsx';
import Modal from '../components/Modal.jsx';

const TABS = [
  { id: 'teachers', label: 'Teachers' },
  { id: 'admins', label: 'Admins' },
  { id: 'classes', label: 'Classes' },
  { id: 'students', label: 'Students' },
  { id: 'reports', label: 'Reports' },
];

function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
      <span>{error}</span>
      {onRetry && (
        <button type="button" className="font-semibold underline underline-offset-2" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

function PeopleTab({ role, pushToast, currentUserId }) {
  const [people, setPeople] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '' });
  const [busy, setBusy] = useState(false);
  const [changingId, setChangingId] = useState('');
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '' });
  const [editError, setEditError] = useState('');

  const load = async () => {
    try {
      const data = await api.adminGetTeachers();
      setPeople(role === 'admin' ? data.admins : data.teachers);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, [role]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.adminCreateTeacher({
        name: form.name.trim(),
        email: form.email.trim(),
        role,
        active: true,
      });
      setForm({ name: '', email: '' });
      pushToast({ type: 'success', title: `${role === 'admin' ? 'Admin' : 'Teacher'} added` });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (person) => {
    setChangingId(person.teacher_id);
    setError('');
    try {
      await api.adminUpdateTeacher({
        teacher_id: person.teacher_id,
        role,
        active: !person.active,
      });
      pushToast({
        type: 'success',
        title: person.active ? 'Access revoked' : 'Access restored',
        message: person.name,
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setChangingId('');
    }
  };

  const editPerson = (person) => {
    setEditing(person);
    setEditForm({ name: person.name, email: person.email });
    setEditError('');
  };

  const savePerson = async (event) => {
    event.preventDefault();
    if (!editing) return;
    setChangingId(editing.teacher_id);
    setEditError('');
    try {
      await api.adminUpdateTeacher({
        teacher_id: editing.teacher_id,
        role,
        name: editForm.name.trim(),
        email: editForm.email.trim(),
      });
      pushToast({ type: 'success', title: `${role === 'admin' ? 'Admin' : 'Teacher'} updated` });
      setEditing(null);
      await load();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setChangingId('');
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="card p-5">
          <div className="mb-4">
          <h2 className="text-base font-bold text-slate-900">
            Add {role === 'admin' ? 'an admin' : 'a teacher'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">New accounts can sign in with their listed Google account.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            className="input"
            placeholder="Full name"
            aria-label="Full name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <input
            className="input"
            type="email"
            placeholder="name@university.edu"
            aria-label="Email address"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
          <button className="btn-primary" disabled={busy}>
            {busy ? 'Adding…' : `Add ${role === 'admin' ? 'admin' : 'teacher'}`}
          </button>
        </div>
        <ErrorNote error={error} onRetry={load} />
      </form>

      {people === null ? (
        error ? null : <Spinner />
      ) : people.length === 0 ? (
        <EmptyState
          icon={Icons.clipboard}
          title={`No ${role === 'admin' ? 'admins' : 'teachers'} yet`}
          message={`Add the first ${role === 'admin' ? 'admin' : 'teacher'} above.`}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">ID</th>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Email</th>
                  {role === 'teacher' && <th className="px-4 py-2.5">Classes</th>}
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {people.map((person) => (
                  <tr key={person.teacher_id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{person.teacher_id}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{person.name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{person.email}</td>
                    {role === 'teacher' && (
                      <td className="px-4 py-2.5 text-slate-600">{person.class_count}</td>
                    )}
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          person.active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {person.active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="btn-secondary py-1 text-xs"
                          onClick={() => editPerson(person)}
                          disabled={!!changingId}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={person.active ? 'btn-secondary py-1 text-xs' : 'btn-primary py-1 text-xs'}
                          onClick={() => toggleActive(person)}
                          disabled={!!changingId || (role === 'admin' && person.teacher_id === currentUserId && person.active)}
                          title={role === 'admin' && person.teacher_id === currentUserId ? 'You cannot suspend your own account.' : undefined}
                        >
                          {changingId === person.teacher_id
                            ? 'Saving…'
                            : role === 'admin' && person.teacher_id === currentUserId && person.active
                              ? 'Current account'
                              : person.active
                                ? 'Suspend'
                                : 'Restore'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Edit ${role === 'admin' ? 'admin' : 'teacher'}`}
        size="sm"
      >
        <form onSubmit={savePerson} className="space-y-4">
          <div>
            <label className="label" htmlFor="edit-person-name">Full name</label>
            <input
              id="edit-person-name"
              className="input"
              value={editForm.name}
              onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="edit-person-email">Email</label>
            <input
              id="edit-person-email"
              className="input"
              type="email"
              value={editForm.email}
              onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
              required
            />
          </div>
              <ErrorNote error={editError} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn-primary" disabled={!!changingId}>
              {changingId ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ClassesTab({ pushToast }) {
  const [classes, setClasses] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    class_name: '',
    section: '',
    subject: '',
    year: '',
    semester: '',
    teacher_id: '',
    attendance_threshold: '75',
  });
  const [busy, setBusy] = useState(false);
  const [busyClassId, setBusyClassId] = useState('');
  const [assignmentSelection, setAssignmentSelection] = useState({});

  const load = async () => {
    try {
      const [classData, peopleData] = await Promise.all([api.adminGetClasses(), api.adminGetTeachers()]);
      setClasses(classData.classes);
      setTeachers(peopleData.teachers);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.adminCreateClass({
        class_name: form.class_name.trim(),
        section: form.section.trim(),
        subject: form.subject.trim(),
        year: form.year.trim(),
        semester: form.semester.trim(),
        teacher_id: form.teacher_id,
        attendance_threshold: Number(form.attendance_threshold),
      });
      setForm({
        class_name: '',
        section: '',
        subject: '',
        year: '',
        semester: '',
        teacher_id: '',
        attendance_threshold: '75',
      });
      pushToast({ type: 'success', title: 'Class created' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveAssignment = async (klass) => {
    const selectedId = assignmentSelection[klass.class_id] ?? klass.teacher_id ?? '';
    const currentId = klass.teacher_id || '';
    if (selectedId === currentId) return;

    setBusyClassId(klass.class_id);
    setError('');
    try {
      if (selectedId) {
        await api.adminAssignTeacher({
          class_id: klass.class_id,
          teacher_id: selectedId,
          primary: true,
        });
      } else if (currentId) {
        await api.adminAssignTeacher({
          class_id: klass.class_id,
          teacher_id: currentId,
          remove: true,
        });
      }
      pushToast({ type: 'success', title: selectedId ? 'Teacher assigned' : 'Teacher unassigned' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyClassId('');
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="card p-5 sm:p-6">
        <div className="mb-5">
          <h2 className="text-base font-bold text-slate-900">Create a class</h2>
          <p className="mt-1 text-sm text-slate-500">Set a primary teacher and attendance threshold now, or assign the teacher later.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label" htmlFor="admin-class-name">Class name</label>
            <input id="admin-class-name" className="input" value={form.class_name}
              onChange={(e) => setForm((f) => ({ ...f, class_name: e.target.value }))} required />
          </div>
          <div>
            <label className="label" htmlFor="admin-class-section">Section</label>
            <input id="admin-class-section" className="input" value={form.section}
              onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="admin-class-subject">Subject</label>
            <input id="admin-class-subject" className="input" value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="admin-class-year">Year</label>
            <input id="admin-class-year" className="input" value={form.year}
              onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="admin-class-semester">Semester</label>
            <input id="admin-class-semester" className="input" value={form.semester}
              onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))} />
          </div>
          <div>
            <label className="label" htmlFor="admin-class-threshold">Attendance threshold</label>
            <div className="relative">
              <input id="admin-class-threshold" className="input pr-9" type="number" min="0" max="100"
                value={form.attendance_threshold}
                onChange={(e) => setForm((f) => ({ ...f, attendance_threshold: e.target.value }))} required />
              <span className="absolute right-3 top-2.5 text-sm text-slate-400">%</span>
            </div>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="label" htmlFor="admin-class-teacher">Primary teacher</label>
            <select id="admin-class-teacher" className="input" value={form.teacher_id}
              onChange={(e) => setForm((f) => ({ ...f, teacher_id: e.target.value }))}>
              <option value="">Leave unassigned</option>
              {teachers.filter((teacher) => teacher.active).map((teacher) => (
                <option key={teacher.teacher_id} value={teacher.teacher_id}>
                  {teacher.name} · {teacher.email}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
            <button className="btn-primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create class'}
            </button>
          </div>
        </div>
        <ErrorNote error={error} onRetry={load} />
      </form>

      {classes === null ? (
        error ? null : <Spinner />
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
                  <th className="px-4 py-2.5">Primary teacher</th>
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
                    <td className="min-w-64 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <select
                          className="input min-w-0 py-2"
                          aria-label={`Primary teacher for ${klass.class_name}`}
                          value={assignmentSelection[klass.class_id] ?? klass.teacher_id ?? ''}
                          onChange={(event) => setAssignmentSelection((current) => ({
                            ...current,
                            [klass.class_id]: event.target.value,
                          }))}
                        >
                          <option value="">Unassigned</option>
                          {teachers
                            .filter((teacher) => teacher.active || teacher.teacher_id === klass.teacher_id)
                            .map((teacher) => (
                            <option key={teacher.teacher_id} value={teacher.teacher_id}>
                              {teacher.name}{teacher.active ? '' : ' (inactive)'}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn-secondary shrink-0 px-3 py-2 text-xs"
                          disabled={busyClassId === klass.class_id ||
                            (assignmentSelection[klass.class_id] ?? klass.teacher_id ?? '') === (klass.teacher_id || '')}
                          onClick={() => saveAssignment(klass)}
                        >
                          {busyClassId === klass.class_id ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{klass.student_count}</td>
                    <td className="px-4 py-2.5 text-slate-600">{klass.session_count}</td>
                    <td className="px-4 py-2.5 text-slate-600">{klass.attendance_threshold}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ErrorNote error={error} onRetry={load} />
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
  const [classesLoading, setClassesLoading] = useState(true);
  const [importResult, setImportResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    let active = true;
    api
      .adminGetClasses()
      .then((data) => {
        if (!active) return;
        setClasses(data.classes);
        setClassId((current) =>
          data.classes.some((klass) => klass.class_id === current)
            ? current
            : data.classes[0]?.class_id || ''
        );
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setClassesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!classId) {
      setStudents([]);
      return () => {
        active = false;
      };
    }
    setStudents(null);
    setError('');
    api
      .adminGetStudents(classId, 1000)
      .then((data) => {
        if (active) setStudents(data.students);
      })
      .catch((err) => {
        if (active) {
          setError(err.message);
          setStudents([]);
        }
      });
    return () => {
      active = false;
    };
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
              disabled={classesLoading || busy}
            >
              {!classes.length && <option value="">No classes available</option>}
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

      {classesLoading ? (
        <Spinner />
      ) : error && classes.length === 0 ? (
        null
      ) : !classId ? (
        <EmptyState
          icon={Icons.clipboard}
          title="No classes yet"
          message="Create a class before importing students."
        />
      ) : students === null ? (
        <Spinner />
      ) : students.length === 0 && error ? (
        null
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

  const load = async () => {
    try {
      const data = await api.adminReport({});
      setReport(data.report);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (error && report === null) return <ErrorNote error={error} onRetry={load} />;
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
  const { pushToast, teacher } = useApp();

  let body;
  if (tab === 'teachers') body = <PeopleTab role="teacher" pushToast={pushToast} currentUserId={teacher?.teacher_id} />;
  else if (tab === 'admins') body = <PeopleTab role="admin" pushToast={pushToast} currentUserId={teacher?.teacher_id} />;
  else if (tab === 'classes') body = <ClassesTab pushToast={pushToast} />;
  else if (tab === 'students') body = <StudentsTab pushToast={pushToast} />;
  else body = <ReportsTab />;

  return (
    <div className="fade-in mx-auto max-w-7xl space-y-6 px-4 py-8">
      <PageHeader
        title="Administration"
        subtitle="Manage accounts, assign classes, maintain rosters and review attendance."
      />
      <div role="tablist" aria-label="Administration sections" className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`admin-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls="admin-tab-panel"
            onClick={() => setTab(item.id)}
            className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              tab === item.id
                ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <section id="admin-tab-panel" role="tabpanel" aria-labelledby={`admin-tab-${tab}`}>
        {body}
      </section>
    </div>
  );
}
