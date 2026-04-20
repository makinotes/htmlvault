// Unit tests for pure helper functions inside gallery.js.
// Run: node --test tests/unit/gallery-helpers.test.js
//
// gallery.js calls init() at the bottom and touches document.*, so we load it
// with DOM shims that do just enough to let the module parse and expose its
// functions. We then call the pure functions we care about.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const GALLERY_PATH = path.join(__dirname, '..', '..', 'extension', 'gallery.js');
const SCANNER_PATH = path.join(__dirname, '..', '..', 'extension', 'scanner.js');
const STORAGE_PATH = path.join(__dirname, '..', '..', 'extension', 'storage.js');

function loadGallerySandbox(opts = {}) {
  // Build a DOM-ish sandbox rich enough for gallery.js to load without
  // throwing during its bottom-of-file init() call.
  const stubEl = () => ({
    addEventListener: () => {},
    appendChild: () => {},
    innerHTML: '',
    textContent: '',
    value: '',
    style: {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    querySelectorAll: () => [],
    querySelector: () => null,
    dataset: {},
  });
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Date,
    Math,
    JSON,
    Map,
    Set,
    Promise,
    Error,
    Blob: globalThis.Blob,
    URL: globalThis.URL,
    IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
    window: opts.window || {},
    document: {
      getElementById: () => stubEl(),
      querySelector: () => stubEl(),
      querySelectorAll: () => [],
      addEventListener: () => {},
      createElement: () => stubEl(),
    },
    navigator: { clipboard: { writeText: async () => {} }, userAgent: opts.userAgent || 'node-test' },
    chrome: {
      storage: { local: { get: (d, cb) => cb(d || {}), set: (d, cb) => cb && cb() } },
      runtime: { lastError: null, getURL: (p) => 'chrome-extension://test/' + p },
    },
    confirm: () => true,
    // stubs so storage.js / scanner.js load cleanly
    indexedDB: { open: () => ({ onsuccess: null, onerror: null }) },
  };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);

  // Load dependencies first (gallery.js references _catCache, categorize, etc.)
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'extension', 'categorizer.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(SCANNER_PATH, 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(STORAGE_PATH, 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(GALLERY_PATH, 'utf8'), ctx);
  return ctx;
}

describe('esc()', () => {
  test('escapes & < > "', () => {
    const ctx = loadGallerySandbox();
    const esc = vm.runInContext('esc', ctx);
    assert.equal(esc('<script>"&</script>'), '&lt;script&gt;&quot;&amp;&lt;/script&gt;');
  });

  test('handles empty string', () => {
    const ctx = loadGallerySandbox();
    const esc = vm.runInContext('esc', ctx);
    assert.equal(esc(''), '');
  });

  test('preserves unicode', () => {
    const ctx = loadGallerySandbox();
    const esc = vm.runInContext('esc', ctx);
    assert.equal(esc('中文 🚀'), '中文 🚀');
  });

  test('escapes & before creating entities (no double-escape)', () => {
    const ctx = loadGallerySandbox();
    const esc = vm.runInContext('esc', ctx);
    // "&amp;" input should become "&amp;amp;" (escaped once).
    assert.equal(esc('&amp;'), '&amp;amp;');
  });
});

describe('shortDate()', () => {
  test('shows MM-DD for current year', () => {
    const ctx = loadGallerySandbox();
    const shortDate = vm.runInContext('shortDate', ctx);
    const now = new Date();
    const ts = now.getTime() / 1000;
    const out = shortDate(ts);
    // Matches MM-DD format
    assert.match(out, /^\d{2}-\d{2}$/);
  });

  test('shows YY-MM-DD for past year', () => {
    const ctx = loadGallerySandbox();
    const shortDate = vm.runInContext('shortDate', ctx);
    // Dec 15 2020 at noon UTC — definitely not the current year.
    const ts = new Date('2020-12-15T12:00:00Z').getTime() / 1000;
    const out = shortDate(ts);
    assert.match(out, /^20-12-15$/);
  });

  test('zero-pads single-digit months and days', () => {
    const ctx = loadGallerySandbox();
    const shortDate = vm.runInContext('shortDate', ctx);
    const ts = new Date('2020-01-05T12:00:00Z').getTime() / 1000;
    assert.equal(shortDate(ts), '20-01-05');
  });
});

