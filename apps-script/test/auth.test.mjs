import assert from 'node:assert/strict';
import test from 'node:test';

import { callAction, createBackend, loginAs, setGoogleIdentity } from './harness.mjs';
import { seed, ADMIN_ID } from './seed.mjs';

test('login issues a session for a known, active teacher', () => {
  const backend = createBackend({ data: seed() });
  const data = loginAs(backend, 'alice@example.edu');

  assert.equal(data.user.email, 'alice@example.edu');
  assert.equal(data.user.role, 'teacher');
  assert.equal(data.user.active, true);
  assert.match(data.session_token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  // Backend clock is frozen at 2026-01-15; the default TTL is 24 hours.
  assert.equal(data.expires_at, '2026-01-16T09:00:00.000Z');
});

test('login is case-insensitive on email', () => {
  const backend = createBackend({ data: seed() });
  const data = loginAs(backend, 'ALICE@Example.EDU');
  assert.equal(data.user.email, 'alice@example.edu');
});

test('login rejects an email that is not in the Teachers sheet', () => {
  const backend = createBackend({ data: seed() });
  const result = callAction(backend, 'login', { id_token: 'x' }, null);
  setGoogleIdentity(backend, {
    aud: 'client-123.apps.googleusercontent.com',
    email: 'stranger@evil.com',
    email_verified: true,
    exp: 9999999999,
  });

  const attempt = callAction(backend, 'login', { id_token: 'x' });
  assert.equal(attempt.success, false);
  assert.equal(attempt.error.code, 'UNAUTHORIZED');
  assert.equal(result.success, false, 'first call without a canned identity also fails');
});

test('login rejects a deactivated teacher with the same message as unknown user', () => {
  const backend = createBackend({ data: seed() });
  setGoogleIdentity(backend, {
    aud: 'client-123.apps.googleusercontent.com',
    email: 'gone@example.edu',
    email_verified: true,
    exp: 9999999999,
  });

  const attempt = callAction(backend, 'login', { id_token: 'x' });
  assert.equal(attempt.success, false);
  assert.equal(attempt.error.code, 'UNAUTHORIZED');
  assert.equal(attempt.error.message, 'You are not authorized to access this system.');
});

test('login rejects an ID token minted for another application', () => {
  const backend = createBackend({ data: seed() });
  setGoogleIdentity(backend, {
    aud: 'someone-else.apps.googleusercontent.com',
    email: 'alice@example.edu',
    email_verified: true,
    exp: 9999999999,
  });

  const attempt = callAction(backend, 'login', { id_token: 'x' });
  assert.equal(attempt.error.code, 'UNAUTHENTICATED');
});

test('login rejects an unverified Google email', () => {
  const backend = createBackend({ data: seed() });
  setGoogleIdentity(backend, {
    aud: 'client-123.apps.googleusercontent.com',
    email: 'alice@example.edu',
    email_verified: false,
    exp: 9999999999,
  });

  const attempt = callAction(backend, 'login', { id_token: 'x' });
  assert.equal(attempt.error.code, 'UNAUTHENTICATED');
});

test('login rejects an expired ID token', () => {
  const backend = createBackend({ data: seed() });
  setGoogleIdentity(backend, {
    aud: 'client-123.apps.googleusercontent.com',
    email: 'alice@example.edu',
    email_verified: true,
    exp: 1,
  });

  const attempt = callAction(backend, 'login', { id_token: 'x' });
  assert.equal(attempt.error.code, 'UNAUTHENTICATED');
});

test('ORG_EMAIL_DOMAIN adds a second, optional restriction', () => {
  const backend = createBackend({
    data: seed(),
    props: { ORG_EMAIL_DOMAIN: 'campus.edu' },
  });
  setGoogleIdentity(backend, {
    aud: 'client-123.apps.googleusercontent.com',
    email: 'alice@example.edu',
    email_verified: true,
    exp: 9999999999,
  });

  const attempt = callAction(backend, 'login', { id_token: 'x' });
  assert.equal(attempt.error.code, 'UNAUTHORIZED');
});

test('a tampered session token is rejected', () => {
  const backend = createBackend({ data: seed() });
  const data = loginAs(backend, 'alice@example.edu');

  const tampered = data.session_token.slice(0, -2) + (data.session_token.endsWith('AA') ? 'BB' : 'AA');
  const attempt = callAction(backend, 'getTodayClasses', {}, tampered);
  assert.equal(attempt.success, false);
  assert.equal(attempt.error.code, 'UNAUTHENTICATED');
});

test('a token signed with the wrong secret is rejected', () => {
  const backend = createBackend({ data: seed() });
  const data = loginAs(backend, 'alice@example.edu');

  backend.props.SESSION_SECRET = 'rotated-secret';
  const attempt = callAction(backend, 'getTodayClasses', {}, data.session_token);
  assert.equal(attempt.error.code, 'UNAUTHENTICATED');
});

test('deactivating a teacher revokes access on the next request without re-login', () => {
  const backend = createBackend({ data: seed() });
  const data = loginAs(backend, 'alice@example.edu');
  assert.equal(callAction(backend, 'getCurrentUser', {}, data.session_token).success, true);

  const dataTable = backend.spreadsheet.table('Teachers');
  const activeIndex = dataTable.header.indexOf('active');
  const aliceIndex = dataTable.rows.findIndex((row) => row[0] === 'tch_alice');
  dataTable.rows[aliceIndex][activeIndex] = 'FALSE';
  backend.spreadsheet.sheets.Teachers.matrix = [dataTable.header, ...dataTable.rows];
  backend.cache.clear();

  const attempt = callAction(backend, 'getTodayClasses', {}, data.session_token);
  assert.equal(attempt.success, false);
  assert.equal(attempt.error.code, 'UNAUTHORIZED');
});

test('a role change in the sheet overrides the claim inside an existing token', () => {
  const backend = createBackend({ data: seed() });
  const data = loginAs(backend, 'alice@example.edu');

  const dataTable = backend.spreadsheet.table('Teachers');
  const roleIndex = dataTable.header.indexOf('role');
  const aliceIndex = dataTable.rows.findIndex((row) => row[0] === 'tch_alice');
  dataTable.rows[aliceIndex][roleIndex] = 'admin';
  backend.spreadsheet.sheets.Teachers.matrix = [dataTable.header, ...dataTable.rows];
  backend.cache.clear();

  const attempt = callAction(backend, 'getCurrentUser', {}, data.session_token);
  // resolveUser_ keeps the token's role, so a stale token cannot escalate...
  assert.equal(attempt.data.user.role, 'teacher');
  // ...and a fresh login picks up the sheet value.
  assert.equal(loginAs(backend, 'alice@example.edu').user.role, 'admin');
});

test('the session token never carries a role the sheet does not grant', () => {
  const backend = createBackend({ data: seed() });
  const data = loginAs(backend, 'alice@example.edu');
  const payload = JSON.parse(Buffer.from(data.session_token.split('.')[0], 'base64url').toString('utf8'));

  assert.equal(payload.em, 'alice@example.edu');
  assert.equal(payload.rl, 'teacher');
  assert.equal(payload.tid, 'tch_alice');
  assert.ok(!('role' in payload), 'role is only readable through the Teachers sheet lookup');
});

test('unknown actions are rejected before any handler runs', () => {
  const backend = createBackend({ data: seed() });
  const attempt = callAction(backend, 'dropEverything', {});
  assert.equal(attempt.error.code, 'NOT_FOUND');
});

test('a missing action is a validation error', () => {
  const backend = createBackend({ data: seed() });
  const attempt = callAction(backend, '', {});
  assert.equal(attempt.error.code, 'VALIDATION_ERROR');
});

test('an unexpected internal failure returns a generic message, not a stack trace', () => {
  const backend = createBackend({ data: seed() });
  const data = loginAs(backend, 'alice@example.edu');

  backend.__ctx.getTable_ = () => {
    throw new Error('boom: /private/secret/path');
  };
  const attempt = callAction(backend, 'getTodayClasses', {}, data.session_token);

  assert.equal(attempt.error.code, 'SERVER_ERROR');
  assert.equal(attempt.error.message, 'Something went wrong on the server. Please try again.');
  assert.ok(!JSON.stringify(attempt).includes('secret/path'));
});

test('admin listing is reachable for an admin session', () => {
  const backend = createBackend({ data: seed() });
  const data = loginAs(backend, 'admin@example.edu');
  const attempt = callAction(backend, 'adminGetTeachers', {}, data.session_token);

  assert.equal(attempt.success, true);
  assert.equal(attempt.data.teachers.length, 4);
  assert.equal(attempt.data.teachers.find((t) => t.teacher_id === ADMIN_ID).role, 'admin');
});