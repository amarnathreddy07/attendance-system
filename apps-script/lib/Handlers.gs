/**
 * Action handlers. One function per entry in ROUTES (Code.gs).
 *
 * Shared shape: resolve the caller, authorize, validate, do batched work.
 * No handler accepts a role, a teacher_id or a class_id as authority — those
 * are read from the session and from the Teachers sheet.
 */

// ---------------------------------------------------------------- teacher

function handleGetTodayClasses_(ctx) {
  var user = requireUser_(ctx);
  var date = ctx.body.date ? requireIsoDate_(ctx.body.date, 'date') : todayKey_();
  return { date: date, classes: listTodayClasses_(user, date) };
}

function handleGetClasses_(ctx) {
  var user = requireUser_(ctx);
  var classes = listActiveClassesFor_(user).map(function (klass) {
    return dtoClass_(klass, { student_count: listStudentsForClass_(klass.class_id, false).length });
  });
  return { classes: classes };
}

function handleGetClassStudents_(ctx) {
  var user = requireUser_(ctx);
  var klass = requireClassAccess_(user, getClassOr404_(requireString_(ctx.body.class_id, 'class_id')));
  var includeInactive = ctx.body.include_inactive === true && isAdmin_(user);
  return {
    class: dtoClass_(klass),
    students: listStudentsForClass_(klass.class_id, includeInactive).map(dtoStudent_),
  };
}

function handleSubmitAttendance_(ctx) {
  var user = requireUser_(ctx);
  var input = validateAttendancePayload_(ctx.body);
  return submitAttendance_(user, input);
}

function handleGetAttendanceHistory_(ctx) {
  var user = requireUser_(ctx);
  var klass = requireClassAccess_(user, getClassOr404_(requireString_(ctx.body.class_id, 'class_id')));
  var limit = Math.min(Math.max(Number(ctx.body.limit) || 30, 1), 200);

  var sessions = listSessionsForClass_(klass.class_id, limit).map(function (session) {
    var records = listRecordsForSession_(session.session_id);
    var present = records.filter(function (record) {
      return String(record.status || '').toUpperCase() === 'P';
    }).length;
    var absent = records.filter(function (record) {
      return String(record.status || '').toUpperCase() === 'A';
    }).length;
    var onDuty = records.filter(function (record) {
      return String(record.status || '').toUpperCase() === 'OD';
    }).length;
    return Object.assign(dtoSession_(session), {
      marked: records.length,
      present: present,
      absent: absent,
      on_duty: onDuty,
    });
  });

  return { class: dtoClass_(klass), sessions: sessions };
}

function handleGetSessionDetail_(ctx) {
  var user = requireUser_(ctx);
  var session = getSessionOr404_(requireString_(ctx.body.session_id, 'session_id'));
  var klass = requireClassAccess_(user, getClassOr404_(session.class_id));

  var students = listStudentsForClass_(klass.class_id, true);
  var byStudent = {};
  listRecordsForSession_(session.session_id).forEach(function (record) {
    byStudent[normalizeId_(record.student_id)] = dtoAttendance_(record);
  });

  var records = students
    .filter(function (student) {
      return byStudent[normalizeId_(student.student_id)];
    })
    .map(function (student) {
      return Object.assign(dtoStudent_(student), byStudent[normalizeId_(student.student_id)]);
    });

  return {
    session: dtoSession_(session),
    class: dtoClass_(klass),
    records: records,
    can_edit: canEditSession_(user, session, klass),
  };
}

function handleUpdateAttendance_(ctx) {
  var user = requireUser_(ctx);
  var input = validateAttendanceUpdates_(ctx.body);
  return updateAttendance_(user, input.records);
}

// ------------------------------------------------------------------ admin

function handleAdminGetTeachers_(ctx) {
  requireAdmin_(requireUser_(ctx));
  var classes = getTable_(SHEETS.CLASSES);
  var assignments = getTable_(SHEETS.CLASS_TEACHERS);

  var teachers = getTable_(SHEETS.TEACHERS)
    .map(function (teacher) {
      var teacherId = normalizeId_(teacher.teacher_id);
      var classCount = classes.filter(function (klass) {
        return normalizeId_(klass.teacher_id) === teacherId;
      }).length;
      classCount += assignments.filter(function (row) {
        return normalizeId_(row.teacher_id) === teacherId;
      }).length;
      return Object.assign(dtoTeacher_(teacher), { class_count: classCount });
    })
    .sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });

  return { teachers: teachers };
}

