/**
 * Apps Script Web App client.
 *
 * The transport is JSON-over-POST: `{action, ...}` in, `{success, data|error}`
 * out. Apps Script always replies HTTP 200, so the envelope is the contract.
 * The session token travels in the body because Apps Script web apps cannot
 * read custom request headers.
 */
import { API_URL } from './env.js';

export class ApiError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details || null;
  }
}

let sessionToken = null;

export function setSessionToken(token) {
  sessionToken = token || null;
}

export function getSessionToken() {
  return sessionToken;
}

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

async function post(action, body = {}) {
  if (!API_URL) {
    throw new ApiError('NOT_CONFIGURED', 'VITE_API_URL is not set.');
  }
  if (isOffline()) {
    throw new ApiError('OFFLINE', 'You are offline. Changes are saved on this device and will sync later.');
  }

  const payload = { ...body, action };
  if (sessionToken) payload.session_token = sessionToken;

  let response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new ApiError('OFFLINE', 'Could not reach the server. You are offline.');
  }

  let envelope;
  try {
    envelope = await response.json();
  } catch (err) {
    throw new ApiError('SERVER_ERROR', 'The server returned an unreadable response.');
  }

  if (!envelope || envelope.success !== true) {
    const error = envelope?.error || {};
    throw new ApiError(error.code || 'SERVER_ERROR', error.message || 'Something went wrong.', error.details);
  }
  return envelope.data;
}

export const api = {
  login: (idToken) => post('login', { id_token: idToken }),
  getCurrentUser: () => post('getCurrentUser'),

  getTodayClasses: (date) => post('getTodayClasses', date ? { date } : {}),
  getClasses: () => post('getClasses'),
  getClassStudents: (classId, includeInactive = false) =>
    post('getClassStudents', { class_id: classId, include_inactive: includeInactive }),
  createClass: (payload) => post('createClass', payload),
  updateClass: (payload) => post('updateClass', payload),
  importStudents: (classId, rows) => post('importStudents', { class_id: classId, rows }),
  submitAttendance: (payload) => post('submitAttendance', payload),
  getAttendanceHistory: (classId, limit) =>
    post('getAttendanceHistory', { class_id: classId, limit }),
  getSessionDetail: (sessionId) => post('getSessionDetail', { session_id: sessionId }),
  updateAttendance: (records, reason) => post('updateAttendance', { records, reason }),

  adminGetTeachers: () => post('adminGetTeachers'),
  adminCreateTeacher: (payload) => post('adminCreateTeacher', payload),
  adminUpdateTeacher: (payload) => post('adminUpdateTeacher', payload),
  adminGetClasses: () => post('adminGetClasses'),
  adminCreateClass: (payload) => post('adminCreateClass', payload),
  adminUpdateClass: (payload) => post('adminUpdateClass', payload),
  adminAssignTeacher: (payload) => post('adminAssignTeacher', payload),
  adminGetStudents: (classId, limit) =>
    post('adminGetStudents', { class_id: classId, limit }),
  adminImportStudents: (classId, rows) =>
    post('adminImportStudents', { class_id: classId, rows }),
  adminDeleteStudent: (studentId) => post('adminDeleteStudent', { student_id: studentId }),
  adminGetAttendance: (filters) => post('adminGetAttendance', filters || {}),
  adminReport: (filters) => post('adminReport', filters || {}),
};

/** Auth failures clear the cached token so the app can re-prompt. */
export function resetSession() {
  sessionToken = null;
}
