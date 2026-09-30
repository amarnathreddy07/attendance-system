function csvEscape(value) {
  const str = value == null ? '' : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsv(rows) {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\n');
}

export function downloadCsv(filename, text) {
  const blob = new Blob([`\uFEFF${text}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dateLabel(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(y, m - 1, d)
  );
}

function sanitize(name) {
  return String(name || 'class')
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/**
 * Attendance matrix CSV for a class: one row per student, one column per
 * completed session date, cells P/A (blank when not marked). Ready to paste
 * into Google Sheets.
 */
export function buildAttendanceMatrixCsv(klass, students, sessions, recordsBySession) {
  const completed = (sessions || [])
    .filter((s) => s.status === 'completed')
    .sort((a, b) => a.date.localeCompare(b.date));

  const header = ['Application Number', 'Roll Number', 'Student Name', ...completed.map((s) => dateLabel(s.date))];
  const rows = [header];

  for (const student of students) {
    const row = [student.application_number, student.roll_number, student.name];
    for (const session of completed) {
      const records = recordsBySession?.[session.id];
      const record = records ? records.find((r) => r.student_id === student.id) : undefined;
      row.push(record ? (record.status === 'present' ? 'P' : record.status === 'od' ? 'OD' : 'A') : '');
    }
    rows.push(row);
  }

  return { text: toCsv(rows), sessions: completed, filename: `${sanitize(klass.class_name)}-attendance.csv` };
}

/** Flat CSV for a single session: Application Number, Roll Number, Name, Status. */
export function buildSessionAttendanceCsv(klass, session, students, recordMap) {
  const header = ['Application Number', 'Roll Number', 'Student Name', 'Status'];
  const rows = [header];
  for (const student of students) {
    const status = recordMap?.[student.id]?.status;
    rows.push([
      student.application_number,
      student.roll_number,
      student.name,
      status === 'present' ? 'Present' : status === 'od' ? 'OD' : status === 'absent' ? 'Absent' : 'Not marked',
    ]);
  }
  const stamp = sanitize(dateLabel(session.date).replace(/,/g, ''));
  return {
    text: toCsv(rows),
    filename: `${sanitize(klass.class_name)}-${stamp}.csv`,
  };
}