function handleAdminCreateTeacher_(ctx) {
  requireAdmin_(requireUser_(ctx));
  var input = validateTeacherPayload_(ctx.body);

  return withSheetLock_(function () {
    if (findTeacherByEmail_(input.email)) {
      throw appError_('DUPLICATE', 'A teacher with that email address already exists.');
    }
    var row = {
      teacher_id: newId_('tch'),
      name: input.name,
      email: input.email,
      role: input.role,
      active: input.active,
      created_at: nowIso_(),
    };
    appendRows_(SHEETS.TEACHERS, [row]);
    return { teacher: dtoTeacher_(row) };
  });
}

function handleAdminUpdateTeacher_(ctx) {
  requireAdmin_(requireUser_(ctx));
  var teacherId = requireString_(ctx.body.teacher_id, 'teacher_id');
  var payload = ctx.body;

  return withSheetLock_(function () {
    var existing = findById_(SHEETS.TEACHERS, teacherId);
    if (!existing) {
      throw appError_('NOT_FOUND', 'That teacher does not exist.');
    }
    var next = Object.assign({}, existing);
    if (payload.name !== undefined) next.name = requireString_(payload.name, 'name');
    if (payload.email !== undefined) {
      next.email = requireEmail_(payload.email);
      var clash = findTeacherByEmail_(next.email);
      if (clash && normalizeId_(clash.teacher_id) !== normalizeId_(teacherId)) {
        throw appError_('DUPLICATE', 'A teacher with that email address already exists.');
      }
    }
    if (payload.role !== undefined) next.role = requireRole_(payload.role);
    if (payload.active !== undefined) next.active = payload.active === true;

    updateRow_(SHEETS.TEACHERS, { __row: existing.__row, row: next });
    return { teacher: dtoTeacher_(next) };
  });
}

function handleAdminGetClasses_(ctx) {
  requireAdmin_(requireUser_(ctx));
  var teachers = indexBy_(getTable_(SHEETS.TEACHERS), 'teacher_id');
  var assignments = {};
  getTable_(SHEETS.CLASS_TEACHERS).forEach(function (row) {
    var classId = normalizeId_(row.class_id);
    assignments[classId] = assignments[classId] || [];
    assignments[classId].push(normalizeId_(row.teacher_id));
  });

  var classes = getTable_(SHEETS.CLASSES)
    .map(function (klass) {
      var classId = normalizeId_(klass.class_id);
      var owner = teachers[normalizeId_(klass.teacher_id)];
      return dtoClass_(klass, {
        student_count: listStudentsForClass_(classId, false).length,
        session_count: listSessionsForClass_(classId, null).length,
        teacher_name: owner ? String(owner.name || '') : '',
        teacher_email: owner ? normalizeEmail_(owner.email) : '',
        assigned_teacher_ids: assignments[classId] || [],
      });
    })
    .sort(function (a, b) {
      return a.class_name.localeCompare(b.class_name);
    });

  return { classes: classes };
}

function handleAdminCreateClass_(ctx) {
  requireAdmin_(requireUser_(ctx));
  return handleCreateClass_(ctx);
}

/** Teachers create classes for themselves; admins may name any owner. */
function handleCreateClass_(ctx) {
  var user = requireUser_(ctx);
  var input = validateClassPayload_(ctx.body);
  var ownerId = isAdmin_(user) ? input.teacherId : normalizeId_(user.teacher_id);

  return withSheetLock_(function () {
    var owner = ownerId ? findById_(SHEETS.TEACHERS, ownerId) : null;
    if (ownerId && !owner) {
      throw appError_('VALIDATION_ERROR', 'The selected teacher does not exist.');
    }
    var stamp = nowIso_();
    var row = {
      class_id: newId_('cls'),
      class_name: input.className,
      section: input.section,
      subject: input.subject,
      year: input.year,
      semester: input.semester,
      teacher_id: owner ? normalizeId_(owner.teacher_id) : '',
      attendance_threshold: input.threshold,
      active: true,
      created_at: stamp,
      updated_at: stamp,
    };
    appendRows_(SHEETS.CLASSES, [row]);
    if (owner) {
      appendRows_(SHEETS.CLASS_TEACHERS, [
        { class_id: row.class_id, teacher_id: normalizeId_(owner.teacher_id), assigned_at: stamp },
      ]);
    }
    return { class: dtoClass_(row) };
  });
}

/** Admins edit any class; teachers may edit classes they own. */
function handleUpdateClass_(ctx) {
  var user = requireUser_(ctx);
  var classId = requireString_(ctx.body.class_id, 'class_id');

  return withSheetLock_(function () {
    var existing = requireClassAccess_(user, getClassOr404_(classId));
    var next = Object.assign({}, existing);
    if (ctx.body.class_name !== undefined) next.class_name = requireString_(ctx.body.class_name, 'class_name');
    if (ctx.body.section !== undefined) next.section = optionalString_(ctx.body.section, 60);
    if (ctx.body.subject !== undefined) next.subject = optionalString_(ctx.body.subject, 120);
    if (ctx.body.year !== undefined) next.year = optionalString_(ctx.body.year, 20);
    if (ctx.body.semester !== undefined) next.semester = optionalString_(ctx.body.semester, 20);
    if (ctx.body.attendance_threshold !== undefined) {
      next.attendance_threshold = clampThreshold_(ctx.body.attendance_threshold, 75);
    }
    if (ctx.body.active !== undefined) next.active = ctx.body.active === true;
    next.updated_at = nowIso_();

    updateRow_(SHEETS.CLASSES, { __row: existing.__row, row: next });
    return { class: dtoClass_(next) };
  });
}

