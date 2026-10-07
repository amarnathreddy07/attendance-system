/**
 * Request validation — pure functions, no Apps Script globals.
 *
 * Every payload that reaches a sheet passes through here first, so malformed
 * data is rejected with row-level detail instead of corrupting the table.
 */

var MAX_RECORDS_PER_SUBMIT = 400;
var MAX_STUDENTS_PER_IMPORT = 1000;

function requireString_(value, field) {
  var text = String(value == null ? '' : value).trim();
  if (!text) {
    throw appError_('VALIDATION_ERROR', 'Field "' + field + '" is required.');
  }
  if (text.length > 500) {
    throw appError_('VALIDATION_ERROR', 'Field "' + field + '" is too long.');
  }
  return text;
}

function optionalString_(value, maxLength) {
  var text = String(value == null ? '' : value).trim();
  if (text.length > (maxLength || 200)) {
    throw appError_('VALIDATION_ERROR', 'A submitted field is too long.');
  }
  return text;
}

function requireEmail_(value) {
  var email = normalizeEmail_(value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw appError_('VALIDATION_ERROR', 'A valid email address is required.');
  }
  return email;
}

function requireRole_(value) {
  var role = String(value == null ? '' : value).trim().toLowerCase();
  if (role !== ROLES.TEACHER && role !== ROLES.ADMIN) {
    throw appError_('VALIDATION_ERROR', 'Role must be either "teacher" or "admin".');
  }
  return role;
}

function requireIsoDate_(value, field) {
  var text = String(value == null ? '' : value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw appError_('VALIDATION_ERROR', 'Field "' + (field || 'date') + '" must be YYYY-MM-DD.');
  }
  return text;
}

function clampThreshold_(value, fallback) {
  var num = Number(value);
  if (!isFinite(num)) return fallback === undefined ? 75 : fallback;
  return Math.min(100, Math.max(0, Math.round(num)));
}

/**
 * Attendance submission payload.
 *
 * Returns { classId, sessionId, date, records:[{studentId,status}] } or throws
 * with every row-level problem collected, so the UI can show them at once.
 */
function validateAttendancePayload_(payload) {
  var classId = requireString_(payload.class_id, 'class_id');
  var sessionId = requireString_(payload.session_id, 'session_id');
  var date = requireIsoDate_(payload.date, 'date');
  var clientOperationId = requireString_(payload.client_operation_id, 'client_operation_id');

  var rawRecords = payload.records;
  if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
    throw appError_('VALIDATION_ERROR', 'At least one attendance record is required.');
  }
  if (rawRecords.length > MAX_RECORDS_PER_SUBMIT) {
    throw appError_(
      'VALIDATION_ERROR',
      'A single submission is limited to ' + MAX_RECORDS_PER_SUBMIT + ' records. Split the class if needed.'
    );
  }

  var errors = [];
  var seen = {};
  var records = [];

  rawRecords.forEach(function (entry, index) {
    var studentId = String((entry && entry.student_id) || '').trim();
    var status = normalizeStatus_(entry && entry.status);
    if (!studentId) {
      errors.push({ row: index + 1, field: 'student_id', message: 'Missing student id.' });
      return;
    }
    if (!status) {
      errors.push({ row: index + 1, field: 'status', message: 'Status must be P or A.' });
      return;
    }
    if (seen[studentId]) {
      errors.push({ row: index + 1, field: 'student_id', message: 'Duplicate student in this submission.' });
      return;
    }
    seen[studentId] = true;
    records.push({ studentId: studentId, status: status });
  });

  if (errors.length) {
    throw appError_('VALIDATION_ERROR', 'Some attendance rows are invalid.', { rows: errors });
  }

  return {
    classId: classId,
    sessionId: sessionId,
    date: date,
    clientOperationId: clientOperationId,
    records: records,
  };
}

