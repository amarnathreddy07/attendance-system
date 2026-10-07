import assert from 'node:assert/strict';
import test from 'node:test';

import { callAction, createBackend, loginAs } from './harness.mjs';
import { seed, TODAY, CLASS_ID, OTHER_CLASS_ID, TEACHER_ID, OTHER_TEACHER_ID } from './seed.mjs';

function teacherSession(backend, email = 'alice@example.edu') {
  return loginAs(backend, email).session_token;
}

function submit(backend, token, overrides = {}) {
  return callAction(
    backend,
    'submitAttendance',
    Object.assign(
      {
        class_id: CLASS_ID,
        session_id: 'ses_local_1',
        date: TODAY,
        client_operation_id: 'op_1',
        records: [
          { student_id: 'stu_1', status: 'present' },
          { student_id: 'stu_2', status: 'A' },
          { student_id: 'stu_3', status: 'P' },
        ],
      },
      overrides
    ),
    token
  );
}

test('submitting attendance writes one session and one row per student', () => {
  const backend = createBackend({ data: seed() });
  const token = teacherSession(backend);
  const result = submit(backend, token);

  assert.equal(result.success, true);
  assert.equal(result.data.duplicate, false);
  assert.equal(result.data.written, 3);
  assert.equal(result.data.updated, 0);

  const sessions = backend.spreadsheet.table('Sessions').rows;
  const records = backend.spreadsheet.table('Attendance').rows;
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0][0], 'ses_local_1');
  assert.equal(sessions[0][7], 'submitted');
  assert.equal(records.length, 3);
  assert.deepEqual(
    records.map((row) => row[5]).sort(),
    ['A', 'P', 'P']
  );
  assert.ok(records.every((row) => row[6] === 'alice@example.edu'));
});

test('statuses are normalized to P / A / OD regardless of the input spelling', () => {
  const backend = createBackend({ data: seed() });
  const result = submit(backend, teacherSession(backend), {
    records: [
      { student_id: 'stu_1', status: 'P' },
      { student_id: 'stu_2', status: 'absent' },
      { student_id: 'stu_3', status: 'on duty' },
    ],
  });

  assert.equal(result.success, true);
  assert.deepEqual(
    backend.spreadsheet
      .table('Attendance')
      .rows.map((row) => row[5])
      .sort(),
    ['A', 'OD', 'P']
  );
});

test('replaying the same client_operation_id writes nothing new', () => {
  const backend = createBackend({ data: seed() });
  const token = teacherSession(backend);

  const first = submit(backend, token);
  const second = submit(backend, token);

  assert.equal(first.data.duplicate, false);
  assert.equal(second.data.duplicate, true);
  assert.equal(second.data.written, 0);
  assert.equal(backend.spreadsheet.table('Attendance').rows.length, 3, 'no duplicate rows');
  assert.equal(backend.spreadsheet.table('Sessions').rows.length, 1);
  assert.equal(backend.spreadsheet.table('SyncLog').rows.length, 1);
});

test('a second, different submission for the same class and date is refused', () => {
  const backend = createBackend({ data: seed() });
  const token = teacherSession(backend);
  submit(backend, token);

  const second = submit(backend, token, {
    session_id: 'ses_local_2',
    client_operation_id: 'op_2',
  });

  assert.equal(second.success, false);
  assert.equal(second.error.code, 'DUPLICATE');
  assert.match(second.error.message, /already been submitted/);
  assert.equal(backend.spreadsheet.table('Sessions').rows.length, 1);
});

test('resubmitting the same session_id updates rows in place instead of duplicating them', () => {
  const backend = createBackend({ data: seed() });
  const token = teacherSession(backend);
  submit(backend, token);

  const again = submit(backend, token, {
    client_operation_id: 'op_resubmit',
    records: [
      { student_id: 'stu_1', status: 'A' },
      { student_id: 'stu_2', status: 'P' },
      { student_id: 'stu_3', status: 'P' },
    ],
  });

  assert.equal(again.success, true);
  assert.equal(again.data.written, 0);
  assert.equal(again.data.updated, 3);
  assert.equal(backend.spreadsheet.table('Attendance').rows.length, 3);
  const rows = backend.spreadsheet.table('Attendance').rows;
  assert.equal(rows.find((row) => row[2] === 'stu_1')[5], 'A');
  assert.equal(rows.find((row) => row[2] === 'stu_2')[5], 'P');
});

