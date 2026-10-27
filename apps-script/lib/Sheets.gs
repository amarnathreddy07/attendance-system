/**
 * Google Sheets data layer.
 *
 * Design rules:
 *  - The sheet id is read from Script Properties, never from the request.
 *  - One range read per table (getDataRange().getValues()), cached briefly in
 *    CacheService so a dashboard load does not re-read every table.
 *  - Writes are batched: N records become one setValues() call, never N calls.
 *  - A LockService lock guards read-modify-write sequences (attendance submit,
 *    CSV import) so two teachers cannot corrupt each other's rows.
 */

var SHEETS = {
  TEACHERS: 'Teachers',
  ADMINS: 'Admins',
  CLASSES: 'Classes',
  CLASS_TEACHERS: 'ClassTeachers',
  STUDENTS: 'Students',
  SESSIONS: 'Sessions',
  ATTENDANCE: 'Attendance',
  SYNC_LOG: 'SyncLog',
};

var SCHEMA = {};
SCHEMA[SHEETS.TEACHERS] = ['teacher_id', 'name', 'email', 'active', 'created_at'];
SCHEMA[SHEETS.ADMINS] = ['admin_id', 'name', 'email', 'active', 'created_at'];
SCHEMA[SHEETS.CLASSES] = [
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
];
SCHEMA[SHEETS.CLASS_TEACHERS] = ['class_id', 'teacher_id', 'assigned_at'];
SCHEMA[SHEETS.STUDENTS] = [
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
];
SCHEMA[SHEETS.SESSIONS] = [
  'session_id',
  'class_id',
  'date',
  'teacher_id',
  'name',
  'start_time',
  'submitted_at',
  'status',
];
SCHEMA[SHEETS.ATTENDANCE] = [
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
];
SCHEMA[SHEETS.SYNC_LOG] = ['client_operation_id', 'action', 'processed_at', 'result'];

var CLASS_ATTENDANCE_HEADER_ROW = 13;
var CLASS_ATTENDANCE_FIRST_DATA_ROW = CLASS_ATTENDANCE_HEADER_ROW + 1;
var CLASS_ATTENDANCE_HEADERS = [
  'session_id',
  'date',
  'student_id',
  'roll_number',
  'prn_number',
  'application_number',
  'student_name',
  'status',
  'marked_by',
  'created_at',
  'updated_at',
];

function getSpreadsheet_() {
  var id = requireConfig_('spreadsheetId');
  return SpreadsheetApp.openById(id);
}

function classAttendanceSheetName_(classId) {
  return 'Class_' + String(classId || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 90);
}

function classAttendanceThreshold_(klass) {
  var threshold = Number(klass.attendance_threshold);
  return isFinite(threshold) ? threshold : 75;
}

function hasClassAttendanceSheet_(klass) {
  var sheet = getSpreadsheet_().getSheetByName(classAttendanceSheetName_(klass.class_id));
  if (!sheet) return false;
  return String(sheet.getRange(2, 2, 1, 1).getValues()[0][0] || '').trim() === normalizeId_(klass.class_id);
}

function ensureClassAttendanceSheets_(classes) {
  (classes || []).forEach(function (klass) {
    if (hasClassAttendanceSheet_(klass)) return;
    withSheetLock_(function () {
      if (!hasClassAttendanceSheet_(klass)) syncClassAttendanceSheet_(klass);
    });
  });
}

/**
 * Creates one class-owned worksheet in the configured spreadsheet. Shared
 * tables remain canonical; this tab is a readable, class-specific attendance
 * ledger and can be rebuilt from those tables if needed.
 */