function validateAttendanceUpdates_(payload) {
  var rawRecords = payload.records;
  if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
    throw appError_('VALIDATION_ERROR', 'At least one attendance record is required.');
  }
  var errors = [];
  var records = [];
  rawRecords.forEach(function (entry, index) {
    var sessionId = String((entry && entry.session_id) || '').trim();
    var studentId = String((entry && entry.student_id) || '').trim();
    var status = normalizeStatus_(entry && entry.status);
    if (!sessionId || !studentId || !status) {
      errors.push({
        row: index + 1,
        field: !sessionId ? 'session_id' : !studentId ? 'student_id' : 'status',
        message: 'session_id, student_id and status (P or A) are required.',
      });
      return;
    }
    records.push({ sessionId: sessionId, studentId: studentId, status: status });
  });
  if (errors.length) {
    throw appError_('VALIDATION_ERROR', 'Some attendance rows are invalid.', { rows: errors });
  }
  return { records: records, reason: optionalString_(payload.reason, 300) };
}

/**
 * CSV student import. Mirrors the browser-side parser in src/lib/studentSheet.js
 * but runs server-side, so rows are validated before anything is written.
 * Returns { valid: [...], rejected: [{row, reason}] }.
 */
function validateStudentImport_(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw appError_('VALIDATION_ERROR', 'No student rows were provided.');
  }
  if (rows.length > MAX_STUDENTS_PER_IMPORT) {
    throw appError_('VALIDATION_ERROR', 'Import is limited to ' + MAX_STUDENTS_PER_IMPORT + ' rows at a time.');
  }

  var valid = [];
  var rejected = [];
  var seenApp = {};
  var seenRoll = {};

  rows.forEach(function (raw, index) {
    var rowNumber = index + 1;
    var entry = raw && typeof raw === 'object' ? raw : {};
    var name = String(entry.name || '').trim();
    var applicationNumber = String(entry.application_number || '').trim();
    var rollNumber = String(entry.roll_number || '').trim();
    var prnNumber = String(entry.prn_number || '').trim();

    if (!name) {
      rejected.push({ row: rowNumber, name: name, reason: 'Missing student name.' });
      return;
    }
    if (!applicationNumber && !rollNumber && !prnNumber) {
      rejected.push({
        row: rowNumber,
        name: name,
        reason: 'Missing identifier: provide application_number, roll_number or prn_number.',
      });
      return;
    }
    if (applicationNumber && seenApp[applicationNumber]) {
      rejected.push({ row: rowNumber, name: name, reason: 'Duplicate application number in this file.' });
      return;
    }
    if (rollNumber && seenRoll[rollNumber]) {
      rejected.push({ row: rowNumber, name: name, reason: 'Duplicate roll number in this file.' });
      return;
    }
    if (applicationNumber) seenApp[applicationNumber] = true;
    if (rollNumber) seenRoll[rollNumber] = true;

    var email = String(entry.email || '').trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      rejected.push({ row: rowNumber, name: name, reason: 'Invalid email address.' });
      return;
    }

    valid.push({
      application_number: applicationNumber,
      roll_number: rollNumber,
      prn_number: prnNumber,
      name: name,
      email: email,
      status: /^inactive$/i.test(String(entry.status || '').trim()) ? 'inactive' : 'active',
    });
  });

  return { valid: valid, rejected: rejected };
}

function validateClassPayload_(payload) {
  return {
    className: requireString_(payload.class_name, 'class_name'),
    section: optionalString_(payload.section, 60),
    subject: optionalString_(payload.subject, 120),
    year: optionalString_(payload.year, 20),
    semester: optionalString_(payload.semester, 20),
    teacherId: optionalString_(payload.teacher_id, 60),
    threshold: clampThreshold_(payload.attendance_threshold, 75),
  };
}

function validateTeacherPayload_(payload) {
  return {
    name: requireString_(payload.name, 'name'),
    email: requireEmail_(payload.email),
    role: requireRole_(payload.role),
    active: payload.active === undefined ? true : !!payload.active,
  };
}