/** Admins import anywhere; teachers may import into classes they own. */
function handleImportStudents_(ctx) {
  var user = requireUser_(ctx);
  var classId = requireString_(ctx.body.class_id, 'class_id');
  var parsed = validateStudentImport_(ctx.body.rows);

  return withSheetLock_(function () {
    var klass = requireClassAccess_(user, getClassOr404_(classId));
    var stamp = nowIso_();
    var existing = listStudentsForClass_(klass.class_id, true);
    var byApp = {};
    var byRoll = {};
    existing.forEach(function (student) {
      if (String(student.application_number || '').trim()) byApp[String(student.application_number).trim()] = student;
      if (String(student.roll_number || '').trim()) byRoll[String(student.roll_number).trim()] = student;
    });

    var inserts = [];
    var updates = [];
    parsed.valid.forEach(function (row) {
      var match = (row.application_number && byApp[row.application_number]) || (row.roll_number && byRoll[row.roll_number]);
      if (match) {
        updates.push({
          __row: match.__row,
          row: Object.assign({}, match, row, { class_id: normalizeId_(classId), updated_at: stamp }),
        });
      } else {
        inserts.push({
          student_id: newId_('stu'),
          class_id: normalizeId_(classId),
          application_number: row.application_number,
          roll_number: row.roll_number,
          prn_number: row.prn_number,
          name: row.name,
          email: row.email,
          status: row.status,
          created_at: stamp,
          updated_at: stamp,
        });
      }
    });

    appendRows_(SHEETS.STUDENTS, inserts);
    updateRowsByIndex_(SHEETS.STUDENTS, updates);

    return {
      added: inserts.length,
      updated: updates.length,
      rejected: parsed.rejected,
    };
  });
}

function handleAdminUpdateClass_(ctx) {
  requireAdmin_(requireUser_(ctx));
  return handleUpdateClass_(ctx);
}

function handleAdminAssignTeacher_(ctx) {
  requireAdmin_(requireUser_(ctx));
  var classId = requireString_(ctx.body.class_id, 'class_id');
  var teacherId = requireString_(ctx.body.teacher_id, 'teacher_id');

  return withSheetLock_(function () {
    var klass = getClassOr404_(classId);
    var teacher = findById_(SHEETS.TEACHERS, teacherId);
    if (!teacher) {
      throw appError_('VALIDATION_ERROR', 'The selected teacher does not exist.');
    }

    var rows = getTable_(SHEETS.CLASS_TEACHERS);
    var existing = rows.filter(function (row) {
      return normalizeId_(row.class_id) === normalizeId_(classId) && normalizeId_(row.teacher_id) === normalizeId_(teacherId);
    })[0];

    if (ctx.body.remove === true) {
      if (existing) updateRow_(SHEETS.CLASS_TEACHERS, { __row: existing.__row, row: { class_id: normalizeId_(classId), teacher_id: normalizeId_(teacherId), assigned_at: existing.assigned_at, __blank: true } });
      var demoted = Object.assign({}, klass, { teacher_id: '' });
      updateRow_(SHEETS.CLASSES, { __row: klass.__row, row: demoted });
      return { assigned: false };
    }

    if (!existing) {
      appendRows_(SHEETS.CLASS_TEACHERS, [
        { class_id: normalizeId_(classId), teacher_id: normalizeId_(teacherId), assigned_at: nowIso_() },
      ]);
    }
    // The first assigned teacher also becomes the primary owner, which is what
    // `listClassesFor_` and the dashboard "today's classes" list rely on.
    if (!normalizeId_(klass.teacher_id)) {
      var promoted = Object.assign({}, klass, { teacher_id: normalizeId_(teacherId), updated_at: nowIso_() });
      updateRow_(SHEETS.CLASSES, { __row: klass.__row, row: promoted });
    }
    return { assigned: true };
  });
}

