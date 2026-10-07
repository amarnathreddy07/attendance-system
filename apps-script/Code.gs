/**
 * AttendIt backend — HTTP entry points and action routing.
 *
 * Transport: action-based JSON over doGet (read actions) and doPost (all actions).
 * The frontend never names a spreadsheet range: every operation is an explicit,
 * whitelisted action implemented in lib/Handlers.gs.
 */

var API_VERSION = 'v1';

function doGet(e) {
  return handleRequest_(e, 'GET');
}

function doPost(e) {
  return handleRequest_(e, 'POST');
}

function handleRequest_(e, method) {
  var started = Date.now();
  try {
    var body = readBody_(e);
    var action = String(body.action || '').trim();

    if (!action) {
      throw appError_('VALIDATION_ERROR', 'An action is required.');
    }
    if (!isAllowedAction_(action)) {
      throw appError_('NOT_FOUND', 'Unknown action: ' + action);
    }

    var ctx = {
      action: action,
      body: body,
      token: readToken_(e, body),
      method: method,
    };

    var data = route_(action, ctx);
    return jsonResponse_({ success: true, data: data === undefined ? null : data });
  } catch (err) {
    var mapped = toErrorResponse_(err);
    Logger.log(
      '[%s] %s failed after %dms: %s (%s)',
      API_VERSION,
      (e && e.parameter && e.parameter.action) || 'unknown',
      Date.now() - started,
      mapped.error.code,
      mapped.error.message
    );
    // Apps Script always replies 200; the envelope carries the error code.
    return jsonResponse_(mapped);
  }
}

/**
 * Whitelist of every action the backend exposes. Adding an entry here without
 * adding a handler is a no-op; adding a handler without an entry here is
 * unreachable, which is the point: the surface stays explicit.
 */
function isAllowedAction_(action) {
  return Object.prototype.hasOwnProperty.call(ROUTES, action);
}

var ROUTES = {
  // --- auth -------------------------------------------------------------
  login: handleLogin_,
  getCurrentUser: handleGetCurrentUser_,

  // --- teacher / shared -------------------------------------------------
  getTodayClasses: handleGetTodayClasses_,
  getClasses: handleGetClasses_,
  getClassStudents: handleGetClassStudents_,
  createClass: handleCreateClass_,
  updateClass: handleUpdateClass_,
  importStudents: handleImportStudents_,
  submitAttendance: handleSubmitAttendance_,
  getAttendanceHistory: handleGetAttendanceHistory_,
  getSessionDetail: handleGetSessionDetail_,
  updateAttendance: handleUpdateAttendance_,

  // --- admin ------------------------------------------------------------
  adminGetTeachers: handleAdminGetTeachers_,
  adminCreateTeacher: handleAdminCreateTeacher_,
  adminUpdateTeacher: handleAdminUpdateTeacher_,
  adminGetClasses: handleAdminGetClasses_,
  adminCreateClass: handleAdminCreateClass_,
  adminUpdateClass: handleAdminUpdateClass_,
  adminAssignTeacher: handleAdminAssignTeacher_,
  adminGetStudents: handleAdminGetStudents_,
  adminImportStudents: handleAdminImportStudents_,
  adminDeleteStudent: handleAdminDeleteStudent_,
  adminGetAttendance: handleAdminGetAttendance_,
  adminReport: handleAdminReport_,
};

function route_(action, ctx) {
  return ROUTES[action](ctx);
}

function readBody_(e) {
  if (!e) return {};
  if (e.postData && e.postData.type === 'application/json' && e.postData.contents) {
    var parsed = JSON.parse(e.postData.contents);
    if (parsed && typeof parsed === 'object') return parsed;
    throw appError_('VALIDATION_ERROR', 'Request body must be a JSON object.');
  }
  if (e.parameter && e.parameter.action) return e.parameter;
  if (e.postData && e.postData.contents) {
    var form = JSON.parse(e.postData.contents);
    if (form && typeof form === 'object') return form;
  }
  return {};
}

/**
 * Apps Script web apps do not expose custom request headers to doGet/doPost,
 * so the session token travels in the request body (POST) or query string (GET).
 */
function readToken_(e, body) {
  if (body && body.session_token) return String(body.session_token);
  if (e && e.parameter && e.parameter.session_token) return String(e.parameter.session_token);
  return '';
}

/**
 * Apps Script always responds with HTTP 200, so the success flag and the
 * error.code string are the only contract the client can rely on.
 */
function jsonResponse_(payload) {
  var output = ContentService.createTextOutput(JSON.stringify(payload));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}