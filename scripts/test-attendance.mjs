import { buildAttendanceMatrixCsv, buildSessionAttendanceCsv, toCsv } from '../src/lib/attendanceCsv.js';

let failures = 0;
function check(name, cond, extra) {
  if (cond) {
    console.log('PASS', name);
  } else {
    failures += 1;
    console.error('FAIL', name, extra || '');
  }
}

const klass = { class_name: 'Data Structures' };

const students = [
  { id: 's1', application_number: '2026001', roll_number: '1', name: 'Amar Nath' },
  { id: 's2', application_number: '2026002', roll_number: '2', name: 'Rahul Kumar' },
  { id: 's3', application_number: '2026003', roll_number: '3', name: 'Priya, Sharma' },
];

const sessions = [
  { id: 'ses_2', date: '2026-08-12', status: 'completed' },
  { id: 'ses_1', date: '2026-08-10', status: 'completed' },
  { id: 'ses_3', date: '2026-08-13', status: 'draft' },
];

const recordsBySession = {
  ses_1: [
    { student_id: 's1', status: 'absent' },
    { student_id: 's2', status: 'present' },
  ],
  ses_2: [
    { student_id: 's1', status: 'present' },
    { student_id: 's2', status: 'od' },
    { student_id: 's3', status: 'absent' },
  ],
};

const matrix = buildAttendanceMatrixCsv(klass, students, sessions, recordsBySession);
const rows = matrix.text.split('\n');

check(
  'header uses identity columns plus one column per completed session',
  rows[0] === 'Application Number,Roll Number,Student Name,"Aug 10, 2026","Aug 12, 2026"',
  rows[0]
);
check('draft sessions excluded', !matrix.text.includes('Aug 13, 2026'));
check(
  'sessions sorted by date ascending',
  matrix.sessions.map((s) => s.date).join(',') === '2026-08-10,2026-08-12',
  matrix.sessions.map((s) => s.date).join(',')
);
check('absent written as A, present as P', rows[1] === '2026001,1,Amar Nath,A,P', rows[1]);
check('on duty written as OD', rows[2] === '2026002,2,Rahul Kumar,P,OD', rows[2]);
check('unmarked session leaves a blank cell', rows[3] === '2026003,3,"Priya, Sharma",,A', rows[3]);
check('filename derived from class name', matrix.filename === 'data-structures-attendance.csv', matrix.filename);

const sessionCsv = buildSessionAttendanceCsv(klass, sessions[1], students, {
  s1: { status: 'present' },
  s2: { status: 'absent' },
});
const sessionRows = sessionCsv.text.split('\n');

check('session header', sessionRows[0] === 'Application Number,Roll Number,Student Name,Status', sessionRows[0]);
check('session marks present', sessionRows[1] === '2026001,1,Amar Nath,Present', sessionRows[1]);
check('session marks absent', sessionRows[2] === '2026002,2,Rahul Kumar,Absent', sessionRows[2]);
check('unmarked student reported', sessionRows[3] === '2026003,3,"Priya, Sharma",Not marked', sessionRows[3]);
check('session filename includes date', sessionCsv.filename === 'data-structures-aug-10-2026.csv', sessionCsv.filename);

check('quotes escaped', toCsv([['a"b', 'c,d']]) === '"a""b","c,d"');

process.exit(failures ? 1 : 0);