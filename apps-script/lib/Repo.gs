/**
 * Domain reads and the attendance write path.
 *
 * Every function here takes the authenticated user as its first argument when
 * it touches class data, so authorization cannot be forgotten at the call site.
 */

function dtoTeacher_(teacher) {
  return {
    teacher_id: normalizeId_(teacher.teacher_id),
    name: String(teacher.name || '').trim(),
    email: normalizeEmail_(teacher.email),
    role: String(teacher.role || '').trim().toLowerCase(),
    active: normalizeBoolean_(teacher.active) === true,
  };
}

function dtoClass_(klass, extra) {
  var out = {
    class_id: normalizeId_(klass.class_id),
    class_name: String(klass.class_name || '').trim(),
    section: String(klass.section || '').trim(),
    subject: String(klass.subject || '').trim(),
    year: String(klass.year || '').trim(),
    semester: String(klass.semester || '').trim(),
    teacher_id: normalizeId_(klass.teacher_id),
    attendance_threshold: Number(klass.attendance_threshold) || 75,
    active: klass.active === undefined ? true : normalizeBoolean_(klass.active) !== false,
  };
  if (extra) {
    Object.keys(extra).forEach(function (key) {
      out[key] = extra[key];
    });
  }
  return out;
}

function dtoStudent_(student) {
  return {
    student_id: normalizeId_(student.student_id),
    class_id: normalizeId_(student.class_id),
    application_number: String(student.application_number || '').trim(),
    roll_number: String(student.roll_number || '').trim(),
    prn_number: String(student.prn_number || '').trim(),
    name: String(student.name || '').trim(),
    email: String(student.email || '').trim(),
    status: String(student.status || 'active').trim().toLowerCase() === 'inactive' ? 'inactive' : 'active',
  };
}

function dtoSession_(session) {
  return {
    session_id: normalizeId_(session.session_id),
    class_id: normalizeId_(session.class_id),
    date: String(session.date || '').trim(),
    teacher_id: normalizeId_(session.teacher_id),
    name: String(session.name || '').trim(),
    start_time: String(session.start_time || '').trim(),
    submitted_at: String(session.submitted_at || '').trim(),
    status: String(session.status || '').trim().toLowerCase(),
  };
}

function dtoAttendance_(record) {
  return {
    attendance_id: normalizeId_(record.attendance_id),
    session_id: normalizeId_(record.session_id),
    student_id: normalizeId_(record.student_id),
    class_id: normalizeId_(record.class_id),
    date: String(record.date || '').trim(),
    status: String(record.status || '').trim().toUpperCase(),
    marked_by: normalizeEmail_(record.marked_by),
    updated_at: String(record.updated_at || '').trim(),
  };
}

// ------------------------------------------------------------------ classes

/** Classes the user may see: own classes plus classes assigned to them. */
function listClassesFor_(user) {
  if (isAdmin_(user)) return getTable_(SHEETS.CLASSES).slice();

  var teacherId = normalizeId_(user.teacher_id);
  var assigned = {};
  getTable_(SHEETS.CLASS_TEACHERS).forEach(function (row) {
    if (normalizeId_(row.teacher_id) === teacherId) {
      assigned[normalizeId_(row.class_id)] = true;
    }
  });

  return getTable_(SHEETS.CLASSES).filter(function (klass) {
    var classId = normalizeId_(klass.class_id);
    return normalizeId_(klass.teacher_id) === teacherId || assigned[classId] === true;
  });
}

function listActiveClassesFor_(user) {
  return listClassesFor_(user).filter(function (klass) {
    return klass.active === undefined || normalizeBoolean_(klass.active) !== false;
  });
}

function getClassOr404_(classId) {
  var klass = findById_(SHEETS.CLASSES, classId);
  if (!klass) {
    throw appError_('NOT_FOUND', 'That class does not exist.');
  }
  return klass;
}

function listStudentsForClass_(classId, includeInactive) {
  var target = normalizeId_(classId);
  return getTable_(SHEETS.STUDENTS)
    .filter(function (student) {
      if (normalizeId_(student.class_id) !== target) return false;
      if (includeInactive === false) {
        return String(student.status || 'active').trim().toLowerCase() !== 'inactive';
      }
      return true;
    })
    .sort(compareStudents_);
}