test('every invalid row is reported at once, not just the first', () => {
  const backend = createBackend({ data: seed() });
  const result = submit(backend, teacherSession(backend), {
    records: [
      { student_id: 'stu_1', status: 'P' },
      { student_id: '', status: 'P' },
      { student_id: 'stu_2', status: 'maybe' },
      { student_id: 'stu_1', status: 'P' },
    ],
  });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'VALIDATION_ERROR');
  assert.equal(result.error.details.rows.length, 3);
  assert.deepEqual(
    result.error.details.rows.map((row) => row.field),
    ['student_id', 'status', 'student_id']
  );
  assert.equal(backend.spreadsheet.table('Attendance').rows.length, 0);
});

test('an empty submission is rejected', () => {
  const backend = createBackend({ data: seed() });
  const result = submit(backend, teacherSession(backend), { records: [] });
  assert.equal(result.error.code, 'VALIDATION_ERROR');
});

test('a malformed date is rejected', () => {
  const backend = createBackend({ data: seed() });
  const result = submit(backend, teacherSession(backend), { date: '15/01/2026' });
  assert.equal(result.error.code, 'VALIDATION_ERROR');
  assert.match(result.error.message, /YYYY-MM-DD/);
});

test('a student from another class is rejected with row-level detail', () => {
  const backend = createBackend({ data: seed() });
  const result = submit(backend, teacherSession(backend), {
    records: [
      { student_id: 'stu_1', status: 'P' },
      { student_id: 'stu_9', status: 'P' },
    ],
  });

  assert.equal(result.error.code, 'VALIDATION_ERROR');
  assert.deepEqual(result.error.details.rows, [
    { row: 'stu_9', field: 'student_id', message: 'Not a member of this class.' },
  ]);
  assert.equal(backend.spreadsheet.table('Sessions').rows.length, 0);
});

test('a teacher cannot submit attendance for a class they do not own', () => {
  const backend = createBackend({ data: seed() });
  const result = submit(backend, teacherSession(backend), { class_id: OTHER_CLASS_ID });

  assert.equal(result.error.code, 'UNAUTHORIZED');
  assert.equal(backend.spreadsheet.table('Sessions').rows.length, 0);
});

test('an admin may submit attendance for any class', () => {
  const backend = createBackend({ data: seed() });
  const result = submit(backend, teacherSession(backend, 'admin@example.edu'), {
    class_id: OTHER_CLASS_ID,
    records: [{ student_id: 'stu_9', status: 'P' }],
  });

  assert.equal(result.success, true);
  assert.equal(backend.spreadsheet.table('Attendance').rows.length, 1);
});

test('an unauthenticated submit is rejected before any write', () => {
  const backend = createBackend({ data: seed() });
  const result = submit(backend, '');
  assert.equal(result.error.code, 'UNAUTHENTICATED');
  assert.equal(backend.spreadsheet.table('Sessions').rows.length, 0);
});

test('a whole-class submission costs a bounded number of writes', () => {
  const backend = createBackend({ data: seed() });
  const adminToken = teacherSession(backend, 'admin@example.edu');

  const importRows = [];
  for (let i = 0; i < 60; i += 1) {
    importRows.push({
      name: 'Bulk Student ' + i,
      application_number: 'BULK' + i,
      roll_number: String(i + 1),
      prn_number: 'PBULK' + i,
    });
  }
  const imported = callAction(
    backend,
    'adminImportStudents',
    { class_id: CLASS_ID, rows: importRows },
    adminToken
  );
  assert.equal(imported.data.added, 57, 'rolls 1-3 update the seeded students');
  assert.equal(imported.data.updated, 3);

  const roster = callAction(backend, 'getClassStudents', { class_id: CLASS_ID }, teacherSession(backend));
  assert.equal(roster.data.students.length, 60);
  const records = roster.data.students.map((student) => ({
    student_id: student.student_id,
    status: 'P',
  }));

  const result = submit(backend, teacherSession(backend), { records });
  assert.equal(result.success, true);
  assert.equal(result.data.written, 60);

  // One setValues per table: attendance, sessions, sync log.
  const writeCount =
    backend.spreadsheet.sheets.Attendance.writeLog.length +
    backend.spreadsheet.sheets.Sessions.writeLog.length +
    backend.spreadsheet.sheets.SyncLog.writeLog.length;
  assert.equal(writeCount, 3, 'one setValues per table, regardless of roster size');
});

