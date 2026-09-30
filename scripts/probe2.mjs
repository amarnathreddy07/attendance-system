import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Users/Amarnath Reddy/AppData/Local/Google/Chrome/Application/chrome.exe';
const BASE = 'http://localhost:5173';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR:', e.stack?.split('\n').slice(0, 8).join('\n')));
page.on('console', (m) => {
  if (m.type() === 'error') console.error('CONSOLE:', m.text().slice(0, 300));
});

await page.goto(BASE, { waitUntil: 'networkidle2' });
await page.waitForFunction(() => document.body.textContent.includes('My Classes'), { timeout: 15000 });
await page.evaluate(() => {
  const a = [...document.querySelectorAll('a')].find((x) => x.textContent.includes('Add Class'));
  a && a.click();
});
await page.waitForSelector('#cls-name', { visible: true, timeout: 15000 });
await page.type('#cls-name', 'Probe Class');
await page.evaluate(() => {
  document.querySelectorAll('button').forEach((b) => b.textContent.includes('Sample Students') && b.click());
});
await page.waitForFunction(() => document.body.textContent.includes('Import 24'), { timeout: 15000 });
await page.evaluate(() => {
  document.querySelectorAll('button').forEach((b) => b.textContent.includes('Import 24') && b.click());
});
await page.waitForFunction(() => document.body.textContent.includes('Take Attendance'), { timeout: 15000 });
await page.evaluate(() => {
  document.querySelectorAll('button').forEach((b) => b.textContent.includes('Take Attendance') && b.click());
});
await new Promise((r) => setTimeout(r, 5000));
const body = await page.evaluate(() => document.body.textContent);
console.log('BODY:', JSON.stringify(body.slice(0, 600)));

const dump = await page.evaluate(async () => {
  const db = window.__db;
  return 'no window.__db';
});
console.log(dump);

await browser.close();