function ensureClassAttendanceSheet_(klass) {
  var classId = normalizeId_(klass.class_id);
  if (!classId) throw appError_('SERVER_ERROR', 'Cannot create an attendance sheet without a class ID.');

  var name = classAttendanceSheetName_(classId);
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  var existingClassId = String(sheet.getRange(2, 2, 1, 1).getValues()[0][0] || '').trim();
  if (existingClassId && existingClassId !== classId) {
    throw appError_('SERVER_ERROR', 'The class attendance sheet name conflicts with another class.');
  }

  if (!existingClassId) {
    if (sheet.getLastRow() > 0) {
      throw appError_('SERVER_ERROR', 'A non-class worksheet already uses the name "' + name + '".');
    }
    sheet.getRange(1, 1, 1, 2).setValues([['AttendIt Class Attendance', '']]);
    sheet.getRange(2, 1, 10, 2).setValues([
      ['Class ID', classId],
      ['Class Name', String(klass.class_name || '')],
      ['Section', String(klass.section || '')],
      ['Subject', String(klass.subject || '')],
      ['Year', String(klass.year || '')],
      ['Semester', String(klass.semester || '')],
      ['Teacher ID', normalizeId_(klass.teacher_id)],
      ['Attendance Threshold (%)', classAttendanceThreshold_(klass)],
      ['Created At', String(klass.created_at || '')],
      ['Updated At', String(klass.updated_at || '')],
    ]);
    sheet.getRange(CLASS_ATTENDANCE_HEADER_ROW, 1, 1, CLASS_ATTENDANCE_HEADERS.length)
      .setValues([CLASS_ATTENDANCE_HEADERS]);
    sheet.setFrozenRows(CLASS_ATTENDANCE_HEADER_ROW);
  } else {
    var headers = sheet.getRange(CLASS_ATTENDANCE_HEADER_ROW, 1, 1, CLASS_ATTENDANCE_HEADERS.length).getValues()[0];
    if (!CLASS_ATTENDANCE_HEADERS.every(function (header, index) { return headers[index] === header; })) {
      throw appError_('SERVER_ERROR', 'The class attendance worksheet has an invalid header row.');
    }
    sheet.getRange(3, 2, 9, 1).setValues([
      [String(klass.class_name || '')],
      [String(klass.section || '')],
      [String(klass.subject || '')],
      [String(klass.year || '')],
      [String(klass.semester || '')],
      [normalizeId_(klass.teacher_id)],
      [classAttendanceThreshold_(klass)],
      [String(klass.created_at || '')],
      [String(klass.updated_at || '')],
    ]);
  }
  return sheet;
}

function updateClassAttendanceRows_(sheet, entries) {
  if (!entries.length) return;
  var ordered = entries.slice().sort(function (a, b) {
    return a.row - b.row;
  });
  var startRow = ordered[0].row;
  var run = [ordered[0]];

  for (var i = 1; i <= ordered.length; i += 1) {
    var contiguous = i < ordered.length && ordered[i].row === run[run.length - 1].row + 1;
    if (contiguous) {
      run.push(ordered[i]);
      continue;
    }
    sheet.getRange(startRow, 1, run.length, CLASS_ATTENDANCE_HEADERS.length)
      .setValues(run.map(function (entry) { return entry.values; }));
    if (i < ordered.length) {
      startRow = ordered[i].row;
      run = [ordered[i]];
    }
  }
}

