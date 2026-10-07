/**
 * Test harness for the Apps Script backend.
 *
 * Loads the real .gs sources into a V8 VM context with fakes for SpreadsheetApp,
 * CacheService, LockService, PropertiesService, UrlFetchApp, Utilities,
 * ContentService and Logger. Nothing in apps-script/lib is duplicated or
 * re-implemented here, so the tests exercise the deployed code paths.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, randomUUID } from 'node:crypto';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

/** Load order matters: Code.gs builds ROUTES from handler functions at parse time. */
const SOURCES = [
  'lib/Errors.gs',
  'lib/Config.gs',
  'lib/Policy.gs',
  'lib/Sheets.gs',
  'lib/Validate.gs',
  'lib/Repo.gs',
  'lib/Auth.gs',
  'lib/Handlers.gs',
  'Code.gs',
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class FakeRange {
  constructor(sheet, row, column, numRows, numColumns) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.numRows = numRows;
    this.numColumns = numColumns;
  }

  _ensure(height) {
    const needed = this.row - 1 + height;
    while (this.sheet.matrix.length < needed) {
      this.sheet.matrix.push([]);
    }
  }

  getValues() {
    this._ensure(this.numRows);
    const out = [];
    for (let r = 0; r < this.numRows; r += 1) {
      const matrixRow = this.sheet.matrix[this.row - 1 + r] || [];
      const row = [];
      for (let c = 0; c < this.numColumns; c += 1) {
        const value = matrixRow[this.column - 1 + c];
        row.push(value === undefined ? '' : value);
      }
      out.push(row);
    }
    return out;
  }

  setValues(values) {
    this._ensure(values.length);
    for (let r = 0; r < values.length; r += 1) {
      const index = this.row - 1 + r;
      while (this.sheet.matrix.length <= index) this.sheet.matrix.push([]);
      const existing = this.sheet.matrix[index] || [];
      const target = [];
      // Keep every column, replacing only the written window.
      const width = Math.max(existing.length, this.column - 1 + values[r].length);
      for (let c = 0; c < width; c += 1) {
        const offset = c - (this.column - 1);
        target.push(offset >= 0 && offset < values[r].length ? values[r][offset] : existing[c] ?? '');
      }
      this.sheet.matrix[index] = target;
    }
    this.sheet.writeLog.push({
      row: this.row,
      rows: values.length,
      columns: this.numColumns,
      values: clone(values),
    });
  }
}

class FakeSheet {
  constructor(name, matrix) {
    this.name = name;
    this.matrix = matrix;
    this.writeLog = [];
    this.frozenRows = 0;
  }

  getDataRange() {
    const width = this.matrix.reduce((max, row) => Math.max(max, row.length), 0);
    return new FakeRange(this, 1, 1, Math.max(this.matrix.length, 1), Math.max(width, 1));
  }

  getRange(row, column, numRows, numColumns) {
    return new FakeRange(this, row, column, numRows, numColumns);
  }

  getLastRow() {
    let last = 0;
    this.matrix.forEach((row, index) => {
      if (row.join('') !== '') last = index + 1;
    });
    return last;
  }

  setFrozenRows(count) {
    this.frozenRows = count;
  }
}

class FakeSpreadsheet {
  constructor(data) {
    this.sheets = {};
    Object.keys(data).forEach((name) => {
      this.sheets[name] = new FakeSheet(name, clone(data[name]));
    });
    this.readCount = 0;
  }

  getSheetByName(name) {
    return this.sheets[name] || null;
  }

  insertSheet(name) {
    const sheet = new FakeSheet(name, []);
    this.sheets[name] = sheet;
    return sheet;
  }

  /** Test helper: current sheet contents as { header, rows }. */
  table(name) {
    const sheet = this.sheets[name];
    if (!sheet) return null;
    const matrix = sheet.matrix.filter((row) => row.join('') !== '');
    return { header: matrix[0] || [], rows: matrix.slice(1) };
  }
}

function makeUtilities(secretStore) {
  return {
    base64EncodeWebSafe: (value) => Buffer.from(String(value), 'utf8').toString('base64url'),
    base64DecodeWebSafe: (value) => Buffer.from(String(value), 'base64url').toString('utf8'),
    computeHmacSha256Signature: (key, value) =>
      createHmac('sha256', String(key)).update(String(value), 'utf8').digest('base64'),
    getUuid: () => randomUUID(),
  };
}

