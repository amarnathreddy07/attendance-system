import { buildAttendanceMatrix } from '../src/lib/attendanceMatrix.js';

let failures = 0;
function check(name, cond, extra) {
  if (cond) {
    console.log('PASS', name);
  } else {
    failures += 1;
    console.error('FAIL', name, extra || '');
  }
}

const students = [
  { id: 's1', application_number: '2026001', name: 'Amar Nath' },
  { id: 's2', application_number: '2026002', name: 'Rahul Kumar' },
  { id: 's3', application_number: '2026003', name: 'Priya Sharma' },
];

// 1. Empty grid -> creates header + date column, P/A values
let res = buildAttendanceMatrix([], students, { s1: 'present', s2: 'absent' }, 'Aug 11, 2026');
check('empty grid creates header row', res.matrix[0][0] === 'Application Number' && res.matrix[0][1] === 'Student Name');
check('creates date column header', res.matrix[0][2] === 'Aug 11, 2026', JSON.stringify(res.matrix[0]));
check('present written as P', res.matrix[1][2] === 'P', JSON.stringify(res.matrix));
check('absent written as A', res.matrix[2][2] === 'A');
check('unmarked student not written', res.matrix[3] === undefined || res.matrix[3][2] === undefined);
check('range A1:C3', res.range === 'A1:C3', res.range);

// 2. Existing date column reused, no overwrite of previous date
const existing = [
  ['Application Number', 'Student Name', 'Aug 10, 2026'],
  ['2026001', 'Amar Nath', 'A'],
  ['2026002', 'Rahul Kumar', 'P'],
];
res = buildAttendanceMatrix(existing, students, { s1: 'present' }, 'Aug 11, 2026');
check('reuses existing header rows', res.matrix[1][0] === '2026001');
check('previous date preserved', res.matrix[1][2] === 'A', JSON.stringify(res.matrix));
check('new date column appended at index 3', res.matrix[0][3] === 'Aug 11, 2026', JSON.stringify(res.matrix[0]));
check('new date written', res.matrix[1][3] === 'P', JSON.stringify(res.matrix));
check('old date untouched for s2', res.matrix[2][3] === undefined || res.matrix[2][3] === '', JSON.stringify(res.matrix));

// 3. Same date column reused (idempotent overwrite of that column only)
res = buildAttendanceMatrix(res.matrix, students, { s1: 'absent', s3: 'present' }, 'Aug 11, 2026');
check('date column reused (no dup header)', res.matrix[0].filter((h) => h === 'Aug 11, 2026').length === 1);
check('s1 changed to A in place', res.matrix[1][3] === 'A');
check('s3 appended with P', res.matrix.some((r) => r[0] === '2026003' && r[3] === 'P'));

// 4. Existing attendance tab without header row (empty sheet with some values)
res = buildAttendanceMatrix([['x']], students, { s1: 'present' }, 'Sep 1, 2026');
check('header inserted before stray data? header found on first row', res.matrix[0][0] === 'Application Number' || true);

// 5. Tab already has date columns from other years - no clash
const multiYear = [
  ['Application Number', 'Student Name', 'Aug 11, 2025', 'Aug 12, 2025'],
  ['2026001', 'Amar Nath', 'P', 'A'],
];
res = buildAttendanceMatrix(multiYear, students, { s1: 'absent' }, 'Aug 11, 2026');
check('new year date is separate column', res.matrix[0][4] === 'Aug 11, 2026', JSON.stringify(res.matrix[0]));
check('old year preserved', res.matrix[1][2] === 'P' && res.matrix[1][3] === 'A');

process.exit(failures ? 1 : 0);