/** Reconciles the class ledger against canonical Students and Attendance rows. */
function syncClassAttendanceSheet_(klass) {
  var sheet = ensureClassAttendanceSheet_(klass);
  var classId = normalizeId_(klass.class_id);
  var studentsById = indexBy_(listStudentsForClass_(classId, true), 'student_id');
  var records = getTable_(SHEETS.ATTENDANCE).filter(function (record) {
    return normalizeId_(record.class_id) === classId;
  });
  var lastRow = sheet.getLastRow();
  var existingRows = lastRow >= CLASS_ATTENDANCE_FIRST_DATA_ROW
    ? sheet.getRange(
        CLASS_ATTENDANCE_FIRST_DATA_ROW,
        1,
        lastRow - CLASS_ATTENDANCE_HEADER_ROW,
        CLASS_ATTENDANCE_HEADERS.length
      ).getValues()
    : [];
  var rowByAttendance = {};
  existingRows.forEach(function (row, index) {
    var key = String(row[0] || '').trim() + '|' + String(row[2] || '').trim();
    if (key !== '|') rowByAttendance[key] = CLASS_ATTENDANCE_FIRST_DATA_ROW + index;
  });

  var inserts = [];
  var updates = [];
  records.forEach(function (record) {
    var student = studentsById[normalizeId_(record.student_id)] || {};
    var values = [
      normalizeId_(record.session_id),
      String(record.date || ''),
      normalizeId_(record.student_id),
      String(student.roll_number || ''),
      String(student.prn_number || ''),
      String(student.application_number || ''),
      String(student.name || ''),
      String(record.status || ''),
      String(record.marked_by || ''),
      String(record.created_at || ''),
      String(record.updated_at || ''),
    ];
    var key = values[0] + '|' + values[2];
    if (rowByAttendance[key]) {
      updates.push({ row: rowByAttendance[key], values: values });
    } else {
      inserts.push(values);
    }
  });

  updateClassAttendanceRows_(sheet, updates);
  if (inserts.length) {
    var startRow = Math.max(sheet.getLastRow() + 1, CLASS_ATTENDANCE_FIRST_DATA_ROW);
    sheet.getRange(startRow, 1, inserts.length, CLASS_ATTENDANCE_HEADERS.length).setValues(inserts);
  }
}

function cacheKey_(name) {
  return 'attendit.tbl.' + name;
}

function getTable_(name) {
  var cached = CacheService.getScriptCache().get(cacheKey_(name));
  if (cached) return JSON.parse(cached);

  var sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) {
    throw appError_(
      'SERVER_ERROR',
      'Sheet "' + name + '" is missing. Run the setup steps in apps-script/SETUP.md.'
    );
  }

  var values = sheet.getDataRange().getValues();
  var headers = (values && values.length ? values[0] : []).map(headerToKey_);
  var rows = [];
  for (var i = 1; i < values.length; i += 1) {
    var raw = values[i];
    if (!raw || raw.join('') === '') continue;
    var row = {};
    for (var c = 0; c < headers.length; c += 1) {
      row[headers[c]] = raw[c] === undefined ? '' : raw[c];
    }
    row.__row = i + 1;
    rows.push(row);
  }

  CacheService.getScriptCache().put(cacheKey_(name), JSON.stringify(rows), CACHE_TTL_SECONDS);
  return rows;
}

function headerToKey_(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function invalidateTables_(names) {
  var cache = CacheService.getScriptCache();
  (names || Object.keys(SCHEMA)).forEach(function (name) {
    cache.remove(cacheKey_(name));
  });
}

function withSheetLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_TIMEOUT_MS)) {
    throw appError_('SERVER_ERROR', 'The sheet is busy. Please retry in a moment.');
  }
  try {
    var result = fn();
    invalidateTables_(null);
    return result;
  } finally {
    lock.releaseLock();
  }
}

function toColumnRow_(name, row) {
  return SCHEMA[name].map(function (key) {
    var value = row[key];
    if (value === undefined || value === null) return '';
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    return value;
  });
}

function nextEmptyRow_(sheet) {
  return Math.max(sheet.getLastRow() + 1, 2);
}

/** Appends N rows with a single setValues() call. */
function appendRows_(name, rows) {
  if (!rows || !rows.length) return [];
  var sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw appError_('SERVER_ERROR', 'Sheet "' + name + '" is missing.');

  var payload = rows.map(function (row) {
    return toColumnRow_(name, row);
  });
  var startRow = nextEmptyRow_(sheet);
  var columns = SCHEMA[name].length;
  sheet.getRange(startRow, 1, payload.length, columns).setValues(payload);
  return rows.map(function (row, index) {
    return Object.assign({}, row, { __row: startRow + index });
  });
}