function compareStudents_(a, b) {
  var byApp = String(a.application_number || '').localeCompare(String(b.application_number || ''), undefined, {
    numeric: true,
  });
  if (byApp) return byApp;
  return String(a.roll_number || '').localeCompare(String(b.roll_number || ''), undefined, { numeric: true });
}

// ----------------------------------------------------------------- sessions

function getSessionOr404_(sessionId) {
  var session = findById_(SHEETS.SESSIONS, sessionId);
  if (!session) {
    throw appError_('NOT_FOUND', 'That attendance session does not exist.');
  }
  return session;
}

function listSessionsForClass_(classId, limit) {
  var target = normalizeId_(classId);
  var rows = getTable_(SHEETS.SESSIONS)
    .filter(function (session) {
      return normalizeId_(session.class_id) === target;
    })
    .sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
  return limit ? rows.slice(0, limit) : rows;
}

function listRecordsForSession_(sessionId) {
  var target = normalizeId_(sessionId);
  return getTable_(SHEETS.ATTENDANCE).filter(function (record) {
    return normalizeId_(record.session_id) === target;
  });
}

/** Today's classes for the dashboard: classes + whether attendance exists. */
function listTodayClasses_(user, dateKey) {
  var date = dateKey || todayKey_();
  var sessions = getTable_(SHEETS.SESSIONS);
  var studentsByClass = {};
  getTable_(SHEETS.STUDENTS).forEach(function (student) {
    var classId = normalizeId_(student.class_id);
    if (String(student.status || 'active').toLowerCase() === 'inactive') return;
    studentsByClass[classId] = (studentsByClass[classId] || 0) + 1;
  });

  return listActiveClassesFor_(user)
    .map(function (klass) {
      var classId = normalizeId_(klass.class_id);
      var todaySession = null;
      sessions.forEach(function (session) {
        if (normalizeId_(session.class_id) !== classId) return;
        if (String(session.date || '').trim() !== date) return;
        if (!todaySession) todaySession = session;
      });
      return dtoClass_(klass, {
        student_count: studentsByClass[classId] || 0,
        attendance_taken: !!todaySession,
        session_id: todaySession ? normalizeId_(todaySession.session_id) : '',
        session_status: todaySession ? String(todaySession.status || '').toLowerCase() : '',
      });
    })
    .sort(function (a, b) {
      return String(a.class_name).localeCompare(String(b.class_name));
    });
}

// -------------------------------------------------------------- attendance

/**
 * Idempotent attendance submission.
 *
 * Same client_operation_id replayed  -> no duplicate rows, cached result.
 * Same class + date already submitted under a different operation -> DUPLICATE,
 * which is what stops an accidental double submit from the UI.
 */