/**
 * @param {object} options
 * @param {object} options.data  sheet name -> matrix (first row = headers)
 * @param {object} [options.props] script properties
 * @param {object} [options.googleClaims] canned tokeninfo claims
 * @param {boolean} [options.googleOk] whether UrlFetchApp should succeed
 * @param {string} [options.now] fixed clock value (ISO string)
 */
export function createBackend(options = {}) {
  const props = Object.assign(
    {
      SPREADSHEET_ID: 'sheet-123',
      GOOGLE_CLIENT_ID: 'client-123.apps.googleusercontent.com',
      SESSION_SECRET: 'test-secret',
    },
    options.props || {}
  );

  const spreadsheet = new FakeSpreadsheet(options.data || {});
  const cache = new Map();
  const logs = [];

  const context = vm.createContext({
    SpreadsheetApp: { openById: () => spreadsheet },
    CacheService: {
      getScriptCache: () => ({
        get: (key) => (cache.has(key) ? cache.get(key) : null),
        put: (key, value) => cache.set(key, value),
        remove: (key) => cache.delete(key),
      }),
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => true,
        releaseLock: () => {},
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => (key in props ? props[key] : null),
        setProperty: (key, value) => {
          props[key] = value;
        },
      }),
    },
    UrlFetchApp: {
      fetch: () => ({ getResponseCode: () => 200, getContentText: () => '{}' }),
    },
    Utilities: makeUtilities(props),
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({
        content: text,
        mimeType: '',
        setMimeType: function (value) {
          this.mimeType = value;
          return this;
        },
        getContent: function () {
          return this.content;
        },
      }),
    },
    Logger: { log: (...args) => logs.push(args.join(' ')) },
    console,
    JSON,
    Math,
    Date,
    Object,
    Array,
    String,
    Number,
    Boolean,
    isFinite,
    encodeURIComponent,
  });

  SOURCES.forEach((relative) => {
    const code = readFileSync(join(ROOT, relative), 'utf8');
    vm.runInContext(code, context, { filename: relative });
  });

  const api = vm.runInContext('({ doPost: doPost, doGet: doGet, helpers: { ping: ping_, ensureSchema: ensureSchema_ } })', context);
  api.__ctx = context;
  api.spreadsheet = spreadsheet;
  api.props = props;
  api.cache = cache;
  api.logs = logs;

  // Fixed clock keeps date-dependent output stable.
  const fixedNow = options.now ? new Date(options.now) : null;
  vm.runInContext('NOW_ = function () { return new Date("' + (fixedNow ? fixedNow.toISOString() : '2026-01-15T09:00:00.000Z') + '"); };', context);

  if (options.googleOk === false) {
    context.HTTP_FETCH_ = () => ({ getResponseCode: () => 401, getContentText: () => 'bad token' });
  } else if (options.googleClaims) {
    context.HTTP_FETCH_ = () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify(options.googleClaims) });
  }

  return api;
}

/** Calls an action through the real doPost entry point and parses the envelope. */
export function callAction(backend, action, body, sessionToken) {
  const payload = Object.assign({ action }, body || {});
  if (sessionToken) payload.session_token = sessionToken;
  const response = api_doPost(backend, payload);
  const text = response.getContent();
  return JSON.parse(text);
}

/** Replaces the canned Google tokeninfo response for the next login. */
export function setGoogleIdentity(backend, claims) {
  backend.__ctx.HTTP_FETCH_ = () => ({
    getResponseCode: () => (claims === null ? 401 : 200),
    getContentText: () => (claims === null ? 'invalid token' : JSON.stringify(claims)),
  });
}

function api_doPost(backend, payload) {
  return backend.doPost({
    postData: { type: 'application/json', contents: JSON.stringify(payload) },
    parameter: {},
  });
}

/** Full sign-in round trip: Google identity is verified, then a session is issued. */
export function loginAs(backend, email, extraClaims) {
  const nowSeconds = Math.floor(
    (backend.__ctx.NOW_ ? backend.__ctx.NOW_() : new Date()).getTime() / 1000
  );
  setGoogleIdentity(
    backend,
    Object.assign(
      {
        aud: 'client-123.apps.googleusercontent.com',
        email,
        email_verified: true,
        exp: nowSeconds + 3600,
        name: email.split('@')[0],
      },
      extraClaims || {}
    )
  );
  const result = callAction(backend, 'login', { id_token: 'fake-google-token' });
  if (!result.success) throw new Error('login failed for ' + email + ': ' + JSON.stringify(result.error));
  return result.data;
}