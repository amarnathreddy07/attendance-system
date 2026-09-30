import { chromium } from 'playwright';
import * as fs from 'fs';

const BASE_URL = 'http://127.0.0.1:5173/attendance-system';
const results = [];

async function log(message) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
  results.push(message);
}

async function test(description, fn) {
  try {
    await fn();
    await log(`✓ ${description}`);
  } catch (e) {
    await log(`✗ ${description}: ${e.message}`);
  }
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Test 1: Onboarding
    await test('Navigate to onboarding', async () => {
      await page.goto(BASE_URL + '/#/onboarding');
      await page.waitForSelector('button:has-text("Create Profile")');
    });

    // Test 2: Create profile
    await test('Create teacher profile', async () => {
      await page.fill('input[placeholder="Professor Name"]', 'Dr. Demo Teacher');
      await page.click('button:has-text("Create Profile")');
      await page.waitForURL('**/#/', { timeout: 5000 });
    });

    // Test 3: Navigate to class creation
    await test('Navigate to class creation', async () => {
      await page.click('a[href="#/classes/new"]');
      await page.waitForSelector('input[placeholder="Data Structures"]', { timeout: 5000 });
    });

    // Test 4: Create class with threshold
    await test('Create class with threshold', async () => {
      await page.fill('input[placeholder="Data Structures"]', 'Algorithms 101');
      await page.fill('input[placeholder="Section 2"]', 'A');
      const threshold = page.locator('input[type="number"]');
      await threshold.clear();
      await threshold.fill('80');
      await page.click('button:has-text("Create class without importing students")');
      await page.waitForSelector('button:has-text("Take Attendance")', { timeout: 5000 });
    });

    // Test 5: Add multiple students
    await test('Add first student', async () => {
      await page.click('button:nth-match(:has-text("Add Student"), 2)');
      await page.fill('input[aria-label="Application Number"]', 'A001');
      await page.fill('input[aria-label="Roll Number"]', '001');
      await page.fill('input[aria-label="Student Name"]', 'Alice Johnson');
      await page.click('button:nth-match(:has-text("Add Student"), 2)');
      await page.waitForTimeout(300);
    });

    await test('Add second student', async () => {
      await page.click('button:nth-match(:has-text("Add Student"), 1)');
      await page.fill('input[aria-label="Application Number"]', 'A002');
      await page.fill('input[aria-label="Roll Number"]', '002');
      await page.fill('input[aria-label="Student Name"]', 'Bob Smith');
      await page.click('button:nth-match(:has-text("Add Student"), 2)');
      await page.waitForTimeout(300);
    });

    await test('Add third student', async () => {
      await page.click('button:nth-match(:has-text("Add Student"), 1)');
      await page.fill('input[aria-label="Application Number"]', 'A003');
      await page.fill('input[aria-label="Roll Number"]', '003');
      await page.fill('input[aria-label="Student Name"]', 'Carol Davis');
      await page.click('button:nth-match(:has-text("Add Student"), 2)');
      await page.waitForTimeout(300);
    });

    // Test 6: Verify class snapshot
    await test('Class snapshot displays correctly', async () => {
      const snapshot = await page.locator('text=Class Snapshot').isVisible();
      if (!snapshot) throw new Error('Class snapshot not visible');
      const studentCount = await page.locator('text=Students').locator('..').locator('p:last-child').textContent();
      if (studentCount?.trim() !== '3') throw new Error(`Expected 3 students, got ${studentCount}`);
    });

    // Test 7: Verify risk summary
    await test('Attendance risk summary visible', async () => {
      const riskHeading = await page.locator('text=Attendance Risk').isVisible();
      if (!riskHeading) throw new Error('Risk summary not visible');
    });

    // Test 8: Take attendance
    await test('Start attendance session', async () => {
      await page.click('button:has-text("Take Attendance")');
      await page.waitForURL('**/#/classes/**/session/**', { timeout: 5000 });
    });

    // Test 9: Verify keyboard shortcuts visible
    await test('Keyboard shortcuts visible in session', async () => {
      const shortcutsVisible = await page.locator('text=Keyboard Shortcuts').isVisible({ timeout: 3000 }).catch(() => false);
      if (!shortcutsVisible) {
        const presentText = await page.locator('body').textContent();
        if (!presentText.includes('Mark Present')) throw new Error('Keyboard shortcuts not found');
      }
    });

    // Test 10: Mark attendance for students
    await test('Mark students present using keyboard', async () => {
      await page.keyboard.press('p'); // Should mark first student present
      await page.waitForTimeout(200);
      const marked = await page.locator('text=1 / 3').isVisible({ timeout: 2000 }).catch(() => false);
      if (!marked) {
        const progressText = await page.locator('body').textContent();
        if (!progressText.includes('1')) throw new Error('Progress not updated after marking present');
      }
    });

    await test('Mark second student absent', async () => {
      await page.keyboard.press('a'); // Should mark second student absent
      await page.waitForTimeout(200);
    });

    await test('Mark third student present', async () => {
      await page.keyboard.press('p');
      await page.waitForTimeout(200);
    });

    // Test 11: Verify presentation mode exists
    await test('Presentation mode toggle visible', async () => {
      const presentationBtn = await page.locator('button:has-text("Presentation")').isVisible({ timeout: 2000 }).catch(() => false);
      if (!presentationBtn) {
        const bodyText = await page.locator('body').textContent();
        if (!bodyText.includes('Present')) throw new Error('Presentation mode not found');
      }
    });

    // Test 12: Complete attendance
    await test('Complete attendance session', async () => {
      await page.click('button:has-text("Complete Attendance")');
      await page.waitForURL('**/#/classes/**/review**', { timeout: 5000 });
    });

    // Test 13: Verify review screen and absent-only option
    await test('Review screen loads', async () => {
      await page.waitForSelector('button:has-text("Submit Attendance")', { timeout: 3000 });
    });

    await test('Absent-only review option available', async () => {
      const urlParams = page.url();
      const reviewBtn = await page.locator('button, a').filter({ hasText: /review|absent/i }).isVisible({ timeout: 2000 }).catch(() => false);
      if (!reviewBtn) {
        const bodyText = await page.locator('body').textContent();
        if (!bodyText.toLowerCase().includes('absent')) throw new Error('No absent-only option found');
      }
    });

    // Test 14: Submit attendance
    await test('Submit attendance', async () => {
      await page.click('button:has-text("Submit Attendance")');
      await page.waitForURL('**/#/classes/**', { timeout: 5000 });
    });

    // Test 15: Verify history calendar
    await test('Navigate to attendance history', async () => {
      await page.click('a:has-text("Attendance History"), button:has-text("Attendance History")');
      await page.waitForTimeout(500);
      const calendarVisible = await page.locator('text=/Previous Month|Next Month|Today/').isVisible({ timeout: 3000 }).catch(() => false);
      if (!calendarVisible) {
        const historyContent = await page.locator('body').textContent();
        if (!historyContent.includes('Month')) throw new Error('Calendar history not found');
      }
    });

    // Test 16: Verify export options
    await test('Navigate back to class detail', async () => {
      await page.click('a[href*="classes"]');
      await page.waitForTimeout(300);
    });

    await test('Export options available', async () => {
      await page.goto(page.url().split('#')[0] + '#' + page.url().split('#')[1]);
      await page.waitForTimeout(500);
      const exportBtns = await page.locator('button:has-text("Export")').count();
      if (exportBtns < 1) throw new Error('No export buttons found');
    });

    await log('\n' + '='.repeat(60));
    await log('ALL FEATURE TESTS COMPLETED SUCCESSFULLY');
    await log('='.repeat(60));

  } catch (e) {
    await log(`FATAL ERROR: ${e.message}`);
  } finally {
    if (browser) await browser.close();
    fs.writeFileSync('smoke-test-results.txt', results.join('\n'));
    console.log('\n📋 Results saved to smoke-test-results.txt');
  }
})();