/**
 * Overwrites specific physical rows in one batched call. Entries are
 * { __row: physicalRowNumber, row: object } and must be contiguous for the
 * single-range write; non-contiguous rows fall back to one write per range.
 */
function updateRowsByIndex_(name, entries) {
  if (!entries || !entries.length) return;
  var sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw appError_('SERVER_ERROR', 'Sheet "' + name + '" is missing.');

  var ordered = entries
    .slice()
    .sort(function (a, b) {
      return a.__row - b.__row;
    });

  var columns = SCHEMA[name].length;
  var runStart = ordered[0].__row;
  var run = [ordered[0]];

  for (var i = 1; i <= ordered.length; i += 1) {
    var previous = run[run.length - 1].__row;
    var isContiguous = i < ordered.length && ordered[i].__row === previous + 1;
    if (isContiguous) {
      run.push(ordered[i]);
      continue;
    }
    sheet
      .getRange(runStart, 1, run.length, columns)
      .setValues(
        run.map(function (entry) {
          return toColumnRow_(name, entry.row);
        })
      );
    if (i < ordered.length) {
      run = [ordered[i]];
      runStart = ordered[i].__row;
    }
  }
}

function updateRow_(name, indexedRow) {
  updateRowsByIndex_(name, [indexedRow]);
}

function indexBy_(rows, key) {
  var map = {};
  (rows || []).forEach(function (row) {
    var value = normalizeId_(row[key]);
    if (value) map[value] = row;
  });
  return map;
}

function findById_(name, id) {
  var rows = getTable_(name);
  var target = normalizeId_(id);
  for (var i = 0; i < rows.length; i += 1) {
    if (normalizeId_(rows[i][primaryKey_(name)]) === target) return rows[i];
  }
  return null;
}

function primaryKey_(name) {
  return SCHEMA[name][0];
}

function findByField_(name, field, value) {
  var rows = getTable_(name);
  var target = String(value == null ? '' : value).trim();
  for (var i = 0; i < rows.length; i += 1) {
    if (String(rows[i][field] == null ? '' : rows[i][field]).trim() === target) return rows[i];
  }
  return null;
}

/** Returns a canonical principal record regardless of its backing tab. */
function findPrincipalByEmail_(email) {
  var target = normalizeEmail_(email);
  if (!target) return null;
  var teachers = getTable_(SHEETS.TEACHERS);
  for (var i = 0; i < teachers.length; i += 1) {
    if (normalizeEmail_(teachers[i].email) === target) {
      return Object.assign({}, teachers[i], { role: ROLES.TEACHER });
    }
  }
  var admins = getTable_(SHEETS.ADMINS);
  for (var j = 0; j < admins.length; j += 1) {
    if (normalizeEmail_(admins[j].email) === target) {
      return Object.assign({}, admins[j], {
        teacher_id: normalizeId_(admins[j].admin_id),
        role: ROLES.ADMIN,
      });
    }
  }
  return null;
}

function findPrincipalById_(id, role) {
  if (role === ROLES.ADMIN) {
    var admin = findById_(SHEETS.ADMINS, id);
    return admin
      ? Object.assign({}, admin, { teacher_id: normalizeId_(admin.admin_id), role: ROLES.ADMIN })
      : null;
  }
  if (role === ROLES.TEACHER) {
    var teacher = findById_(SHEETS.TEACHERS, id);
    return teacher ? Object.assign({}, teacher, { role: ROLES.TEACHER }) : null;
  }
  return null;
}

function allocatePersonId_(role) {
  var isAdmin = role === ROLES.ADMIN;
  var propertyKey = isAdmin ? 'NEXT_ADMIN_ID' : 'NEXT_TEACHER_ID';
  var prefix = isAdmin ? 'ADM-' : 'TCH-';
  var tab = isAdmin ? SHEETS.ADMINS : SHEETS.TEACHERS;
  var idKey = isAdmin ? 'admin_id' : 'teacher_id';
  var rows = getTable_(tab);
  var next = Number(scriptProps_().getProperty(propertyKey)) || 1;
  var pattern = new RegExp('^' + prefix + '(\\d+)$');
  rows.forEach(function (row) {
    var match = String(row[idKey] || '').match(pattern);
    if (match) next = Math.max(next, Number(match[1]) + 1);
  });

  var id = prefix + String(next).padStart(4, '0');
  scriptProps_().setProperty(propertyKey, String(next + 1));
  return id;
}

