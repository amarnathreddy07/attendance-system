import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Users/Amarnath Reddy/AppData/Local/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:5173';

let failures = 0;
function ok(name, cond, extra = '') {
  if (cond) console.log('PASS', name);
  else {
    failures += 1;
    console.error('FAIL', name, extra);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function text(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? el.textContent.trim() : null;
  }, selector);
}

async function clickText(page, selector, text) {
  await page.evaluate(
    ({ sel, t }) => {
      const els = [...document.querySelectorAll(sel)];
      const el = els.find((e) => e.textContent.trim().includes(t));
      if (!el) throw new Error(`No element ${sel} with text ${t}`);
      el.click();
    },
    { sel: selector, t: text }
  );
}

async function type(page, selector, value) {
  await page.waitForSelector(selector, { visible: true });
  await page.click(selector, { clickCount: 3 });
  await page.type(selector, value);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-extensions', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 900 },
});

const page = await browser.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

try {
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForFunction(() => document.body.textContent.includes('Sign in with Google'), { timeout: 10000 });
  ok('login page shown when signed out', true);

  // The app is gated behind Google login. Seed a session directly in IndexedDB
  // so the rest of the flow can be exercised without Google credentials.
  await page.evaluate(() => new Promise((resolve) => {
    const open = indexedDB.open('attendit_db');
    open.onsuccess = () => {
      const d = open.result;
      const tx = d.transaction(['settings', 'teachers'], 'readwrite');
      tx.objectStore('settings').put({ key: 'google_account_email', value: 'amarnath@university.edu', updated_at: new Date().toISOString() });
      tx.objectStore('teachers').put({ id: 'tch_e2e', name: 'Amarnath Reddy', email: 'amarnath@university.edu', created_at: new Date().toISOString() });
      tx.oncomplete = () => { d.close(); resolve(); };
      tx.onerror = () => { d.close(); resolve(); };
    };
    open.onerror = () => resolve();
  }));

  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForFunction(() => document.body.textContent.includes('My Classes'), { timeout: 10000 });
  ok('dashboard after seeded login', true);
  ok('greeting present', (await text(page, 'h1')).includes('Amarnath'));

  await clickText(page, 'a', 'Add Class');
  await page.waitForSelector('#cls-name', { visible: true, timeout: 10000 });
  await type(page, '#cls-name', 'Data Structures');
  await type(page, '#cls-section', 'Section 2');
  await clickText(page, 'button', 'Sample Students');

  await page.waitForFunction(() => document.body.textContent.includes('Google Sheet connected') || document.body.textContent.includes('Sample students generated'), { timeout: 10000 });
  const previewBody = await page.evaluate(() => document.body.textContent);
  ok('preview step shows students', previewBody.includes('24 students'), previewBody.slice(0, 300));

  await clickText(page, 'button', 'Import');
  await page.waitForFunction(() => document.body.textContent.includes('Take Attendance'), { timeout: 15000 });
  ok('class detail after import', true);

  await clickText(page, 'button', 'Take Attendance');
  await page.waitForSelector('h1', { timeout: 10000 });
  await sleep(500);
  const firstStudent = await text(page, 'h1');
  ok('attendance shows first student', !!firstStudent, firstStudent);
  ok('shows 1 / 24', (await page.evaluate(() => document.body.textContent)).includes('1 / 24'));

  for (let i = 0; i < 24; i += 1) {
    const body = await page.evaluate(() => document.body.textContent);
    if (body.includes('Attendance complete')) break;
    if (i % 3 === 0) {
      await clickText(page, 'button', 'Absent');
    } else {
      await clickText(page, 'button', 'Next');
    }
    await sleep(320);
  }

  await page.waitForFunction(() => document.body.textContent.includes('Attendance complete'), { timeout: 10000 });
  ok('completion panel after marking all', true);

  await clickText(page, 'button', 'Review Attendance');
  await page.waitForFunction(() => document.body.textContent.includes('Attendance Complete'), { timeout: 10000 });
  const reviewBody = await page.evaluate(() => document.body.textContent);
  ok('review shows summary', reviewBody.includes('Present') && reviewBody.includes('Absent'));
  ok('review present count 16', reviewBody.includes('16'), 'absent should be 8');

  await clickText(page, 'button', 'Submit Attendance');
  await page.waitForFunction(() => document.body.textContent.includes('Attendance History'), { timeout: 15000 });
  await page.waitForFunction(() => document.body.textContent.includes('/ 24 present'), { timeout: 10000 });
  const historyBody = await page.evaluate(() => document.body.textContent);
  ok('history page after submit', historyBody.includes('16 / 24 present'), historyBody.slice(0, 400));

  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('button')];
    const dayCard = cards.find((c) => c.textContent.includes('present'));
    dayCard && dayCard.click();
  });
  await page.waitForFunction(() => document.body.textContent.includes('Present') && document.body.textContent.includes('Student'), { timeout: 10000 });
  ok('session detail renders', true);

  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => document.body.textContent.includes('Teacher Profile'), { timeout: 10000 });
  ok('settings page renders', true);

  await page.goto(`${BASE}/classes/new`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#cls-name', { visible: true, timeout: 10000 });
  await type(page, '#cls-name', 'Second Class');
  await clickText(page, 'button', 'Create class without importing students');
  await page.waitForFunction(() => document.body.textContent.includes('Take Attendance'), { timeout: 10000 });
  ok('class created without import', true);

  const noStudents = await page.evaluate(() => document.body.textContent);
  ok('empty class shows no active students', noStudents.includes('No active students') || noStudents.includes('No students yet'));
} catch (err) {
  failures += 1;
  console.error('SCRIPT ERROR:', err.message);
}

console.log('--- console/page errors ---');
for (const e of errors.slice(0, 10)) console.error(e);

await browser.close();
console.log(failures ? `\n${failures} FAILURES` : '\nALL E2E CHECKS PASSED');
process.exit(failures ? 1 : 0);