function handleAdminGetStudents_(ctx) {
  requireAdmin_(requireUser_(ctx));
  var classId = ctx.body.class_id ? String(ctx.body.class_id).trim() : '';
  var students;
  if (classId) {
    getClassOr404_(classId);
    students = listStudentsForClass_(classId, true);
  } else {
    students = getTable_(SHEETS.STUDENTS).slice().sort(compareStudents_);
  }
  var limit = Math.min(Math.max(Number(ctx.body.limit) || 200, 1), 1000);
  return { students: students.slice(0, limit).map(dtoStudent_), total: students.length };
}

function handleAdminImportStudents_(ctx) {
  requireAdmin_(requireUser_(ctx));
  return handleImportStudents_(ctx);
}

function handleAdminDeleteStudent_(ctx) {
  requireAdmin_(requireUser_(ctx));
  var studentId = requireString_(ctx.body.student_id, 'student_id');

  return withSheetLock_(function () {
    var student = findById_(SHEETS.STUDENTS, studentId);
    if (!student) {
      throw appError_('NOT_FOUND', 'That student does not exist.');
    }
    var now = Object.assign({}, student, { status: 'inactive', updated_at: nowIso_() });
    updateRow_(SHEETS.STUDENTS, { __row: student.__row, row: now });
    return { student: dtoStudent_(now) };
  });
}

function handleAdminGetAttendance_(ctx) {
  requireAdmin_(requireUser_(ctx));
  var classId = ctx.body.class_id ? String(ctx.body.class_id).trim() : '';
  var date = ctx.body.date ? requireIsoDate_(ctx.body.date, 'date') : '';
  if (classId) getClassOr404_(classId);

  var sessions = getTable_(SHEETS.SESSIONS)
    .filter(function (session) {
      if (classId && normalizeId_(session.class_id) !== normalizeId_(classId)) return false;
      if (date && String(session.date || '').trim() !== date) return false;
      return true;
    })
    .sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    });

  var recordsBySession = {};
  getTable_(SHEETS.ATTENDANCE).forEach(function (record) {
    var sessionId = normalizeId_(record.session_id);
    recordsBySession[sessionId] = (recordsBySession[sessionId] || 0) + 1;
  });

  var limit = Math.min(Math.max(Number(ctx.body.limit) || 50, 1), 200);
  return {
    sessions: sessions.slice(0, limit).map(function (session) {
      return Object.assign(dtoSession_(session), { marked: recordsBySession[normalizeId_(session.session_id)] || 0 });
    }),
  };
}

/** Basic report: per-class totals plus per-student percentage. */
function handleAdminReport_(ctx) {
  requireAdmin_(requireUser_(ctx));
  var classId = ctx.body.class_id ? String(ctx.body.class_id).trim() : '';
  if (classId) getClassOr404_(classId);

  var classes = getTable_(SHEETS.CLASSES).filter(function (klass) {
    return !classId || normalizeId_(klass.class_id) === normalizeId_(classId);
  });
  var classIds = {};
  classes.forEach(function (klass) {
    classIds[normalizeId_(klass.class_id)] = true;
  });

  var sessionsByClass = {};
  getTable_(SHEETS.SESSIONS).forEach(function (session) {
    var id = normalizeId_(session.class_id);
    if (!classIds[id]) return;
    (sessionsByClass[id] = sessionsByClass[id] || []).push(session);
  });

  var studentsByClass = {};
  getTable_(SHEETS.STUDENTS).forEach(function (student) {
    var id = normalizeId_(student.class_id);
    if (!classIds[id]) return;
    if (String(student.status || 'active').toLowerCase() === 'inactive') return;
    (studentsByClass[id] = studentsByClass[id] || []).push(student);
  });

  var totalsByStudent = {};
  getTable_(SHEETS.ATTENDANCE).forEach(function (record) {
    var id = normalizeId_(record.class_id);
    if (!classIds[id]) return;
    var key = id + '|' + normalizeId_(record.student_id);
    totalsByStudent[key] = totalsByStudent[key] || { present: 0, marked: 0 };
    totalsByStudent[key].marked += 1;
    if (String(record.status || '').toUpperCase() === 'P') totalsByStudent[key].present += 1;
  });

  var report = classes.map(function (klass) {
    var id = normalizeId_(klass.class_id);
    var sessions = sessionsByClass[id] || [];
    var students = (studentsByClass[id] || []).map(function (student) {
      var totals = totalsByStudent[id + '|' + normalizeId_(student.student_id)] || { present: 0, marked: 0 };
      return {
        student_id: normalizeId_(student.student_id),
        name: String(student.name || ''),
        roll_number: String(student.roll_number || ''),
        application_number: String(student.application_number || ''),
        sessions: sessions.length,
        present: totals.present,
        percentage: sessions.length ? Math.round((totals.present / sessions.length) * 1000) / 10 : 0,
      };
    });
    return {
      class: dtoClass_(klass),
      session_count: sessions.length,
      student_count: students.length,
      students: students,
    };
  });

  return { report: report };
}