test('the dashboard reports today\'s classes with roster size and attendance state', () => {
  const backend = createBackend({ data: seed() });
  const token = teacherSession(backend);

  const before = callAction(backend, 'getTodayClasses', { date: TODAY }, token);
  assert.equal(before.data.classes.length, 1);
  assert.equal(before.data.classes[0].student_count, 3);
  assert.equal(before.data.classes[0].attendance_taken, false);

  submit(backend, token);
  const after = callAction(backend, 'getTodayClasses', { date: TODAY }, token);
  assert.equal(after.data.classes[0].attendance_taken, true);
  assert.equal(after.data.classes[0].session_id, 'ses_local_1');
});

test('a teacher only sees their own classes', () => {
  const backend = createBackend({ data: seed() });
  const alice = callAction(backend, 'getClasses', {}, teacherSession(backend));
  const bob = callAction(backend, 'getClasses', {}, teacherSession(backend, 'bob@example.edu'));
  const admin = callAction(backend, 'getClasses', {}, teacherSession(backend, 'admin@example.edu'));

  assert.equal(alice.data.classes.length, 1);
  assert.equal(bob.data.classes.length, 1);
  assert.equal(admin.data.classes.length, 2);
});

test('history reports per-session present / absent totals', () => {
  const backend = createBackend({ data: seed() });
  const token = teacherSession(backend);
  submit(backend, token);

  const history = callAction(backend, 'getAttendanceHistory', { class_id: CLASS_ID }, token);
  assert.equal(history.data.sessions.length, 1);
  assert.equal(history.data.sessions[0].present, 2);
  assert.equal(history.data.sessions[0].absent, 1);
  assert.equal(history.data.sessions[0].marked, 3);
});

test('session detail returns the roster with marks and edit permission', () => {
  const backend = createBackend({ data: seed() });
  const token = teacherSession(backend);
  submit(backend, token);

  const detail = callAction(backend, 'getSessionDetail', { session_id: 'ses_local_1' }, token);
  assert.equal(detail.data.records.length, 3);
  assert.equal(detail.data.can_edit, true);
  assert.equal(detail.data.records.find((r) => r.student_id === 'stu_2').status, 'A');
});

test('another teacher cannot read session detail for a class they do not own', () => {
  const backend = createBackend({ data: seed() });
  submit(backend, teacherSession(backend));

  const attempt = callAction(backend, 'getSessionDetail', { session_id: 'ses_local_1' }, teacherSession(backend, 'bob@example.edu'));
  assert.equal(attempt.error.code, 'UNAUTHORIZED');
});

test('corrections after submission are applied in one batch', () => {
  const backend = createBackend({ data: seed() });
  const token = teacherSession(backend);
  submit(backend, token);

  const result = callAction(
    backend,
    'updateAttendance',
    {
      records: [
        { session_id: 'ses_local_1', student_id: 'stu_2', status: 'P' },
        { session_id: 'ses_local_1', student_id: 'stu_3', status: 'A' },
      ],
    },
    token
  );

  assert.equal(result.success, true);
  assert.equal(result.data.updated, 2);
  const rows = backend.spreadsheet.table('Attendance').rows;
  assert.equal(rows.find((row) => row[2] === 'stu_2')[5], 'P');
  assert.equal(rows.find((row) => row[2] === 'stu_3')[5], 'A');
  assert.equal(rows.length, 3, 'corrections never add rows');
});

test('a correction for a row that was never marked is rejected', () => {
  const backend = createBackend({ data: seed() });
  const token = teacherSession(backend);
  submit(backend, token);

  const result = callAction(
    backend,
    'updateAttendance',
    { records: [{ session_id: 'ses_local_1', student_id: 'stu_9', status: 'P' }] },
    token
  );

  assert.equal(result.error.code, 'VALIDATION_ERROR');
  assert.match(result.error.details.rows[0].message, /No attendance row/);
});