function submitAttendance_(user, input) {
  var klass = requireClassAccess_(user, getClassOr404_(input.classId));

  var replay = findByField_(SHEETS.SYNC_LOG, 'client_operation_id', input.clientOperationId);
  if (replay) {
    var previous = findById_(SHEETS.SESSIONS, input.sessionId);
    return {
      session_id: normalizeId_(input.sessionId),
      written: 0,
      updated: 0,
      duplicate: true,
      submitted_at: previous ? String(previous.submitted_at || '') : '',
      class_id: normalizeId_(klass.class_id),
    };
  }

  var studentIds = {};
  listStudentsForClass_(klass.class_id, true).forEach(function (student) {
    studentIds[normalizeId_(student.student_id)] = true;
  });
  var unknown = input.records.filter(function (record) {
    return !studentIds[record.studentId];
  });
  if (unknown.length) {
    throw appError_('VALIDATION_ERROR', 'Some students do not belong to this class.', {
      rows: unknown.map(function (record) {
        return { row: record.studentId, field: 'student_id', message: 'Not a member of this class.' };
      }),
    });
  }

  return withSheetLock_(function () {
    var session = findById_(SHEETS.SESSIONS, input.sessionId);
    var isNewSession = !session;

    if (isNewSession) {
      var sameDay = listSessionsForClass_(klass.class_id, null).filter(function (candidate) {
        return (
          String(candidate.date || '').trim() === input.date &&
          String(candidate.status || '').toLowerCase() === 'submitted'
        );
      });
      if (sameDay.length) {
        throw appError_(
          'DUPLICATE',
          'Attendance for this class has already been submitted for ' + input.date + '.'
        );
      }
    } else {
      requireSessionEditAccess_(user, session, klass);
      if (String(session.date || '').trim() !== input.date) {
        throw appError_('VALIDATION_ERROR', 'The session date cannot be changed on submit.');
      }
    }

    var existing = listRecordsForSession_(input.sessionId);
    var existingByStudent = {};
    existing.forEach(function (record) {
      existingByStudent[normalizeId_(record.student_id)] = record;
    });

    var stamp = nowIso_();
    var updates = [];
    var inserts = [];

    input.records.forEach(function (record) {
      var row = {
        attendance_id: normalizeId_(existingByStudent[record.studentId] && existingByStudent[record.studentId].attendance_id) || newId_('att'),
        session_id: normalizeId_(input.sessionId),
        student_id: record.studentId,
        class_id: normalizeId_(klass.class_id),
        date: input.date,
        status: record.status,
        marked_by: normalizeEmail_(user.email),
        client_operation_id: input.clientOperationId,
        created_at: stamp,
        updated_at: stamp,
      };
      var current = existingByStudent[record.studentId];
      if (current) {
        updates.push({ __row: current.__row, row: row });
      } else {
        inserts.push(row);
      }
    });

    // Two batched writes for the whole class, regardless of roster size.
    appendRows_(SHEETS.ATTENDANCE, inserts);
    updateRowsByIndex_(SHEETS.ATTENDANCE, updates);

    var sessionRow = isNewSession
      ? {
          session_id: normalizeId_(input.sessionId),
          class_id: normalizeId_(klass.class_id),
          date: input.date,
          teacher_id: normalizeId_(user.teacher_id),
          name: 'Session',
          start_time: stamp,
          submitted_at: stamp,
          status: 'submitted',
        }
      : Object.assign({}, session, {
          submitted_at: String(session.submitted_at || stamp),
          status: 'submitted',
        });

    var sessions = isNewSession ? appendRows_(SHEETS.SESSIONS, [sessionRow]) : [updateRowAndReturn_(sessionRow, session)];

    appendRows_(SHEETS.SYNC_LOG, [
      {
        client_operation_id: input.clientOperationId,
        action: 'submitAttendance',
        processed_at: stamp,
        result: input.sessionId,
      },
    ]);

    return {
      session_id: normalizeId_(sessions[0].session_id),
      written: inserts.length,
      updated: updates.length,
      duplicate: false,
      submitted_at: sessionRow.submitted_at,
      class_id: normalizeId_(klass.class_id),
    };
  });
}

function updateRowAndReturn_(row, existing) {
  updateRow_(SHEETS.SESSIONS, { __row: existing.__row, row: row });
  return Object.assign({}, row, { __row: existing.__row });
}

/** Corrections after submission. Batch validated, then batch written. */
function updateAttendance_(user, records) {
  var sessions = indexBy_(getTable_(SHEETS.SESSIONS), 'session_id');
  var classes = indexBy_(getTable_(SHEETS.CLASSES), 'class_id');
  var existingRecords = {};
  getTable_(SHEETS.ATTENDANCE).forEach(function (record) {
    existingRecords[normalizeId_(record.session_id) + '|' + normalizeId_(record.student_id)] = record;
  });

  var errors = [];
  var updates = [];
  records.forEach(function (entry, index) {
    var session = sessions[normalizeId_(entry.sessionId)];
    if (!session) {
      errors.push({ row: index + 1, field: 'session_id', message: 'Session not found.' });
      return;
    }
    var klass = classes[normalizeId_(session.class_id)];
    try {
      requireSessionEditAccess_(user, session, klass);
    } catch (err) {
      errors.push({ row: index + 1, field: 'session_id', message: err.message });
      return;
    }
    var existing = existingRecords[normalizeId_(entry.sessionId) + '|' + normalizeId_(entry.studentId)];
    if (!existing) {
      errors.push({ row: index + 1, field: 'student_id', message: 'No attendance row for this student.' });
      return;
    }
    var stamp = nowIso_();
    updates.push({
      __row: existing.__row,
      row: Object.assign({}, existing, {
        status: entry.status,
        marked_by: normalizeEmail_(user.email),
        updated_at: stamp,
      }),
    });
  });

  if (errors.length) {
    throw appError_('VALIDATION_ERROR', 'Some corrections could not be applied.', { rows: errors });
  }

  return withSheetLock_(function () {
    updateRowsByIndex_(SHEETS.ATTENDANCE, updates);
    return { updated: updates.length };
  });
}