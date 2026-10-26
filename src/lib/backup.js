import db from '../db/db.js';

const BACKUP_TABLES = [
  'teachers',
  'classes',
  'students',
  'attendance_sessions',
  'attendance_records',
  'settings',
  'sync_queue',
];

export async function exportBackup() {
  const data = {};
  for (const tableName of BACKUP_TABLES) {
    const table = db.tables.find((candidate) => candidate.name === tableName);
    if (!table) continue;
    data[tableName] = await table.toArray();
  }

  return {
    app: 'attendit',
    version: 1,
    exported_at: new Date().toISOString(),
    data,
  };
}

export function downloadBackup(backup) {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `attendit-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function validateBackup(obj) {
  if (!obj || obj.app !== 'attendit') return 'This file does not look like an AttendIt backup.';
  if (!obj.data || typeof obj.data !== 'object') return 'Backup file is missing its data section.';
  return null;
}

export async function importBackup(obj) {
  const error = validateBackup(obj);
  if (error) throw new Error(error);

  const tables = [
    'teachers',
    'classes',
    'students',
    'attendance_sessions',
    'attendance_records',
    'settings',
    'sync_queue',
  ].filter((tableName) => db.tables.some((table) => table.name === tableName));

  await db.transaction('rw', ...tables.map((tableName) => db.table(tableName)), async () => {
    for (const tableName of tables) {
      const rows = Array.isArray(obj.data[tableName]) ? obj.data[tableName] : [];
      if (rows.length === 0) continue;
      await db.table(tableName).bulkPut(rows);
    }
  });

  return true;
}