describe('normalizeName()', () => {
  test('strips trailing version suffix -v2', () => {
    const ctx = loadGallerySandbox();
    const normalize = vm.runInContext('normalizeName', ctx);
    assert.equal(normalize('report-v2'), 'report');
  });

  test('strips _v10', () => {
    const ctx = loadGallerySandbox();
    const normalize = vm.runInContext('normalizeName', ctx);
    assert.equal(normalize('doc_v10'), 'doc');
  });

  test('strips -final / -draft / -old / -new / -backup / -copy', () => {
    const ctx = loadGallerySandbox();
    const normalize = vm.runInContext('normalizeName', ctx);
    assert.equal(normalize('report-final'), 'report');
    assert.equal(normalize('report-draft'), 'report');
    assert.equal(normalize('report-old'), 'report');
    assert.equal(normalize('report-backup'), 'report');
    assert.equal(normalize('report-copy'), 'report');
  });

  test('strips trailing (1), (2) duplication marker', () => {
    const ctx = loadGallerySandbox();
    const normalize = vm.runInContext('normalizeName', ctx);
    assert.equal(normalize('file (1)'), 'file');
    assert.equal(normalize('file (42)'), 'file');
  });

  test('strips trailing 8+ digit timestamp', () => {
    const ctx = loadGallerySandbox();
    const normalize = vm.runInContext('normalizeName', ctx);
    assert.equal(normalize('snapshot-20251015'), 'snapshot');
    assert.equal(normalize('snapshot_20251015120000'), 'snapshot');
  });

  test('lowercases result', () => {
    const ctx = loadGallerySandbox();
    const normalize = vm.runInContext('normalizeName', ctx);
    assert.equal(normalize('Report-V2'), 'report');
  });

  test('strips any trailing -NUM or _NUM (v prefix optional)', () => {
    const ctx = loadGallerySandbox();
    const normalize = vm.runInContext('normalizeName', ctx);
    // First regex is /[-_]v?\d+$/i — the v is optional, so any trailing
    // -NUM / _NUM also gets stripped. This is aggressive; document it here.
    assert.equal(normalize('file-99'), 'file');
    assert.equal(normalize('file_42'), 'file');
    assert.equal(normalize('file-1'), 'file');
  });
});

describe('foldVersions()', () => {
  test('groups same base name in same folder', () => {
    const ctx = loadGallerySandbox();
    const fold = vm.runInContext('foldVersions', ctx);
    const files = [
      { name: 'report-v3', folder: 'docs', mtime: 3 },
      { name: 'report-v2', folder: 'docs', mtime: 2 },
      { name: 'report',    folder: 'docs', mtime: 1 },
    ];
    const out = fold(files);
    assert.equal(out.length, 1);
    assert.equal(out[0].length, 3);
  });

  test('does NOT group across folders', () => {
    const ctx = loadGallerySandbox();
    const fold = vm.runInContext('foldVersions', ctx);
    const files = [
      { name: 'report', folder: 'docs',  mtime: 1 },
      { name: 'report', folder: 'other', mtime: 2 },
    ];
    const out = fold(files);
    assert.equal(out.length, 2);
  });

  test('short base names (≤2 chars) never fold', () => {
    const ctx = loadGallerySandbox();
    const fold = vm.runInContext('foldVersions', ctx);
    const files = [
      { name: 'a-v1', folder: 'docs', mtime: 1 },
      { name: 'a-v2', folder: 'docs', mtime: 2 },
    ];
    const out = fold(files);
    // base name 'a' is only 1 char → stays separate.
    assert.equal(out.length, 2);
  });

  test('preserves insertion order within a cluster', () => {
    const ctx = loadGallerySandbox();
    const fold = vm.runInContext('foldVersions', ctx);
    const files = [
      { name: 'report-v3', folder: 'docs', mtime: 3 },
      { name: 'report-v1', folder: 'docs', mtime: 1 },
      { name: 'report-v2', folder: 'docs', mtime: 2 },
    ];
    const out = fold(files);
    const names = out[0].map(f => f.name);
    assert.equal(names.length, 3);
    assert.equal(names[0], 'report-v3');
    assert.equal(names[1], 'report-v1');
    assert.equal(names[2], 'report-v2');
  });
});

