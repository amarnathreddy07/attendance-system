import fs from 'fs';

const CANDIDATES = {
  win32: [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ],
};

export function resolveChromePath() {
  const fromEnv = process.env.CHROME_PATH;
  if (fromEnv) return fromEnv;

  const found = (CANDIDATES[process.platform] || []).find((candidate) => candidate && fs.existsSync(candidate));
  if (!found) {
    throw new Error(`No Chrome/Chromium found on ${process.platform}. Set CHROME_PATH=/path/to/chrome and retry.`);
  }
  return found;
}

export const DEV_URL = process.env.DEV_URL || 'http://localhost:5173';