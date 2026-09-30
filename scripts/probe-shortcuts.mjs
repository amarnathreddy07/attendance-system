import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Users/Amarnath Reddy/AppData/Local/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:5173/attendance-system/';

let failures = 0;
const ok = (name, cond, extra = '') => {
  if (cond) console.log('PASS', name);
  else {
    failures += 1;
    console.error('FAIL', name, extra);
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-extensions', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 900 },
});

const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

const bodyText = () => page.evaluate(() => document.body.textContent);

const clickText = async (selector, text) => {
  await page.evaluate(({ sel, t }) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().includes(t));
    if (!el) throw new Error(`No ${sel} with text ${t}`);
    el.click();
  }, { sel: selector, t: text });
};

try {
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForFunction(() => document.body.textContent.includes('Create Your Profile'), { timeout: 15000 });
  ok('onboarding shows with fresh db', true);

  await page.waitForSelector('#t-name', { visible: true });
  await page.click('#t-name', { clickCount: 3 });
  await page.type('#t-name', 'Amarnath Reddy');
  await clickText('button', 'Create Profile');
  await page.waitForFunction(() => document.body.textContent.includes('My Classes'), { timeout: 15000 });
  ok('dashboard after onboarding', true);

  await clickText('a', 'Add Class');
  await page.waitForSelector('#cls-name', { visible: true });
  await page.click('#cls-name', { clickCount: 3 });
  await page.type('#cls-name', 'Test Class');
  await clickText('button', 'Sample Students');
  await page.waitForFunction(() => document.body.textContent.includes('Sample students generated'), { timeout: 15000 });
  await clickText('button', 'Import');
  await page.waitForFunction(() => document.body.textContent.includes('Take Attendance'), { timeout: 15000 });
  await clickText('button', 'Take Attendance');

  await page.waitForSelector('h1', { visible: true, timeout: 15000 });
  await sleep(600);
  const firstStudent = await page.evaluate(() => document.querySelector('h1').textContent.trim());
  ok('session shows first student', !!firstStudent, firstStudent);

  const markedText = async () => (await page.evaluate(() => document.querySelector('p.text-xs')?.textContent.trim() || ''));
  const h1 = async () => (await page.evaluate(() => document.querySelector('h1').textContent.trim()));
  const statuses = async () =>
    page.evaluate(async () => {
      const mod = await import('./src/db/db.js');
      const db = mod.default;
      const s = await db.attendance_sessions.limit(1).first();
      const recs = await db.attendance_records.where('attendance_session_id').equals(s.id).toArray();
      return Object.fromEntries(recs.map((r) => [r.student_id.slice(0, 6), r.status]));
    });

  await page.keyboard.press('ArrowRight');
  await sleep(400);
  ok('right arrow marks present (1 / N marked)', (await markedText()).startsWith('1 /'), await markedText());
  const secondStudent = await h1();
  ok('advanced to next student', secondStudent !== firstStudent, `${firstStudent} -> ${secondStudent}`);

  await page.keyboard.press('a');
  await sleep(400);
  ok('"a" marks absent (2 / N marked)', (await markedText()).startsWith('2 /'), await markedText());
  const thirdStudent = await h1();
  ok('"a" advanced forward', thirdStudent !== secondStudent, `${secondStudent} -> ${thirdStudent}`);

  await page.keyboard.press('Backspace');
  await sleep(400);
  ok('backspace goes back WITHOUT marking (still 2 / N)', (await markedText()).startsWith('2 /'), await markedText());
  ok('back shows previous student', (await h1()) === secondStudent, await h1());

  const afterAbsent = Object.values(await statuses());
  ok('"a" recorded as absent', afterAbsent.includes('absent'), JSON.stringify(await statuses()));

  await page.keyboard.press('Enter');
  await sleep(400);
  ok('enter re-marks + advances (still 2 / N unique)', (await markedText()).startsWith('2 /'), await markedText());
  ok('enter moved forward again', (await h1()) === thirdStudent, await h1());

  await page.keyboard.press(' ');
  await sleep(400);
  ok('space marks present (3 / N marked)', (await markedText()).startsWith('3 /'), await markedText());

  const body = await bodyText();
  ok('shortcut hints updated', body.includes('A') && body.includes('Absent') && body.includes('Back'), 'hint panel visible');

  await page.keyboard.press('ArrowLeft');
  await sleep(400);
  ok('left arrow goes back without marking (still 3 / N)', (await markedText()).startsWith('3 /'), await markedText());
} catch (err) {
  failures += 1;
  console.error('SCRIPT ERROR:', err.message);
}

console.log('--- console/page errors ---');
for (const e of errors.slice(0, 10)) console.error(e);
if (errors.length === 0) console.log('(none)');

await browser.close();
console.log(failures ? `\n${failures} FAILURES` : '\nALL PROBE CHECKS PASSED');
process.exit(failures ? 1 : 0);
