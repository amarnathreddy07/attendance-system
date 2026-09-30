export const DEFAULT_ATTENDANCE_THRESHOLD = 75;

export function uid(prefix = '') {
  const rnd =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix ? `${prefix}_${rnd}` : rnd;
}

export function nowIso() {
  return new Date().toISOString();
}

export function todayKey() {
  const d = new Date();
  return toDateKey(d);
}

export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatDateShort(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatTime(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatDateLabel(dateKey) {
  if (!dateKey) return '';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(fromDateKey(dateKey));
}

export function clampThreshold(value, fallback = DEFAULT_ATTENDANCE_THRESHOLD) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(100, Math.max(0, num));
}

export function getRiskLevel(value, threshold = DEFAULT_ATTENDANCE_THRESHOLD) {
  const pct = Number(value) || 0;
  if (pct >= threshold) return { label: 'SAFE', tone: 'emerald', icon: '✓' };
  if (pct >= threshold - 5) return { label: 'AT RISK', tone: 'amber', icon: '⚠' };
  return { label: 'CRITICAL', tone: 'rose', icon: '●' };
}

export function getStudentAttendancePercentage(studentId, sessions = [], recordsBySession = {}) {
  const completed = (sessions || []).filter((session) => session && session.status === 'completed');
  if (!completed.length) return null;

  let present = 0;
  for (const session of completed) {
    const entry = recordsBySession?.[session.id]?.find((record) => record.student_id === studentId);
    if (entry?.status === 'present') present += 1;
  }
  return (present / completed.length) * 100;
}

export function getMonthGrid(date = new Date()) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const start = new Date(first);
  start.setDate(start.getDate() - first.getDay());
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return { first, last, cells };
}
