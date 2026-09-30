import db from '../db/db.js';

export async function exportBackup() {
  const backup = {
    app: 'attendit',
    version: 1,
    exported_at: new Date().toISOString(),
    data: {
      teachers: await db.teachers.toArray(),
      classes: await db.classes.toArray(),
      students: await db.students.toArray(),
      attendance_sessions: await db.attendance_sessions.toArray(),
      attendance_records: await db.attendance_records.toArray(),
      settings: await db.settings.toArray(),
    },
  };
  return backup;
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
  ];

  await db.transaction('rw', ...tables.map((t) => db.table(t)), async () => {
    for (const t of tables) {
      const rows = Array.isArray(obj.data[t]) ? obj.data[t] : [];
      if (rows.length === 0) continue;
      await db.table(t).bulkPut(rows);
    }
  });

  return true;
}
