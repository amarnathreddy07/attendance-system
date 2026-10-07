/**
 * Deployment configuration.
 *
 * Everything sensitive lives in Apps Script Script Properties, never in this
 * repository and never in the frontend:
 *
 *   SPREADSHEET_ID  id of the backing Google Sheet (keep it server-side)
 *   GOOGLE_CLIENT_ID  OAuth client id the frontend is expected to use
 *   SESSION_SECRET   HMAC key for session tokens (generated on first use)
 *   SESSION_TTL_HOURS  session lifetime, default 24
 *   ORG_EMAIL_DOMAIN optional extra restriction, e.g. university.edu
 *
 * Read them with:  Project Settings -> Script Properties.
 */

var SESSION_SECRET_KEY = 'SESSION_SECRET';
var DEFAULT_SESSION_TTL_HOURS = 24;
var CACHE_TTL_SECONDS = 45;
var LOCK_TIMEOUT_MS = 20000;

function scriptProps_() {
  return PropertiesService.getScriptProperties();
}

function getConfig_() {
  var props = scriptProps_();
  return {
    spreadsheetId: String(props.getProperty('SPREADSHEET_ID') || '').trim(),
    googleClientId: String(props.getProperty('GOOGLE_CLIENT_ID') || '').trim(),
    orgEmailDomain: String(props.getProperty('ORG_EMAIL_DOMAIN') || '').trim().toLowerCase(),
    sessionTtlHours: Number(props.getProperty('SESSION_TTL_HOURS') || DEFAULT_SESSION_TTL_HOURS),
  };
}

function requireConfig_(key) {
  var value = getConfig_()[key];
  if (!value) {
    throw appError_(
      'SERVER_ERROR',
      'Backend is not configured: missing script property ' + key + '. See apps-script/SETUP.md.'
    );
  }
  return value;
}

function getSessionSecret_() {
  var props = scriptProps_();
  var secret = props.getProperty(SESSION_SECRET_KEY);
  if (secret) return secret;
  secret = Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid();
  props.setProperty(SESSION_SECRET_KEY, secret);
  return secret;
}

/** Test seam: the harness injects a fixed clock and fetch implementation. */
var NOW_ = function () {
  return new Date();
};

function nowIso_() {
  return NOW_().toISOString();
}

function nowMs_() {
  return NOW_().getTime();
}

function todayKey_(offsetDays) {
  var d = NOW_();
  if (offsetDays) d = new Date(d.getTime() + offsetDays * 86400000);
  return toDateKey_(d);
}

function toDateKey_(date) {
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, '0');
  var d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}