test('a teacher cannot correct a session belonging to someone else', () => {
  const backend = createBackend({ data: seed() });
  submit(backend, teacherSession(backend));
  const bob = teacherSession(backend, 'bob@example.edu');

  const result = callAction(
    backend,
    'updateAttendance',
    { records: [{ session_id: 'ses_local_1', student_id: 'stu_1', status: 'A' }] },
    bob
  );

  assert.equal(result.error.code, 'VALIDATION_ERROR');
  assert.match(JSON.stringify(result.error.details.rows[0].message), /not authorized/i);
});

test('a teacher is blocked from every admin action', () => {
  const backend = createBackend({ data: seed() });
  const token = teacherSession(backend);
  const blocked = [
    'adminGetTeachers',
    'adminCreateTeacher',
    'adminUpdateTeacher',
    'adminGetClasses',
    'adminCreateClass',
    'adminUpdateClass',
    'adminAssignTeacher',
    'adminGetStudents',
    'adminImportStudents',
    'adminDeleteStudent',
    'adminGetAttendance',
    'adminReport',
  ];

  blocked.forEach((action) => {
    const result = callAction(backend, action, {}, token);
    assert.equal(result.success, false, action + ' must be refused');
    assert.equal(result.error.code, 'UNAUTHORIZED', action);
  });
});
// ------------------------------------------------------------ teacher-owned

test('a teacher creates their own class and owns it immediately', () => {
  const backend = createBackend({ data: seed() });
  const token = teacherSession(backend);

  const created = callAction(
    backend,
    'createClass',
    { class_name: 'Thermodynamics', section: 'C', subject: 'Physics', year: '2026', semester: '2', attendance_threshold: 70 },
    token
  );

  assert.equal(created.success, true);
  assert.equal(created.data.class.teacher_id, 'tch_alice');
  assert.equal(created.data.class.attendance_threshold, 70);

  const classes = callAction(backend, 'getClasses', {}, token);
  assert.equal(classes.data.classes.length, 2);

  const rows = backend.spreadsheet.table('Classes').rows;
  assert.equal(rows.length, 3);
  assert.equal(rows[2][6], 'tch_alice');
});

test('a teacher updates only their own class', () => {
  const backend = createBackend({ data: seed() });
  const mine = callAction(
    backend,
    'createClass',
    { class_name: 'Mine', section: 'D' },
    teacherSession(backend)
  );

  const updated = callAction(
    backend,
    'updateClass',
    { class_id: mine.data.class.class_id, class_name: 'Mine Renamed', attendance_threshold: 80 },
    teacherSession(backend)
  );
  assert.equal(updated.success, true);
  assert.equal(updated.data.class.class_name, 'Mine Renamed');
  assert.equal(updated.data.class.attendance_threshold, 80);

  const blocked = callAction(
    backend,
    'updateClass',
    { class_id: OTHER_CLASS_ID, class_name: 'Hijacked' },
    teacherSession(backend)
  );
  assert.equal(blocked.error.code, 'UNAUTHORIZED');
});

test('a teacher imports a roster into their own class', () => {
  const backend = createBackend({ data: seed() });
  const result = callAction(
    backend,
    'importStudents',
    {
      class_id: CLASS_ID,
      rows: [
        { name: 'New Kid', roll_number: '99', prn_number: 'PRN99' },
        { name: '', roll_number: '100' },
      ],
    },
    teacherSession(backend)
  );

  assert.equal(result.success, true);
  assert.equal(result.data.added, 1);
  assert.equal(result.data.rejected.length, 1);
  assert.equal(backend.spreadsheet.table('Students').rows.length, 5);
});

test('a teacher cannot import into a class they do not own', () => {
  const backend = createBackend({ data: seed() });
  const result = callAction(
    backend,
    'importStudents',
    { class_id: OTHER_CLASS_ID, rows: [{ name: 'Intruder', roll_number: '50' }] },
    teacherSession(backend)
  );
  assert.equal(result.error.code, 'UNAUTHORIZED');
  assert.equal(backend.spreadsheet.table('Students').rows.length, 4);
});

test('a teacher cannot name another teacher as the owner of a new class', () => {
  const backend = createBackend({ data: seed() });
  const created = callAction(
    backend,
    'createClass',
    { class_name: 'Sneaky', teacher_id: OTHER_TEACHER_ID },
    teacherSession(backend)
  );
  assert.equal(created.success, true);
  // The owner is forced to the caller — the sheet cannot be written into.
  assert.equal(created.data.class.teacher_id, TEACHER_ID);
});
