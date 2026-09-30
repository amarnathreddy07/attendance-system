import Dexie from 'dexie';

export const STUDENT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
};

export const SESSION_STATUS = {
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
};

export const RECORD_STATUS = {
  PRESENT: 'present',
  ABSENT: 'absent',
  OD: 'od',
};

const db = new Dexie('attendit_db');

db.version(1).stores({
  settings: 'key',
  teachers: 'id',
  classes: 'id, name',
  students: 'id, class_id, status, [class_id+status], [class_id+application_number]',
  attendance_sessions: 'id, class_id, date, status, [class_id+date], [class_id+status]',
  attendance_records: 'id, attendance_session_id, student_id, status, [attendance_session_id+student_id]',
  sync_queue: 'id, class_id, sync_status, [class_id+sync_status]',
});

db.version(2).stores({
  settings: 'key',
  teachers: 'id',
  classes: 'id, name, class_name',
  students: 'id, class_id, status, [class_id+status], [class_id+application_number]',
  attendance_sessions: 'id, class_id, date, status, [class_id+date], [class_id+status]',
  attendance_records: 'id, attendance_session_id, student_id, status, [attendance_session_id+student_id]',
  sync_queue: 'id, class_id, sync_status, [class_id+sync_status]',
});

db.version(3).stores({
  settings: 'key',
  teachers: 'id',
  classes: 'id, name, class_name, created_at',
  students: 'id, class_id, status, [class_id+status], [class_id+application_number]',
  attendance_sessions: 'id, class_id, date, status, [class_id+date], [class_id+status]',
  attendance_records: 'id, attendance_session_id, student_id, status, [attendance_session_id+student_id]',
  sync_queue: 'id, class_id, sync_status, [class_id+sync_status]',
});

// v4: sync_queue removed (no more Google Sheets sync).
db.version(4).stores({
  settings: 'key',
  teachers: 'id',
  classes: 'id, name, class_name, created_at',
  students: 'id, class_id, status, [class_id+status], [class_id+application_number]',
  attendance_sessions: 'id, class_id, date, status, [class_id+date], [class_id+status]',
  attendance_records: 'id, attendance_session_id, student_id, status, [attendance_session_id+student_id]',
});

db.version(6).stores({
  settings: 'key',
  teachers: 'id',
  classes: 'id, name, class_name, created_at, year, semester',
  students: 'id, class_id, status, [class_id+status], [class_id+application_number]',
  attendance_sessions: 'id, class_id, date, status, [class_id+date], [class_id+status]',
  attendance_records: 'id, attendance_session_id, student_id, status, [attendance_session_id+student_id]',
});

db.version(7).stores({
  settings: 'key',
  teachers: 'id',
  classes: 'id, name, class_name, created_at, year, semester',
  students: 'id, class_id, status, [class_id+status], [class_id+application_number]',
  attendance_sessions: 'id, class_id, date, status, [class_id+date], [class_id+status]',
  attendance_records: 'id, attendance_session_id, student_id, status, [attendance_session_id+student_id]',
});

export default db;