describe('formatSize()', () => {
  test('bytes < 1024 show as B', () => {
    const ctx = loadGallerySandbox();
    const fmt = vm.runInContext('formatSize', ctx);
    assert.equal(fmt(0), '0 B');
    assert.equal(fmt(999), '999 B');
    assert.equal(fmt(1023), '1023 B');
  });

  test('1024 to 1MB show as KB', () => {
    const ctx = loadGallerySandbox();
    const fmt = vm.runInContext('formatSize', ctx);
    assert.equal(fmt(1024), '1 KB');
    assert.equal(fmt(2048), '2 KB');
    assert.equal(fmt(500 * 1024), '500 KB');
  });

  test('>=1MB shows as MB with one decimal', () => {
    const ctx = loadGallerySandbox();
    const fmt = vm.runInContext('formatSize', ctx);
    assert.equal(fmt(1024 * 1024), '1.0 MB');
    assert.equal(fmt(5 * 1024 * 1024 + 512 * 1024), '5.5 MB');
  });
});

describe('isFileSystemAccessSupported()', () => {
  test('returns true when showDirectoryPicker exists on window', () => {
    const ctx = loadGallerySandbox({ window: { showDirectoryPicker: () => {} } });
    const fn = vm.runInContext('isFileSystemAccessSupported', ctx);
    assert.equal(fn(), true);
  });

  test('returns false when absent', () => {
    const ctx = loadGallerySandbox({ window: {} });
    const fn = vm.runInContext('isFileSystemAccessSupported', ctx);
    assert.equal(fn(), false);
  });

  test('returns false when showDirectoryPicker is not a function', () => {
    const ctx = loadGallerySandbox({ window: { showDirectoryPicker: 'not a fn' } });
    const fn = vm.runInContext('isFileSystemAccessSupported', ctx);
    assert.equal(fn(), false);
  });
});

