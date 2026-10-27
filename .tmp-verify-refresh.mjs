import puppeteer from './node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const APP = 'http://127.0.0.1:5173';
const API = 'https://script.google.com/macros/s/AKfycbxAIxUYZPQm4tgdbB6AY38TO1jtlkOhMamuWbz00mxOH3Y92xrEAVLx4est4uLQ2xH5/exec';
const USER = { teacher_id: 'TCH-0001', name: 'Alice Teacher', email: 'alice@example.edu', role: 'teacher' };

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage();
  await page.setRequestInterception(true);

  let refreshCalls = 0;
  let submitCalls = 0;

  page.on('request', async (request) => {
    if (!request.url().startsWith(API)) {
      request.continue().catch(() => {});
      return;
    }
    let body = {};
    try {
      body = JSON.parse(request.postData() || '{}');
    } catch {}
    const token = body.session_token;
    const json = (payload) => request.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    }).catch(() => {});
    const ok = (data) => json({ success: true, data });
    const err = (code, message) => json({ success: false, error: { code, message } });
    const expired = () => err('UNAUTHENTICATED', 'Your session has expired. Please sign in again.');

    if (body.action === 'getCurrentUser') {
      return token === 'new-session' ? ok({ user: USER }) : expired();
    }
    if (body.action === 'refreshSession') {
      refreshCalls += 1;
      if (body.refresh_token !== 'valid-refresh') return expired();
      return ok({
        user: USER,
        session_token: 'new-session',
        expires_at: '2026-10-28T09:00:00.000Z',
        refresh_token: 'new-refresh',
        refresh_expires_at: '2026-11-26T09:00:00.000Z',
      });
    }
    if (body.action === 'submitAttendance') {
      if (token !== 'new-session') return expired();
      submitCalls += 1;
      return ok({ session_id: body.session_id, saved: 1 });
    }
    if (body.action === 'getClasses') {
      if (token !== 'new-session') return expired();
      return ok({ classes: [] });
    }
    return err('UNKNOWN_ACTION', 'Unknown action: ' + body.action);
  });

  await page.goto(APP + '/#/login', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.innerText.includes('Sign in to AttendIt'));

  await page.evaluate(async () => {
    const { default: db } = await import('/src/db/db.js');
    await db.settings.bulkPut([
      { key: 'session_token', value: 'expired-session' },
      { key: 'refresh_token', value: 'valid-refresh' },
    ]);
    await db.sync_queue.put({
      id: 'op_verify_1',
      class_id: 'cls_101',
      session_id: 'ses_cls_101_2026-10-27',
      date: '2026-10-27',
      records: [{ student_id: 'stu_1', status: 'P' }],
      sync_status: 'pending',
      attempts: 0,
      last_error: null,
      created_at: '2026-10-27T09:00:00.000Z',
      updated_at: '2026-10-27T09:00:00.000Z',
    });
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.innerText.includes('My Classes'), { timeout: 15000 });

  const afterRefresh = await page.evaluate(async () => {
    const { default: db } = await import('/src/db/db.js');
    return {
      hash: location.hash,
      settings: await db.settings.toArray(),
      queue: await db.sync_queue.toArray(),
    };
  });
  const settings = Object.fromEntries(afterRefresh.settings.map((row) => [row.key, row.value]));

  if (afterRefresh.hash !== '#/') throw new Error('Expected dashboard, got ' + afterRefresh.hash);
  if (settings.session_token !== 'new-session') throw new Error('Session token was not renewed');
  if (settings.refresh_token !== 'new-refresh') throw new Error('Refresh token was not rotated');
  if (refreshCalls !== 1) throw new Error('Expected exactly one refresh call, got ' + refreshCalls);
  if (submitCalls !== 1) throw new Error('Expected queued attendance to flush once, got ' + submitCalls);
  if (afterRefresh.queue[0]?.sync_status !== 'synced') throw new Error('Queued row did not sync');

  // A dead refresh token must still sign the user out.
  await page.evaluate(async () => {
    const { default: db } = await import('/src/db/db.js');
    await db.settings.bulkPut([
      { key: 'session_token', value: 'expired-session' },
      { key: 'refresh_token', value: 'dead-refresh' },
    ]);
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => location.hash === '#/login', { timeout: 15000 });
  const afterFailure = await page.evaluate(async () => {
    const { default: db } = await import('/src/db/db.js');
    return db.settings.toArray();
  });
  const failedSettings = Object.fromEntries(afterFailure.map((row) => [row.key, row.value]));
  if (failedSettings.session_token) throw new Error('Expired session token was not cleared');
  if (failedSettings.refresh_token) throw new Error('Dead refresh token was not cleared');

  console.log('PASS silent refresh, token rotation, queue flush, and expired-refresh sign-out');
} finally {
  await browser.close();
}
