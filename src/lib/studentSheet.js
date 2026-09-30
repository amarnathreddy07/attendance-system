const normalize = (v) =>
  String(v || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');

export function matchHeader(header) {
  const h = normalize(header);
  if (/application|admission|app ?no|app ?id|adm ?no/.test(h)) return 'application_number';
  if (/^roll$|roll ?no|roll ?number/.test(h)) return 'roll_number';
  if (/prn|permanent ?register|register ?no/.test(h)) return 'prn_number';
  if (/full ?name|student ?name|name$|student/.test(h)) return 'name';
  if (/email|mail/.test(h)) return 'email';
  if (/status|active|inactive/.test(h)) return 'status';
  return null;
}

export function findHeaderRow(rows, maxScan = 6) {
  for (let i = 0; i < Math.min(rows.length, maxScan); i += 1) {
    const cols = rows[i].map((c) => c.trim()).filter((c) => c !== '');
    if (cols.length === 0) continue;
    const matched = new Set();
    for (const col of cols) {
      const key = matchHeader(col);
      if (key) matched.add(key);
    }
    if (matched.has('name') && (matched.has('application_number') || matched.has('roll_number') || matched.has('prn_number'))) {
      return i;
    }
  }
  return -1;
}

function buildHeaders(rows, headerIndex) {
  const headers = Array.isArray(rows[headerIndex]) ? rows[headerIndex] : [];
  const columns = {};
  headers.forEach((h, idx) => {
    const key = matchHeader(h);
    if (key && !(key in columns)) columns[key] = idx;
  });
  return { headers, columns };
}

export function parseStudentRows(rows, manualColumns = null) {
  const headerIndex = findHeaderRow(rows);
  if (headerIndex === -1) {
    return {
      ok: false,
      error:
        'Could not find a valid header row. Required columns: Student Name and at least one of Application Number, Roll Number, or PRN Number.',
      missingColumns: [],
      students: [],
      summary: { rowsFound: rows.length, valid: 0, duplicates: 0, invalid: 0 },
    };
  }

  const { headers, columns: detectedColumns } = buildHeaders(rows, headerIndex);
  const columns = manualColumns && typeof manualColumns === 'object' ? { ...detectedColumns, ...manualColumns } : detectedColumns;

  if (!('name' in columns)) {
    return {
      ok: false,
      error: 'Missing required column: Student Name.',
      missingColumns: ['name'],
      students: [],
      summary: { rowsFound: rows.length, valid: 0, duplicates: 0, invalid: 0 },
    };
  }

  if (!('application_number' in columns) && !('roll_number' in columns) && !('prn_number' in columns)) {
    return {
      ok: false,
      error: 'Missing identifier column. Need at least one of: Application Number, Roll Number, or PRN Number.',
      missingColumns: [],
      students: [],
      summary: { rowsFound: rows.length, valid: 0, duplicates: 0, invalid: 0 },
    };
  }

  const students = [];
  const valid = [];
  const seenApp = new Map();
  const seenRoll = new Map();
  const seenPrn = new Map();
  const duplicates = [];
  const invalid = [];

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row.some((c) => String(c).trim() !== '')) continue;

    const name = (row[columns.name] ?? '').toString().trim();
    const app = (row[columns.application_number] ?? '').toString().trim();
    const roll = (row[columns.roll_number] ?? '').toString().trim();
    const prn = columns.prn_number != null ? (row[columns.prn_number] ?? '').toString().trim() : '';
    const email = columns.email != null ? (row[columns.email] ?? '').toString().trim() : '';
    const statusRaw = columns.status != null ? (row[columns.status] ?? '').toString().trim() : '';

    let reason = '';
    if (!name) reason = 'Missing student name';

    if (reason) {
      invalid.push({ row: i + 1, reason, app, roll, name });
      continue;
    }

    const finalApp = app || '';
    const finalRoll = roll || '';

    const duplicateKey = finalApp || finalRoll || prn;
    if (duplicateKey && (seenApp.has(finalApp) || seenRoll.has(finalRoll) || (prn && seenPrn.has(prn)))) {
      duplicates.push({ row: i + 1, app: finalApp, roll: finalRoll, name });
      continue;
    }

    const status = /inactive/i.test(statusRaw) ? 'inactive' : 'active';
    const student = { application_number: finalApp, roll_number: finalRoll, prn_number: prn, name, email, status, duplicate: false };
    valid.push(student);
    if (finalApp) seenApp.set(finalApp, student);
    if (finalRoll) seenRoll.set(finalRoll, student);
    if (prn) seenPrn.set(prn, student);
  }

  for (const item of valid) {
    students.push(item);
  }

  return {
    ok: true,
    students,
    headerIndex,
    columns,
    headers,
    summary: {
      rowsFound: rows.filter((row) => row.some((cell) => String(cell ?? '').trim() !== '')).length,
      valid: valid.length,
      duplicates: duplicates.length,
      invalid: invalid.length,
      issues: { duplicates, invalid },
    },
  };
}

export function studentLabel(s) {
  return s.application_number || s.roll_number || s.id;
}
