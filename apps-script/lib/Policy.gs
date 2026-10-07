/**
 * Authorization policy — pure functions, no Apps Script globals.
 *
 * The frontend is untrusted: it never sends a role, and it never gets to say
 * which teacher owns a class. Every protected handler resolves the caller from
 * its session token, then asks these functions for a decision.
 */

var ROLES = {
  TEACHER: 'teacher',
  ADMIN: 'admin',
};

function isAdmin_(user) {
  return !!user && user.role === ROLES.ADMIN && user.active === true;
}

function isTeacher_(user) {
  return !!user && user.role === ROLES.TEACHER && user.active === true;
}

/** Case-insensitive; empty means "no identity yet". */
function normalizeEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function requireActiveUser_(user) {
  if (!user) {
    throw appError_('UNAUTHENTICATED', 'Sign in with your Google account to continue.');
  }
  if (user.active !== true) {
    throw appError_('UNAUTHORIZED', 'Your account is not authorized to access this system.');
  }
  return user;
}

function requireAdmin_(user) {
  requireActiveUser_(user);
  if (!isAdmin_(user)) {
    throw appError_('UNAUTHORIZED', 'Administrator access is required for this action.');
  }
  return user;
}

/**
 * Admins reach everything. Teachers reach only classes they are assigned to,
 * matched on the teacher_id the backend itself read from the Teachers sheet.
 */
function canAccessClass_(user, klass) {
  if (requireActiveUser_(user) && isAdmin_(user)) return true;
  if (!klass) return false;
  return normalizeId_(user.teacher_id) === normalizeId_(klass.teacher_id);
}

function requireClassAccess_(user, klass) {
  requireActiveUser_(user);
  if (!klass) {
    throw appError_('NOT_FOUND', 'That class no longer exists.');
  }
  if (!canAccessClass_(user, klass)) {
    throw appError_('UNAUTHORIZED', 'You are not authorized to access this class.');
  }
  return klass;
}

/**
 * Teachers may correct their own submitted sessions; admins may correct any
 * session. Only a submitted session can be corrected.
 */
function canEditSession_(user, session, klass) {
  if (requireActiveUser_(user) && isAdmin_(user)) return true;
  if (!session || !klass) return false;
  if (session.status !== 'submitted') return false;
  return normalizeId_(user.teacher_id) === normalizeId_(session.teacher_id);
}

function requireSessionEditAccess_(user, session, klass) {
  requireActiveUser_(user);
  if (!session) {
    throw appError_('NOT_FOUND', 'That attendance session no longer exists.');
  }
  if (!canEditSession_(user, session, klass)) {
    throw appError_('UNAUTHORIZED', 'You are not authorized to change this attendance session.');
  }
  return session;
}

/** Optional Workspace-domain check on top of the Teachers-sheet lookup. */
function emailMatchesOrgDomain_(email, domain) {
  if (!domain) return true;
  var value = normalizeEmail_(email);
  return value.length > domain.length + 1 && value.slice(-(domain.length + 1)) === '@' + domain;
}

function normalizeId_(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeStatus_(value) {
  var raw = String(value == null ? '' : value).trim().toLowerCase();
  if (raw === 'p' || raw === 'present') return 'P';
  if (raw === 'a' || raw === 'absent') return 'A';
  if (raw === 'od' || raw === 'on duty' || raw === 'onduty') return 'OD';
  return null;
}

function normalizeBoolean_(value) {
  var raw = String(value == null ? '' : value).trim().toUpperCase();
  return raw === 'TRUE' || raw === 'YES' || raw === '1' || raw === 'ACTIVE';
}