import db from '../db/db.js';
import { getStudentsForClass } from '../db/repositories.js';

export async function exportClass(classId) {
  const klass = await db.classes.get(classId);
  if (!klass) throw new Error('Class not found');
  
  const students = await getStudentsForClass(classId, { includeInactive: true });
  
  const exportData = {
    version: 1,
    type: 'attendit-class-export',
    exported_at: new Date().toISOString(),
    class: {
      class_name: klass.class_name,
      section: klass.section,
      year: klass.year,
      semester: klass.semester,
      attendance_threshold: klass.attendance_threshold,
    },
    students: students.map(s => ({
      application_number: s.application_number,
      roll_number: s.roll_number,
      name: s.name,
      email: s.email,
      status: s.status,
    })),
  };
  
  return exportData;
}

export function downloadClassExport(exportData, filename) {
  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseClassExport(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (data.type !== 'attendit-class-export') {
      return { ok: false, error: 'Invalid file format. Expected an AttendIt class export file.' };
    }
    if (!data.class || !data.students) {
      return { ok: false, error: 'Invalid file structure. Missing class or students data.' };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: 'Failed to parse JSON file.' };
  }
}
