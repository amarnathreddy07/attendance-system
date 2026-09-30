import { parseStudentRows, findHeaderRow } from '../src/lib/studentSheet.js';
import { parseCsv, studentsToCsv, generateSampleStudents } from '../src/lib/sample.js';

let failures = 0;
function check(name, cond, extra) {
  if (cond) {
    console.log('PASS', name);
  } else {
    failures += 1;
    console.error('FAIL', name, extra || '');
  }
}

// Header detection with skip rows
const rows = [
  ['', ''],
  ['Class Roster', 'Fall 2026'],
  ['Application Number', 'Roll Number', 'Student Name', 'Email', 'Status'],
  ['2026001', 'CS001', 'Amar Nath', 'amar@example.edu', 'Active'],
  ['2026002', 'CS002', 'Priya Sharma', 'priya@example.edu', 'Inactive'],
];
const p = parseStudentRows(rows);
check('header found at row 2', p.ok && p.headerIndex === 2, p.error);
check('2 students parsed', p.students.length === 2, p.students.length);
check('status mapped inactive', p.students[1].status === 'inactive', p.students[1].status);
check('name parsed', p.students[0].name === 'Amar Nath');

// Missing column
const bad = parseStudentRows([['Application Number', 'Roll Number', 'Student Name', 'Status'], ['1', '2', 'x', 'Active']]);
check('missing email still ok', bad.ok === true, bad.error);
const bad2 = parseStudentRows([['Application Number', 'Email', 'Status'], ['1', 'a@b.c', 'Active']]);
check('missing name/roll rejected', bad2.ok === false, bad2.error);
const bad3 = parseStudentRows([['Hello', 'World', 'Foo']]);
check('no header rejected', bad3.ok === false, bad3.error);

// status missing -> active
const noStatus = parseStudentRows([['Application Number', 'Roll Number', 'Student Name'], ['1', 'R1', 'Bob']]);
check('missing status defaults active', noStatus.students[0].status === 'active', noStatus.students[0].status);

// CSV round trip
const csv = studentsToCsv([
  { application_number: '2026001', roll_number: 'CS001', name: 'Amar "A" Nath', email: 'a@b.c', status: 'active' },
]);
const parsedCsv = parseCsv(csv);
check('csv round trip', parsedCsv[1][2] === 'Amar "A" Nath', JSON.stringify(parsedCsv));
const parsedBack = parseStudentRows(parsedCsv);
check('csv reparse', parsedBack.students.length === 1 && parsedBack.students[0].roll_number === 'CS001');

// Sample generation
const sample = generateSampleStudents(24, 12345);
check('24 samples', sample.length === 24, sample.length);
check('unique app numbers', new Set(sample.map((s) => s.application_number)).size === 24);
check('unique roll numbers', new Set(sample.map((s) => s.roll_number)).size === 24);

// CSV import with header row present but with extra leading rows
const withTitle = parseStudentRows([
  ['B.Tech CSE 2nd Year'],
  ['Application Number', 'Roll Number', 'Student Name'],
  ['2026001', 'CS001', 'Bob'],
]);
check('title skip', withTitle.ok && withTitle.students.length === 1);

process.exit(failures ? 1 : 0);