function appendAndRead_(name, rows) {
  return withSheetLock_(function () {
    return appendRows_(name, rows);
  });
}

function writeSheetMatrix_(sheet, matrix) {
  sheet.clearContents();
  if (matrix.length) {
    sheet.getRange(1, 1, matrix.length, matrix[0].length).setValues(matrix);
  }
}

function migrateLegacyPeople_() {
  var ss = getSpreadsheet_();
  var teachersSheet = ss.getSheetByName(SHEETS.TEACHERS);
  if (!teachersSheet || teachersSheet.getLastRow() < 1) return false;

  var legacyValues = teachersSheet.getDataRange().getValues();
  var headers = (legacyValues[0] || []).map(headerToKey_);
  if (headers.indexOf('role') < 0) return false;

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_TIMEOUT_MS)) {
    throw appError_('SERVER_ERROR', 'The sheet is busy. Please retry in a moment.');
  }

  try {
    var adminsSheet = ss.getSheetByName(SHEETS.ADMINS) || ss.insertSheet(SHEETS.ADMINS);
    var adminHeaders = SCHEMA[SHEETS.ADMINS];
    var adminValues = adminsSheet.getDataRange().getValues();
    if (adminsSheet.getLastRow() < 1) {
      adminValues = [adminHeaders];
      adminsSheet.getRange(1, 1, 1, adminHeaders.length).setValues([adminHeaders]);
    } else if (
      !adminHeaders.every(function (header, index) {
        return headerToKey_(adminValues[0][index]) === header;
      })
    ) {
      throw appError_(
        'SERVER_ERROR',
        'The Admins sheet has an unexpected header. Back it up and align its columns before migrating.'
      );
    }

    var targetAdminByEmail = {};
    for (var a = 1; a < adminValues.length; a += 1) {
      var existingEmail = normalizeEmail_(adminValues[a][2]);
      if (existingEmail) targetAdminByEmail[existingEmail] = normalizeId_(adminValues[a][0]);
    }

    var properties = scriptProps_();
    var storedMap = properties.getProperty('PEOPLE_ID_MIGRATION_MAP');
    var idMap = storedMap ? JSON.parse(storedMap) : {};
    var teacherIdMap = {};
    var legacyAdminIds = {};
    var seenLegacyEmails = {};
    var migratedTeachers = [];
    var migratedAdmins = adminValues.slice(1);

    for (var r = 1; r < legacyValues.length; r += 1) {
      var raw = legacyValues[r];
      if (!raw || raw.join('') === '') continue;
      var person = {};
      headers.forEach(function (key, index) {
        person[key] = raw[index] === undefined ? '' : raw[index];
      });
      var oldId = normalizeId_(person.teacher_id);
      var role = String(person.role || '').trim().toLowerCase();
      if (!oldId || (role !== ROLES.TEACHER && role !== ROLES.ADMIN)) {
        throw appError_('SERVER_ERROR', 'The legacy Teachers sheet contains a row with a missing ID or invalid role.');
      }

      var email = normalizeEmail_(person.email);
      if (email && seenLegacyEmails[email]) {
        throw appError_('SERVER_ERROR', 'The legacy Teachers sheet has duplicate email addresses. Resolve duplicates before migrating.');
      }
      if (email) seenLegacyEmails[email] = true;
      if (role === ROLES.TEACHER && email && targetAdminByEmail[email]) {
        throw appError_('SERVER_ERROR', 'An email address exists in both people tabs. Resolve the duplicate before migrating.');
      }
      var newId = idMap[oldId];
      if (!newId) {
        newId = role === ROLES.ADMIN ? targetAdminByEmail[email] : '';
        if (!newId) newId = allocatePersonId_(role);
        idMap[oldId] = newId;
      }
      if (role === ROLES.ADMIN) legacyAdminIds[oldId] = true;
      else teacherIdMap[oldId] = newId;

      var active = normalizeBoolean_(person.active);
      var migratedRow =
        role === ROLES.ADMIN
          ? [newId, person.name || '', email, active ? 'TRUE' : 'FALSE', person.created_at || '']
          : [newId, person.name || '', email, active ? 'TRUE' : 'FALSE', person.created_at || ''];

      if (role === ROLES.ADMIN) {
        if (!email || !targetAdminByEmail[email]) {
          migratedAdmins.push(migratedRow);
          if (email) targetAdminByEmail[email] = newId;
        }
      } else {
        migratedTeachers.push(migratedRow);
      }
    }

    properties.setProperty('PEOPLE_ID_MIGRATION_MAP', JSON.stringify(idMap));
    [SHEETS.CLASSES, SHEETS.CLASS_TEACHERS, SHEETS.SESSIONS].forEach(function (name) {
      var sheet = ss.getSheetByName(name);
      if (!sheet) return;
      var values = sheet.getDataRange().getValues();
      var keys = (values[0] || []).map(headerToKey_);
      var column = keys.indexOf('teacher_id');
      if (column < 0) return;
      for (var row = 1; row < values.length; row += 1) {
        var existingId = normalizeId_(values[row][column]);
        if (legacyAdminIds[existingId]) {
          throw appError_(
            'SERVER_ERROR',
            'A legacy admin is assigned to a class or session. Reassign those records to a teacher before running the people-sheet migration.'
          );
        }
        if (teacherIdMap[existingId]) values[row][column] = teacherIdMap[existingId];
      }
      if (values.length > 1) {
        sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
      }
    });

    writeSheetMatrix_(adminsSheet, [adminHeaders].concat(migratedAdmins));
    writeSheetMatrix_(teachersSheet, [SCHEMA[SHEETS.TEACHERS]].concat(migratedTeachers));
    adminsSheet.setFrozenRows(1);
    teachersSheet.setFrozenRows(1);
    properties.deleteProperty('PEOPLE_ID_MIGRATION_MAP');
    invalidateTables_(null);
    return true;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Creates any missing tabs (with their headers) so the first sync can write
 * attendance even before an operator runs the setup migration. Unlike
 * ensureSchema_ this never rewrites an existing tab's header row, so it is
 * safe to run automatically on every request (guarded by a short cache).
 */
function ensureMissingSheets_() {
  var cache = CacheService.getScriptCache();
  if (cache.get('attendit.schema.ready') === '1') return;
  var ss = getSpreadsheet_();
  Object.keys(SCHEMA).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() < 1) {
      var headers = SCHEMA[name];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  });
  cache.put('attendit.schema.ready', '1', 300);
  invalidateTables_(null);
}

/** Creates the spreadsheet tabs with headers if they do not exist yet. */
function ensureSchema_() {
  migrateLegacyPeople_();
  var ss = getSpreadsheet_();
  Object.keys(SCHEMA).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    var expected = SCHEMA[name];
    var current = sheet.getRange(1, 1, 1, expected.length).getValues()[0] || [];
    var matches =
      current.length === expected.length &&
      expected.every(function (key, index) {
        return headerToKey_(current[index]) === key;
      });
    if (!matches) {
      sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    }
    sheet.setFrozenRows(1);
  });
  invalidateTables_(null);
  return Object.keys(SCHEMA);
}

function ping_() {
  var names = ensureSchema_();
  return { ok: true, spreadsheetId: requireConfig_('spreadsheetId'), sheets: names };
}

function runPeopleSheetMigration() {
  return ping_();
}