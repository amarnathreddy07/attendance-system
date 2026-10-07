/**
 * Offline attendance queue.
 *
 * Attendance is marked locally first and always succeeds; the row lands in
 * `sync_queue` with a stable `client_operation_id`. When the network returns,
 * `flushSyncQueue` replays those operations against the backend. The backend
 * treats a repeated client_operation_id as a no-op, so a retry after a
 * response that was lost in transit can never duplicate attendance.
 */
import db from '../db/db.js';
import { api, ApiError } from './apiClient.js';
import { nowIso, todayKey } from './utils.js';

/** Local Dexie rows carry backend ids once cache-down has run. */
async function resolveBackendIds(classId, records) {
  const klass = classId ? await db.classes.get(classId) : null;
  const backendClassId = klass?.backend_class_id || klass?.id || classId;

  const mapped = [];
  for (const record of records || []) {
    const localId = record.student_id || record.studentId;
    const student = await db.students.get(localId);
    mapped.push({
      student_id: student?.backend_student_id || localId,
      status: toServerStatus(record.status),
    });
  }
  return { backendClassId, records: mapped };
}

export const SYNC_STATUS = {
  PENDING: 'pending',
  SYNCED: 'synced',
  FAILED: 'failed',
};

export function newClientOperationId() {
  return `op_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Statuses the backend accepts, in the vocabulary the UI already uses. */
export function toServerStatus(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'present' || value === 'p') return 'P';
  if (value === 'absent' || value === 'a') return 'A';
  if (value === 'od' || value === 'on duty' || value === 'onduty') return 'OD';
  return 'P';
}

/**
 * Enqueues an attendance submission. Returns the queue row so callers can
 * surface "saved locally" without waiting for the network.
 */
export async function enqueueAttendanceSubmit({
  classId,
  sessionId,
  date,
  records,
  clientOperationId = newClientOperationId(),
}) {
  const { backendClassId, records: mapped } = await resolveBackendIds(classId, records);
  const dateKey = date || todayKey();
  // Deterministic session id: retries reuse it, so the backend never sees two
  // sessions for the same class and date.
  const resolvedSessionId = sessionId || `ses_${String(backendClassId).replace(/[^\w]/g, '_')}_${dateKey}`;
  const row = {
    id: clientOperationId,
    class_id: backendClassId,
    session_id: resolvedSessionId,
    date: dateKey,
    records: mapped,
    sync_status: SYNC_STATUS.PENDING,
    attempts: 0,
    last_error: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await db.sync_queue.put(row);
  return row;
}

export async function enqueueAttendanceUpdate({ records, reason, clientOperationId = newClientOperationId() }) {
  const mapped = [];
  for (const record of records || []) {
    const localId = record.student_id || record.studentId;
    const student = await db.students.get(localId);
    const localSessionId = record.session_id || record.sessionId;
    const session = await db.attendance_sessions.get(localSessionId);
    mapped.push({
      session_id: session?.backend_session_id || localSessionId,
      student_id: student?.backend_student_id || localId,
      status: toServerStatus(record.status),
    });
  }
  const row = {
    id: clientOperationId,
    class_id: null,
    session_id: null,
    date: null,
    records: mapped,
    reason: reason || '',
    kind: 'update',
    sync_status: SYNC_STATUS.PENDING,
    attempts: 0,
    last_error: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await db.sync_queue.put(row);
  return row;
}

async function markSynced(row) {
  await db.sync_queue.put({ ...row, sync_status: SYNC_STATUS.SYNCED, last_error: null, updated_at: nowIso() });
}

async function markFailed(row, error) {
  await db.sync_queue.put({
    ...row,
    sync_status: SYNC_STATUS.FAILED,
    attempts: (row.attempts || 0) + 1,
    last_error: error?.message || String(error),
    updated_at: nowIso(),
  });
}

/**
 * Replays queued operations in creation order.
 *
 * @returns {{synced: number, failed: number, remaining: number}}
 */
export async function flushSyncQueue() {
  const pending = await db.sync_queue.where('sync_status').anyOf(SYNC_STATUS.PENDING, SYNC_STATUS.FAILED).sortBy('created_at');

  let synced = 0;
  let failed = 0;

  for (const row of pending) {
    try {
      if (row.kind === 'update') {
        await api.updateAttendance(row.records, row.reason);
      } else {
        await api.submitAttendance({
          class_id: row.class_id,
          session_id: row.session_id,
          date: row.date,
          client_operation_id: row.id,
          records: row.records,
        });
      }
      await markSynced(row);
      synced += 1;
    } catch (error) {
      if (error instanceof ApiError && (error.code === 'OFFLINE' || error.code === 'NOT_CONFIGURED')) {
        break;
      }
      // DUPLICATE means the server already accepted this operation id —
      // treat it as synced so the queue drains.
      if (error instanceof ApiError && error.code === 'DUPLICATE') {
        await markSynced(row);
        synced += 1;
        continue;
      }
      await markFailed(row, error);
      failed += 1;
    }
  }

  const remaining = await db.sync_queue.where('sync_status').anyOf(SYNC_STATUS.PENDING, SYNC_STATUS.FAILED).count();
  return { synced, failed, remaining };
}

export async function pendingCount() {
  return db.sync_queue.where('sync_status').anyOf(SYNC_STATUS.PENDING, SYNC_STATUS.FAILED).count();
}
