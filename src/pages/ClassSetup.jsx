import { useRef, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import db from '../db/db.js';
import { addClass, updateClass, bulkImportStudents } from '../db/repositories.js';
import { parseCsv } from '../lib/sample.js';
import { parseStudentRows } from '../lib/studentSheet.js';
import { parseClassExport } from '../lib/classExport.js';
import { useApp } from '../state/AppContext.jsx';
import { BackLink, Spinner, PageHeader } from '../components/ui.jsx';
import { Icons, Icon } from '../components/icons.jsx';

function PreviewTable({ students }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Roll Number</th>
              <th className="px-4 py-2.5">PRN Number</th>
              <th className="px-4 py-2.5">Application Number</th>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.slice(0, 60).map((s, i) => (
              <tr key={i} className="hover:bg-slate-50/60">
                <td className="px-4 py-2 font-mono text-xs text-slate-600">{s.roll_number}</td>
                <td className="px-4 py-2 font-mono text-xs text-slate-600">{s.prn_number}</td>
                <td className="px-4 py-2 font-mono text-xs text-slate-600">{s.application_number}</td>
                <td className="px-4 py-2 font-medium text-slate-900">{s.name}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{s.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {students.length > 60 && (
        <p className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          Showing first 60 of {students.length} students.
        </p>
      )}
    </div>
  );
}

export default function ClassSetup() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { pushToast } = useApp();
  const fileRef = useRef(null);
  const importFileRef = useRef(null);

  const klass = useLiveQuery(async () => (id ? db.classes.get(id) : null), [id]);

  const [name, setName] = useState('');
  const [section, setSection] = useState('');
  const [year, setYear] = useState('');
  const [semester, setSemester] = useState('');
  const [threshold, setThreshold] = useState(75);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (klass && !preview && !name) {
      setName(klass.class_name || '');
      setSection(klass.section || '');
      setYear(klass.year || '');
      setSemester(klass.semester || '');
      setThreshold(klass.attendance_threshold ?? 75);
    }
  }, [klass, preview, name]);

  const step = preview ? 'preview' : 'form';

  const goImport = async (students) => {
    setBusy(true);
    setError('');
    if (!name.trim()) {
      setError('Please enter a class name.');
      setBusy(false);
      return;
    }
    try {
      let classId = id;
      if (!classId) {
        const created = await addClass({ class_name: name, section, year, semester, attendance_threshold: threshold });
        classId = created.id;
      } else {
        await updateClass(classId, { class_name: name, section, year, semester, attendance_threshold: threshold });
      }
      await bulkImportStudents(classId, students);
      pushToast({
        type: 'success',
        title: 'Students imported',
        message: `${students.length} student${students.length === 1 ? '' : 's'} saved locally.`,
      });
      navigate(`/classes/${classId}`);
    } catch (err) {
      setError(err.message);
      pushToast({ type: 'error', title: 'Import failed', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const onCsv = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!name.trim()) {
      setError('Please enter a class name before uploading a CSV.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result || ''));
      const parsed = parseStudentRows(rows);
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }
      setPreview({ source: 'csv', students: parsed.students });
    };
    reader.readAsText(file);
  };

  const skipImport = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Please enter a class name.');
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await updateClass(id, { class_name: name, section, year, semester, attendance_threshold: threshold });
        navigate(`/classes/${id}`);
      } else {
        const created = await addClass({ class_name: name, section, year, semester, attendance_threshold: threshold });
        navigate(`/classes/${created.id}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const onImportClass = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = parseClassExport(String(reader.result || ''));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const { class: classData, students } = result.data;
      setName(classData.class_name || '');
      setSection(classData.section || '');
      setYear(classData.year || '');
      setSemester(classData.semester || '');
      setThreshold(classData.attendance_threshold ?? 75);
      setPreview({ source: 'import', students });
    };
    reader.readAsText(file);
  };

  if (editing && !klass) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <BackLink to={editing ? `/classes/${id}` : '/'} label={editing ? 'Back to class' : 'Back to dashboard'} />
      </div>
      <PageHeader
        title={editing ? 'Edit Class' : 'Add Class'}
        subtitle={
          editing
            ? 'Update class details or re-import students from a CSV file.'
            : 'Create a class and import your roster from a CSV file, or start with without importing.'
        }
      />

      {step === 'form' && (
        <div className="card space-y-5 p-6">
          <div>
            <label className="label" htmlFor="cls-name">
              Class Name
            </label>
            <input
              id="cls-name"
              className="input"
              placeholder="Data Structures"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Year</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((y) => (
                  <button
                    key={y}
                    type="button"
                    className={`select-box flex-1 ${year === String(y) ? 'select-box-active' : ''}`}
                    onClick={() => setYear(year === String(y) ? '' : String(y))}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Semester</label>
              <div className="flex gap-2">
                {['A', 'B'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`select-box flex-1 ${semester === s ? 'select-box-active' : ''}`}
                    onClick={() => setSemester(semester === s ? '' : s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="cls-section">
                Section
              </label>
              <input
                id="cls-section"
                className="input"
                type="number"
                placeholder="Section"
                value={section}
                onChange={(e) => setSection(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="cls-threshold">
                Attendance Risk Threshold (%)
              </label>
              <input
                id="cls-threshold"
                className="input"
                type="number"
                min="0"
                max="100"
                step="1"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              <p>{error}</p>
            </div>
          )}

          {!editing && (
            <>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className="btn-primary flex-1 py-3"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  <Icon d={Icons.upload} className="h-4 w-4" /> Upload CSV
                </button>
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onCsv} />
                <button
                  type="button"
                  className="btn-secondary flex-1 py-3"
                  disabled={busy}
                  onClick={() => importFileRef.current?.click()}
                >
                  <Icon d={Icons.upload} className="h-4 w-4" /> Import Existing JSON
                </button>
            <input ref={importFileRef} type="file" accept=".json,application/json" className="hidden" onChange={onImportClass} />
              </div>
              <p className="text-xs leading-5 text-slate-500">
                The CSV should have columns: Application Number, Roll Number, Student Name. PRN Number, Email and Status are optional.
              </p>
              <p className="text-xs leading-5 text-slate-500">
                Import Existing Class: Upload a previously exported class JSON file to restore class details and students.
              </p>
            </>
          )}

          <div className="border-t border-slate-100 pt-4">
            <button type="button" className="btn-ghost w-full text-sm" disabled={busy} onClick={skipImport}>
              {editing ? 'Save Class Details' : 'Create class without importing students'}
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="fade-in space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            <Icon d={Icons.checkCircle} className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">
                {preview.source === 'csv' ? 'CSV loaded' : 'Sample students generated'}
              </p>
              <p className="text-opacity-80">
                {preview.students.length} student{preview.students.length === 1 ? '' : 's'} found. Review before importing.
              </p>
            </div>
          </div>

          <PreviewTable students={preview.students} />

          {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <button className="btn-secondary" disabled={busy} onClick={() => setPreview(null)}>
              Back
            </button>
            <button className="btn-primary" disabled={busy} onClick={() => goImport(preview.students)}>
              {busy ? (
                <>
                  <Spinner className="h-4 w-4" /> Importing…
                </>
              ) : (
                <>
                  <Icon d={Icons.check} className="h-4 w-4" /> Import {preview.students.length} Student
                  {preview.students.length === 1 ? '' : 's'}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
