#!/usr/bin/env node
/**
 * Comprehensive Feature Validation Checklist
 * Verifies all implemented features are present in the built code
 */

import fs from 'fs';
import path from 'path';

const results = [];
const errors = [];

function check(name, pass, details = '') {
  const status = pass ? '✓' : '✗';
  const msg = `${status} ${name}${details ? ': ' + details : ''}`;
  console.log(msg);
  results.push(msg);
  if (!pass) errors.push(name);
}

function searchInFile(filePath, patterns) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return patterns.map(p => typeof p === 'string' ? content.includes(p) : p.test(content));
  } catch (e) {
    return patterns.map(() => false);
  }
}

const srcDir = './src';
const pagesDir = path.join(srcDir, 'pages');
const libDir = path.join(srcDir, 'lib');
const dbDir = path.join(srcDir, 'db');

console.log('🔍 FEATURE VERIFICATION REPORT\n' + '='.repeat(60));

// 1. Presentation Mode
console.log('\n📽️  PRESENTATION MODE');
const sessionFile = path.join(pagesDir, 'AttendanceSession.jsx');
const [hasPresentationMode, hasPresentationToggle, hasExitPresentation] = searchInFile(sessionFile, [
  'presentationMode',
  'Presentation',
  'exitPresentation'
]);
check('Presentation mode state', hasPresentationMode);
check('Presentation toggle button', hasPresentationToggle);
check('Exit presentation functionality', hasExitPresentation);

// 2. Keyboard Shortcuts
console.log('\n⌨️  KEYBOARD SHORTCUTS');
const [hasShortcutsDisplay, hasShortcutsSection] = searchInFile(sessionFile, [
  'Keyboard Shortcuts',
  'Mark Present|Mark Absent'
]);
check('Keyboard shortcuts section visible', hasShortcutsSection || hasShortcutsDisplay);
check('Keyboard handler', searchInFile(sessionFile, ['onKeyDown|handleKeyboardInput'])[0]);

// 3. Absent-only Review
console.log('\n👤 ABSENT-ONLY REVIEW');
const reviewFile = path.join(pagesDir, 'AttendanceReview.jsx');
const [hasAbsentQuery, hasAbsentFilter, hasQuickChange] = searchInFile(reviewFile, [
  'absentOnly|absentOnlyMode',
  'filter.*absent|absent.*filter',
  'Change to Present|changePresent'
]);
check('Absent-only query parameter', hasAbsentQuery);
check('Absent filtering logic', hasAbsentFilter);
check('Quick change to present action', hasQuickChange);

// 4. Class Snapshot
console.log('\n📊 CLASS SNAPSHOT');
const classDetailFile = path.join(pagesDir, 'ClassDetail.jsx');
const [hasSnapshot, hasSnapshotStats, hasSnapshotUI] = searchInFile(classDetailFile, [
  'Class Snapshot',
  'Students|Last Attendance|Average Attendance',
  'snapshot'
]);
check('Snapshot label', hasSnapshot);
check('Snapshot statistics', hasSnapshotStats);
check('Snapshot component', hasSnapshotUI);

// 5. Risk Indicator
console.log('\n⚠️  ATTENDANCE RISK INDICATOR');
const [hasRiskSummary, hasRiskLevels, hasRiskThreshold] = searchInFile(classDetailFile, [
  'Attendance Risk|Risk',
  'Safe|At Risk|Critical',
  'threshold|Below'
]);
check('Risk summary section', hasRiskSummary);
check('Risk level indicators', hasRiskLevels);
check('Risk threshold logic', hasRiskThreshold);

// 6. Calendar History
console.log('\n📅 CALENDAR ATTENDANCE HISTORY');
const historyFile = path.join(pagesDir, 'AttendanceHistory.jsx');
const [hasCalendar, hasMonthGrid, hasDateNavigation] = searchInFile(historyFile, [
  'calendar|Calendar|month',
  'Previous Month|Next Month|Today',
  /month|week|date/i
]);
check('Calendar view', hasCalendar);
check('Month navigation', hasMonthGrid);
check('Date-based access', hasDateNavigation);

// 7. Threshold Configuration
console.log('\n⚙️  THRESHOLD CONFIGURATION');
const setupFile = path.join(pagesDir, 'ClassSetup.jsx');
const [hasThresholdInput, hasThresholdState] = searchInFile(setupFile, [
  'Attendance Risk Threshold|attendance_threshold',
  'threshold|setThreshold'
]);
check('Threshold input in class setup', hasThresholdInput);
check('Threshold state management', hasThresholdState);

// 8. CSV Improvements
console.log('\n📄 SMARTER CSV IMPORT');
const sheetFile = path.join(libDir, 'studentSheet.js');
const [hasHeaderMatching, hasDuplicateDetection, hasValidation] = searchInFile(sheetFile, [
  'matchHeader|header.*match',
  'duplicate|Duplicate',
  'valid|invalid|validate'
]);
check('Smarter header matching', hasHeaderMatching);
check('Duplicate detection', hasDuplicateDetection);
check('Row validation', hasValidation);

// 9. Export Options
console.log('\n💾 EXPORT OPTIONS');
const [hasRosterExport, hasAttendanceExport] = searchInFile(classDetailFile, [
  'Export Student Roster|Roster|roster',
  'Export Attendance|attendance.*csv'
]);
check('Student roster export', hasRosterExport);
check('Attendance CSV export', hasAttendanceExport);

// 10. Repository & Utils
console.log('\n🗄️  DATA LAYER & UTILITIES');
const repoFile = path.join(dbDir, 'repositories.js');
const utilsFile = path.join(libDir, 'utils.js');
const [hasClassThreshold] = searchInFile(repoFile, ['attendance_threshold|threshold']);
const [hasRiskLevel, hasThresholdUtils] = searchInFile(utilsFile, [
  'getRiskLevel|riskLevel',
  'DEFAULT_ATTENDANCE_THRESHOLD|clampThreshold'
]);
check('Class threshold persistence', hasClassThreshold);
check('Risk level calculation', hasRiskLevel);
check('Threshold utilities', hasThresholdUtils);

// Summary
console.log('\n' + '='.repeat(60));
console.log(`\n✅ SUMMARY: ${results.length - errors.length}/${results.length} features verified\n`);

if (errors.length > 0) {
  console.log(`⚠️  Missing or incomplete features:\n${errors.map(e => `  - ${e}`).join('\n')}\n`);
}

fs.writeFileSync('feature-verification.txt', results.join('\n'));
console.log('📋 Full report saved to: feature-verification.txt\n');

process.exit(errors.length > 0 ? 1 : 0);
