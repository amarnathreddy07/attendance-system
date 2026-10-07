/** Shared seed data: headers must match SCHEMA exactly. */

export const HEADERS = {
  Teachers: ['teacher_id', 'name', 'email', 'role', 'active', 'created_at'],
  Classes: [
    'class_id',
    'class_name',
    'section',
    'subject',
    'year',
    'semester',
    'teacher_id',
    'attendance_threshold',
    'active',
    'created_at',
    'updated_at',
  ],
  ClassTeachers: ['class_id', 'teacher_id', 'assigned_at'],
  Students: [
    'student_id',
    'class_id',
    'application_number',
    'roll_number',
    'prn_number',
    'name',
    'email',
    'status',
    'created_at',
    'updated_at',
  ],
  Sessions: ['session_id', 'class_id', 'date', 'teacher_id', 'name', 'start_time', 'submitted_at', 'status'],
  Attendance: [
    'attendance_id',
    'session_id',
    'student_id',
    'class_id',
    'date',
    'status',
    'marked_by',
    'client_operation_id',
    'created_at',
    'updated_at',
  ],
  SyncLog: ['client_operation_id', 'action', 'processed_at', 'result'],
};

export const TEACHER_ID = 'tch_alice';
export const OTHER_TEACHER_ID = 'tch_bob';
export const ADMIN_ID = 'tch_admin';
export const CLASS_ID = 'cls_101';
export const OTHER_CLASS_ID = 'cls_202';

export function seed() {
  return {
    Teachers: [
      HEADERS.Teachers,
      [TEACHER_ID, 'Alice Teacher', 'alice@example.edu', 'teacher', 'TRUE', '2026-01-01T00:00:00.000Z'],
      [OTHER_TEACHER_ID, 'Bob Teacher', 'bob@example.edu', 'teacher', 'TRUE', '2026-01-01T00:00:00.000Z'],
      [ADMIN_ID, 'Admin User', 'admin@example.edu', 'admin', 'TRUE', '2026-01-01T00:00:00.000Z'],
      ['tch_inactive', 'Retired Teacher', 'gone@example.edu', 'teacher', 'FALSE', '2026-01-01T00:00:00.000Z'],
    ],
    Classes: [
      HEADERS.Classes,
      [CLASS_ID, 'Physics I', 'A', 'Physics', '2026', '1', TEACHER_ID, '75', 'TRUE', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      [OTHER_CLASS_ID, 'Chemistry I', 'B', 'Chemistry', '2026', '1', OTHER_TEACHER_ID, '75', 'TRUE', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
    ],
    ClassTeachers: [HEADERS.ClassTeachers],
    Students: [
      HEADERS.Students,
      ['stu_1', CLASS_ID, 'APP001', '1', 'PRN01', 'Asha Rao', 'asha@example.edu', 'active', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['stu_2', CLASS_ID, 'APP002', '2', 'PRN02', 'Bala Sen', 'bala@example.edu', 'active', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['stu_3', CLASS_ID, 'APP003', '3', 'PRN03', 'Chan Yu', 'chan@example.edu', 'active', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
      ['stu_9', OTHER_CLASS_ID, 'APP009', '1', 'PRN09', 'Other Student', 'other@example.edu', 'active', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'],
    ],
    Sessions: [HEADERS.Sessions],
    Attendance: [HEADERS.Attendance],
    SyncLog: [HEADERS.SyncLog],
  };
}

export const TODAY = '2026-01-15';