describe('getFiltered()', () => {
  test('all + empty query returns all files', () => {
    const ctx = loadGallerySandbox();
    vm.runInContext(`
      FILES = [
        { name: 'a', relpath: 'a.html', type: 'slide' },
        { name: 'b', relpath: 'b.html', type: 'chart' },
      ];
      typeFilter = 'all';
      // search input is stubbed to value=''
    `, ctx);
    const getFiltered = vm.runInContext('getFiltered', ctx);
    assert.equal(getFiltered().length, 2);
  });

  test('type filter narrows results', () => {
    const ctx = loadGallerySandbox();
    vm.runInContext(`
      FILES = [
        { name: 'a', relpath: 'a.html', type: 'slide' },
        { name: 'b', relpath: 'b.html', type: 'chart' },
      ];
      typeFilter = 'slide';
    `, ctx);
    const getFiltered = vm.runInContext('getFiltered', ctx);
    const out = getFiltered();
    assert.equal(out.length, 1);
    assert.equal(out[0].name, 'a');
  });

  test('search matches name OR relpath', () => {
    const ctx = loadGallerySandbox();
    // Replace document.getElementById('search') to return an element with value
    vm.runInContext(`
      FILES = [
        { name: 'Report', relpath: 'docs/report.html', type: 'page' },
        { name: 'Other',  relpath: 'other/foo.html',   type: 'page' },
      ];
      typeFilter = 'all';
      document.getElementById = (id) => (id === 'search') ? { value: 'report' } : {};
    `, ctx);
    const getFiltered = vm.runInContext('getFiltered', ctx);
    const out = getFiltered();
    assert.equal(out.length, 1);
    assert.equal(out[0].name, 'Report');
  });

  test('search is case-insensitive', () => {
    const ctx = loadGallerySandbox();
    vm.runInContext(`
      FILES = [{ name: 'Report', relpath: 'a.html', type: 'page' }];
      typeFilter = 'all';
      document.getElementById = (id) => (id === 'search') ? { value: 'REPORT' } : {};
    `, ctx);
    const getFiltered = vm.runInContext('getFiltered', ctx);
    assert.equal(getFiltered().length, 1);
  });

  test('search + type filter combine (AND logic)', () => {
    const ctx = loadGallerySandbox();
    vm.runInContext(`
      FILES = [
        { name: 'Report', relpath: 'a.html', type: 'slide' },
        { name: 'Report', relpath: 'b.html', type: 'chart' },
      ];
      typeFilter = 'chart';
      document.getElementById = (id) => (id === 'search') ? { value: 'report' } : {};
    `, ctx);
    const getFiltered = vm.runInContext('getFiltered', ctx);
    const out = getFiltered();
    assert.equal(out.length, 1);
    assert.equal(out[0].relpath, 'b.html');
  });
});

describe('renderUnsupportedBrowser — UA detection (indirect)', () => {
  // We can't easily test the DOM write, but the UA-name branch is a pure
  // computation we can exercise by checking what shows up in the innerHTML.
  test('detects Firefox from UA', () => {
    const ctx = loadGallerySandbox({ userAgent: 'Mozilla/5.0 (Macintosh) Gecko/20100101 Firefox/120.0' });
    let captured = '';
    vm.runInContext(`
      document.getElementById = (id) => (id === 'content')
        ? { innerHTML: '', set innerHTML(v) { _captured = v; }, get innerHTML() { return _captured || ''; }, style: {} }
        : { style: {}, textContent: '' };
    `, ctx);
    // Easier: directly call and inspect via a spy
    vm.runInContext(`
      _captured = '';
      var el = { style: {}, textContent: '' };
      Object.defineProperty(el, 'innerHTML', { set(v){ _captured = v; }, get(){ return _captured; } });
      document.getElementById = (id) => (id === 'content') ? el : { style: {}, textContent: '' };
      renderUnsupportedBrowser();
    `, ctx);
    const out = vm.runInContext('_captured', ctx);
    assert.match(out, /Firefox does not support/);
  });

  test('detects Safari from UA (no Chrome in UA)', () => {
    const ctx = loadGallerySandbox({ userAgent: 'Mozilla/5.0 (Macintosh) AppleWebKit/605 Version/17.0 Safari/605' });
    vm.runInContext(`
      _captured = '';
      var el = { style: {}, textContent: '' };
      Object.defineProperty(el, 'innerHTML', { set(v){ _captured = v; }, get(){ return _captured; } });
      document.getElementById = (id) => (id === 'content') ? el : { style: {}, textContent: '' };
      renderUnsupportedBrowser();
    `, ctx);
    const out = vm.runInContext('_captured', ctx);
    assert.match(out, /Safari does not support/);
  });

  test('falls back to "your browser" for unknown UAs', () => {
    const ctx = loadGallerySandbox({ userAgent: 'SomeBot/1.0' });
    vm.runInContext(`
      _captured = '';
      var el = { style: {}, textContent: '' };
      Object.defineProperty(el, 'innerHTML', { set(v){ _captured = v; }, get(){ return _captured; } });
      document.getElementById = (id) => (id === 'content') ? el : { style: {}, textContent: '' };
      renderUnsupportedBrowser();
    `, ctx);
    const out = vm.runInContext('_captured', ctx);
    assert.match(out, /your browser does not support/);
  });
});
