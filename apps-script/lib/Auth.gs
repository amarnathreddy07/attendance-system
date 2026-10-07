/**
 * Authentication and sessions.
 *
 * Flow:
 *  1. The browser signs in with Google Identity Services and gets an ID token.
 *  2. login() verifies that token with Google (audience + expiry + verified
 *     email) — the signature is never checked locally.
 *  3. The email is looked up in the Teachers sheet. That sheet is the only
 *     source of truth for who exists and what role they hold. No domain
 *     whitelist is trusted on its own.
 *  4. The backend issues its own signed session token. The frontend never
 *     carries or trusts a role claim: it displays what this code returns.
 *
 * Session tokens are stateless (HMAC-signed payload + expiry) so no extra
 * sheet and no per-request write is needed. Revoke by rotating SESSION_SECRET.
 */

var TOKENINFO_URL_ = 'https://oauth2.googleapis.com/tokeninfo';

/** Test seam: the harness replaces this to simulate Google's response. */
var HTTP_FETCH_ = function (url) {
  return UrlFetchApp.fetch(url, { muteHttpExceptions: true });
};

function handleLogin_(ctx) {
  var idToken = requireString_(ctx.body.id_token, 'id_token');
  var profile = verifyGoogleIdToken_(idToken);

  var config = getConfig_();
  if (!emailMatchesOrgDomain_(profile.email, config.orgEmailDomain)) {
    throw appError_('UNAUTHORIZED', 'You are not authorized to access this system.');
  }

  var teacher = findTeacherByEmail_(profile.email);
  if (!teacher) {
    throw appError_('UNAUTHORIZED', 'You are not authorized to access this system.');
  }
  if (normalizeBoolean_(teacher.active) !== true) {
    throw appError_('UNAUTHORIZED', 'You are not authorized to access this system.');
  }

  var user = publicUser_(teacher);
  var session = issueSession_(user);
  return { user: user, session_token: session.token, expires_at: session.expires_at };
}

function handleGetCurrentUser_(ctx) {
  var user = requireActiveUser_(resolveUser_(ctx));
  return { user: publicUser_(user) };
}

/**
 * Verifies a Google ID token through Google's tokeninfo endpoint and returns
 * the identity claims. Any mismatch is a hard failure — there is no fallback
 * that trusts the caller.
 */
function verifyGoogleIdToken_(idToken) {
  var response = HTTP_FETCH_(TOKENINFO_URL_ + '?id_token=' + encodeURIComponent(idToken));
  var code = Number(response.getResponseCode());
  if (code < 200 || code >= 300) {
    throw appError_('UNAUTHENTICATED', 'Google sign-in could not be verified. Please try again.');
  }

  var claims;
  try {
    claims = JSON.parse(response.getContentText());
  } catch (err) {
    throw appError_('UNAUTHENTICATED', 'Google sign-in could not be verified. Please try again.');
  }

  var expectedAudience = getConfig_().googleClientId;
  if (expectedAudience && claims.aud !== expectedAudience) {
    throw appError_('UNAUTHENTICATED', 'This sign-in was issued for a different application.');
  }
  if (claims.email_verified !== true && claims.email_verified !== 'true') {
    throw appError_('UNAUTHENTICATED', 'Your Google email address is not verified.');
  }
  if (claims.exp && Number(claims.exp) * 1000 < nowMs_()) {
    throw appError_('UNAUTHENTICATED', 'Your Google session expired. Please sign in again.');
  }
  if (!claims.email) {
    throw appError_('UNAUTHENTICATED', 'Google did not return an email address for this account.');
  }

  return {
    email: normalizeEmail_(claims.email),
    name: String(claims.name || claims.email || '').trim(),
  };
}

function issueSession_(user) {
  var config = getConfig_();
  var ttlHours = config.sessionTtlHours > 0 ? config.sessionTtlHours : DEFAULT_SESSION_TTL_HOURS;
  var issuedAt = nowMs_();
  var payload = {
    tid: normalizeId_(user.teacher_id),
    em: normalizeEmail_(user.email),
    rl: user.role,
    iat: issuedAt,
    exp: issuedAt + ttlHours * 3600000,
    jti: Utilities.getUuid(),
  };
  var token = signToken_(payload);
  return { token: token, expires_at: new Date(payload.exp).toISOString() };
}

function signToken_(payload) {
  var body = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  var signature = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(getSessionSecret_(), body)
  );
  return body + '.' + signature;
}

/** Returns the caller as stored in the Teachers sheet, or null. */
function resolveUser_(ctx) {
  if (!ctx || !ctx.token) return null;
  var payload = verifySessionToken_(ctx.token);
  if (!payload) return null;
  var teacher = findById_(SHEETS.TEACHERS, payload.tid);
  if (!teacher) return null;
  // Re-read role/active on every request: a deactivation takes effect at once.
  var user = publicUser_(teacher);
  if (user.role !== payload.rl) {
    return { teacher_id: user.teacher_id, name: user.name, email: user.email, role: payload.rl, active: user.active };
  }
  return user;
}

function verifySessionToken_(token) {
  var parts = String(token || '').split('.');
  if (parts.length !== 2) return null;

  var expected = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(getSessionSecret_(), parts[0])
  );
  if (expected !== parts[1]) return null;

  var payload;
  try {
    payload = JSON.parse(Utilities.base64DecodeWebSafe(parts[0]));
  } catch (err) {
    return null;
  }
  if (!payload || !payload.exp || Number(payload.exp) < nowMs_()) return null;
  return payload;
}

/** Shape returned to the frontend. `role` comes from the sheet, never input. */
function publicUser_(teacher) {
  return {
    teacher_id: normalizeId_(teacher.teacher_id),
    name: String(teacher.name || '').trim(),
    email: normalizeEmail_(teacher.email),
    role: String(teacher.role || '').trim().toLowerCase() === ROLES.ADMIN ? ROLES.ADMIN : ROLES.TEACHER,
    active: normalizeBoolean_(teacher.active) === true,
  };
}

/** Authenticated + active user, or a thrown UNAUTHENTICATED. */
function requireUser_(ctx) {
  var user = resolveUser_(ctx);
  if (!user) {
    throw appError_('UNAUTHENTICATED', 'Your session has expired. Please sign in again.');
  }
  return requireActiveUser_(user);
}