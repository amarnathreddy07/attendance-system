/**
 * Error envelope shared by every action.
 *
 * Codes: UNAUTHENTICATED, UNAUTHORIZED, NOT_FOUND, VALIDATION_ERROR,
 * DUPLICATE, NOT_CONFIGURED, OFFLINE, SYNC_FAILED, SERVER_ERROR.
 */

var ERROR_CODES = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DUPLICATE: 'DUPLICATE',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  OFFLINE: 'OFFLINE',
  SYNC_FAILED: 'SYNC_FAILED',
  SERVER_ERROR: 'SERVER_ERROR',
};

/**
 * Thrown by every layer. `status` is informational only (Apps Script replies
 * 200); the client switches on `code`.
 */
function appError_(code, message, details) {
  var error = new Error(message);
  error.isAppError = true;
  error.code = ERROR_CODES[code] || ERROR_CODES.SERVER_ERROR;
  error.status = statusForCode_(error.code);
  error.details = details || null;
  return error;
}

function statusForCode_(code) {
  switch (code) {
    case ERROR_CODES.UNAUTHENTICATED:
      return 401;
    case ERROR_CODES.UNAUTHORIZED:
      return 403;
    case ERROR_CODES.NOT_FOUND:
      return 404;
    case ERROR_CODES.VALIDATION_ERROR:
      return 400;
    case ERROR_CODES.DUPLICATE:
      return 409;
    default:
      return 500;
  }
}

/** Public-safe message mapping: internal failures never leak stack traces. */
function toErrorResponse_(err) {
  if (err && err.isAppError) {
    return {
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    };
  }
  Logger.log('Unhandled error: %s', err && err.stack ? err.stack : String(err));
  return {
    success: false,
    error: {
      code: ERROR_CODES.SERVER_ERROR,
      message: 'Something went wrong on the server. Please try again.',
      details: null,
    },
  };
}

/** Stable, URL-safe, sortable-ish identifiers. */
function newId_(prefix) {
  return (
    prefix +
    '_' +
    Utilities.getUuid()
      .replace(/-/g, '')
      .slice(0, 18)
      .toLowerCase()
  );
}