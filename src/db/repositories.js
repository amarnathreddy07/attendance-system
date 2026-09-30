import db, {
  STUDENT_STATUS,
  SESSION_STATUS,
  RECORD_STATUS,
} from './db.js';
import { uid, nowIso, todayKey } from '../lib/utils.js';

export async function getSetting(key, fallback = null) {
  const row = await db.settings.get(key);
  return row ? row.value : fallback;
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value, updated_at: nowIso() });
}

// ---------------------------------------------------------------- Teacher
export async function getTeacher() {
  const all = await db.teachers.toArray();
  return all[0] || null;
}

export async function createTeacher({ name, email }) {
  const teacher = {
    id: uid('tch'),
    name: name.trim(),
    email: (email || '').trim(),
    created_at: nowIso(),
  };
  await db.teachers.clear();
  await db.teachers.add(teacher);
  return teacher;
}

export async function updateTeacher(partial) {
  const teacher = await getTeacher();
  if (!teacher) return null;
  const next = { ...teacher, ...partial, name: partial.name?.trim() ?? teacher.name };
  await db.teachers.put(next);
  return next;
}

// ---------------------------------------------------------------- Classes
export async function addClass({ class_name, section, attendance_threshold, year, semester }) {
  const klass = {
    id: uid('cls'),
    class_name: class_name.trim(),
    section: (section || '').trim(),
    year: year || '',
    semester: semester || '',
    attendance_threshold: Number.isFinite(Number(attendance_threshold)) ? Number(attendance_threshold) : 75,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await db.classes.add(klass);
  return klass;
}

export async function updateClass(id, partial) {
  const klass = await db.classes.get(id);
  if (!klass) return null;
  const next = {
    ...klass,
    ...partial,
    year: partial.year !== undefined ? partial.year : klass.year,
    semester: partial.semester !== undefined ? partial.semester : klass.semester,
    attendance_threshold:
      partial.attendance_threshold !== undefined
        ? Number.isFinite(Number(partial.attendance_threshold))
          ? Number(partial.attendance_threshold)
          : klass.attendance_threshold ?? 75
        : klass.attendance_threshold ?? 75,
    updated_at: nowIso(),
  };
  await db.classes.put(next);
  return next;
}

export async function deleteClass(id) {
  await db.transaction('rw', db.classes, db.students, db.attendance_sessions, db.attendance_records, async () => {
    const students = await db.students.where('class_id').equals(id).toArray();
    const sessions = await db.attendance_sessions.where('class_id').equals(id).toArray();
    const studentIds = students.map((s) => s.id);
    const sessionIds = sessions.map((s) => s.id);
    if (studentIds.length) await db.attendance_records.where('student_id').anyOf(studentIds).delete();
    if (sessionIds.length) await db.attendance_records.where('attendance_session_id').anyOf(sessionIds).delete();
    await db.students.where('class_id').equals(id).delete();
    await db.attendance_sessions.where('class_id').equals(id).delete();
    await db.classes.delete(id);
  });
}

// ---------------------------------------------------------------- Students
export async function addStudent({ class_id, application_number, roll_number, prn_number, name, email, status = STUDENT_STATUS.ACTIVE }) {
  const student = {
    id: uid('stu'),
    class_id,
    application_number: (application_number || '').toString().trim(),
    roll_number: (roll_number || '').toString().trim(),
    prn_number: (prn_number || '').toString().trim(),
    name: name.trim(),
    email: (email || '').trim(),
    status,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await db.students.add(student);
  return student;
}

export async function updateStudent(id, partial) {
  const student = await db.students.get(id);
  if (!student) return null;
  const next = { ...student, ...partial, updated_at: nowIso() };
  await db.students.put(next);
  return next;
}

export async function setStudentStatus(id, status) {
  return updateStudent(id, { status });
}

export async function deleteStudent(id) {
  await db.attendance_records.where('student_id').equals(id).delete();
  await db.students.delete(id);
}

export async function bulkImportStudents(class_id, students) {
  const existing = await db.students.where('class_id').equals(class_id).toArray();
  const byApp = new Map(existing.map((s) => [s.application_number, s]));
  const added = [];
  const updated = [];
  await db.transaction('rw', db.students, async () => {
    for (const s of students) {
      const data = {
        class_id,
        application_number: String(s.application_number || '').trim(),
        roll_number: String(s.roll_number || '').trim(),
        prn_number: String(s.prn_number || '').trim(),
        name: String(s.name || '').trim(),
        email: String(s.email || '').trim(),
        status: s.status || STUDENT_STATUS.ACTIVE,
      };
      if (!data.name) continue;
      const existingStudent = data.application_number ? byApp.get(data.application_number) : undefined;
      if (existingStudent) {
        await db.students.update(existingStudent.id, { ...data, updated_at: nowIso() });
        updated.push(existingStudent.id);
      } else {
        await db.students.add({ id: uid('stu'), ...data, created_at: nowIso(), updated_at: nowIso() });
        added.push(data.application_number);
      }
    }
  });
  return { added: added.length, updated: updated.length };
}

export async function getStudentsForClass(class_id, { includeInactive = true } = {}) {
  const list = await db.students.where('class_id').equals(class_id).toArray();
  return list
    .filter((s) => (includeInactive ? true : s.status === STUDENT_STATUS.ACTIVE))
    .sort((a, b) =>
      a.application_number.localeCompare(b.application_number, undefined, { numeric: true }) ||
      a.roll_number.localeCompare(b.roll_number, undefined, { numeric: true })
    );
}

// ---------------------------------------------------------------- Attendance sessions
export async function getSessionsOnDate(class_id, date) {
  return db.attendance_sessions
    .where('[class_id+date]')
    .equals([class_id, date])
    .toArray();
}

export async function createSession(class_id, name) {
  const existing = await db.attendance_sessions
    .where('[class_id+status]')
    .equals([class_id, SESSION_STATUS.IN_PROGRESS])
    .first();
  if (existing) return existing;

  const date = todayKey();
  const session = {
    id: uid('ses'),
    class_id,
    date,
    name: name || '',
    status: SESSION_STATUS.IN_PROGRESS,
    created_at: nowIso(),
    submitted_at: null,
  };
  await db.attendance_sessions.add(session);
  return session;
}

export async function getInProgressSession(class_id) {
  return db.attendance_sessions
    .where('[class_id+status]')
    .equals([class_id, SESSION_STATUS.IN_PROGRESS])
    .first();
}

export async function getSession(id) {
  return db.attendance_sessions.get(id);
}

export async function getSessionsForClass(class_id) {
  return db.attendance_sessions
    .where('class_id')
    .equals(class_id)
    .filter((s) => s.status === SESSION_STATUS.COMPLETED)
    .sortBy('created_at');
}

export async function markSessionSubmitted(id) {
  await db.attendance_sessions.update(id, { status: SESSION_STATUS.COMPLETED, submitted_at: nowIso() });
}

export async function discardSession(id) {
  await db.transaction('rw', db.attendance_sessions, db.attendance_records, async () => {
    await db.attendance_records.where('attendance_session_id').equals(id).delete();
    await db.attendance_sessions.delete(id);
  });
}

export async function hasCompletedSessionOnDate(class_id, date) {
  const s = await db.attendance_sessions
    .where('[class_id+date]')
    .equals([class_id, date])
    .filter((x) => x.status === SESSION_STATUS.COMPLETED)
    .first();
  return !!s;
}

export async function updateSessionDate(id, date) {
  await db.attendance_sessions.update(id, { date });
}

// ---------------------------------------------------------------- Attendance records
export async function upsertRecord(session_id, student_id, status) {
  return db.transaction('rw', db.attendance_records, async () => {
    const existing = await db.attendance_records
      .where('[attendance_session_id+student_id]')
      .equals([session_id, student_id])
      .first();
    if (existing) {
      await db.attendance_records.update(existing.id, { status, updated_at: nowIso() });
      return existing.id;
    }
    const record = {
      id: uid('rec'),
      attendance_session_id: session_id,
      student_id,
      status,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await db.attendance_records.add(record);
    return record.id;
  });
}

export async function getRecordsForSession(session_id) {
  return db.attendance_records.where('attendance_session_id').equals(session_id).toArray();
}

export async function deleteRecordByStudent(session_id, student_id) {
  await db.attendance_records
    .where('[attendance_session_id+student_id]')
    .equals([session_id, student_id])
    .delete();
}

export async function getRecordMap(session_id) {
  const records = await getRecordsForSession(session_id);
  const map = {};
  for (const r of records) map[r.student_id] = r;
  return map;
}

export async function getSessionStatusMap(session_id) {
  const records = await getRecordsForSession(session_id);
  const map = {};
  for (const r of records) map[r.student_id] = r.status;
  return map;
}

// ---------------------------------------------------------------- Student attendance history
export async function getStudentAttendance(student_id) {
  const records = await db.attendance_records.where('student_id').equals(student_id).toArray();
  const sessionIds = [...new Set(records.map((r) => r.attendance_session_id))];
  const sessions = sessionIds.length
    ? await db.attendance_sessions.where('id').anyOf(sessionIds).toArray()
    : [];
  const sessionMap = {};
  for (const s of sessions) sessionMap[s.id] = s;
  const result = [];
  for (const r of records) {
    const session = sessionMap[r.attendance_session_id];
    if (!session || session.status !== SESSION_STATUS.COMPLETED) continue;
    result.push({
      record: r,
      session,
      status: r.status,
      date: session.date,
    });
  }
  return result.sort((a, b) => b.session.date.localeCompare(a.session.date));
}
