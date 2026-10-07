/**
 * Cache-down: mirrors the backend into Dexie so the existing pages keep
 * working unchanged while the backend stays authoritative.
 *
 * Id strategy: backend ids become the Dexie primary key. Locally created rows
 * are matched to backend rows by application_number / roll_number and inherit
 * the backend id, so nothing the teacher typed is thrown away.
 */
import db from '../db/db.js';
import { api } from './apiClient.js';
import { nowIso, todayKey } from './utils.js';

async function upsertClass(klass) {
  const existing = await db.classes.get(klass.class_id);
  if (existing) {
    await db.classes.put({
      ...existing,
      id: klass.class_id,
      class_name: klass.class_name,
      section: klass.section || '',
      subject: klass.subject || '',
      year: klass.year || '',
      semester: klass.semester || '',
      attendance_threshold: klass.attendance_threshold,
      active: klass.active !== false,
      backend_class_id: klass.class_id,
      sync: 'synced',
      updated_at: nowIso(),
    });
    return;
  }

  // A class created on this device before the first sync keeps its local row;
  // it inherits the backend id instead of becoming a duplicate.
  const all = await db.classes.toArray();
  const localMatch = all.find(
    (row) =>
      !row.backend_class_id &&
      row.class_name === klass.class_name &&
      (row.section || '') === (klass.section || '')
  );
  if (localMatch) {
    const { id: _oldId, ...rest } = localMatch;
    await db.classes.delete(localMatch.id);
    await db.classes.put({
      ...rest,
      id: klass.class_id,
      backend_class_id: klass.class_id,
      subject: klass.subject || rest.subject || '',
      year: klass.year || rest.year || '',
      semester: klass.semester || rest.semester || '',
      attendance_threshold: klass.attendance_threshold ?? rest.attendance_threshold ?? 75,
      active: klass.active !== false,
      sync: 'synced',
      updated_at: nowIso(),
    });
    // Re-point the roster that belonged to the old local id.
    const students = await db.students.where('class_id').equals(localMatch.id).toArray();
    for (const student of students) {
      await db.students.put({ ...student, class_id: klass.class_id, updated_at: nowIso() });
    }
    const sessions = await db.attendance_sessions.where('class_id').equals(localMatch.id).toArray();
    for (const session of sessions) {
      await db.attendance_sessions.put({ ...session, class_id: klass.class_id, updated_at: nowIso() });
    }
    return;
  }

  await db.classes.put({
    id: klass.class_id,
    class_name: klass.class_name,
    section: klass.section || '',
    subject: klass.subject || '',
    year: klass.year || '',
    semester: klass.semester || '',
    attendance_threshold: klass.attendance_threshold,
    active: klass.active !== false,
    backend_class_id: klass.class_id,
    sync: 'synced',
    created_at: nowIso(),
    updated_at: nowIso(),
  });
}

async function upsertStudent(classId, student) {
  const existing = await db.students.get(student.student_id);
  if (existing) {
    await db.students.put({ ...existing, ...student, id: student.student_id, backend_student_id: student.student_id, sync: 'synced' });
    return;
  }

  // Match a locally created roster entry by identifier before adding a new row.
  const candidates = await db.students.where('class_id').equals(classId).toArray();
  const match = candidates.find(
    (row) =>
      !row.backend_student_id &&
      ((row.application_number && row.application_number === student.application_number) ||
        (row.roll_number && row.roll_number === student.roll_number) ||
        (row.prn_number && row.prn_number === student.prn_number))
  );
  if (match) {
    await db.students.put({ ...match, backend_student_id: student.student_id, sync: 'synced', updated_at: nowIso() });
    return;
  }

  await db.students.put({
    id: student.student_id,
    class_id: classId,
    application_number: student.application_number || '',
    roll_number: student.roll_number || '',
    prn_number: student.prn_number || '',
    name: student.name,
    email: student.email || '',
    status: student.status || 'active',
    backend_student_id: student.student_id,
    sync: 'synced',
    created_at: nowIso(),
    updated_at: nowIso(),
  });
}

async function syncClassAttendance(classId, sessions) {
  for (const session of sessions) {
    const detail = await api.getSessionDetail(session.session_id);
    await db.attendance_sessions.put({
      id: session.session_id,
      class_id: classId,
      date: session.date,
      name: session.name || 'Session',
      status: session.status === 'submitted' ? 'completed' : 'in_progress',
      created_at: session.submitted_at || session.start_time || nowIso(),
      updated_at: session.submitted_at || nowIso(),
      backend_session_id: session.session_id,
      sync: 'synced',
    });
    for (const record of detail.records) {
      await db.attendance_records.put({
        id: record.attendance_id,
        attendance_session_id: session.session_id,
        student_id: record.student_id,
        status: String(record.status || 'P').toLowerCase() === 'p' ? 'present' : String(record.status).toLowerCase() === 'a' ? 'absent' : 'od',
        marked_at: record.updated_at || nowIso(),
        backend_attendance_id: record.attendance_id,
        sync: 'synced',
      });
    }
  }
}

/** Pulls everything the signed-in user may see. Safe to call repeatedly. */
export async function syncDown() {
  const { classes } = await api.getClasses();
  let synced = 0;

  for (const klass of classes) {
    await upsertClass(klass);
    const { students } = await api.getClassStudents(klass.class_id, true);
    for (const student of students) {
      await upsertStudent(klass.class_id, student);
    }
    try {
      const { sessions } = await api.getAttendanceHistory(klass.class_id, 120);
      await syncClassAttendance(klass.class_id, sessions);
    } catch {
      // History is best-effort; the queue still holds anything unsent.
    }
    synced += 1;
  }

  return { classes: synced, at: todayKey() };
}
