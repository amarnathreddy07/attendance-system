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
page.on('pageerror', (e) => console.error('PAGEERROR:', e.stack?.split('\n').slice(0, 6).join('\n')));
page.on('console', (m) => {
  if (m.type() === 'error') console.error('CONSOLE:', m.text().slice(0, 500));
});

await page.goto(BASE, { waitUntil: 'networkidle2' });
await page.waitForSelector('#t-name', { timeout: 15000 });
await page.type('#t-name', 'Test Prof');
await page.evaluate(() => {
  document.querySelectorAll('button').forEach((b) => b.textContent.includes('Create Profile') && b.click());
});
await new Promise((r) => setTimeout(r, 4000));
await page.goto(BASE, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 4000));
console.log('BODY SNIPPET:', (await page.evaluate(() => document.body.textContent)).slice(0, 500));
await browser.close();
