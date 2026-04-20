// Unit tests for scanner.js static values and pure helpers.
// Run: node --test tests/unit/scanner.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/load-module.js');
const vm = require('node:vm');

function load() {
  return loadModule('scanner.js', ['formatSize']);
}

describe('formatSize()', () => {
  test('returns B for tiny sizes', () => {
    const { formatSize } = load();
    assert.equal(formatSize(1), '1 B');
    assert.equal(formatSize(1023), '1023 B');
  });

  test('returns KB for mid sizes', () => {
    const { formatSize } = load();
    assert.equal(formatSize(1024), '1 KB');
    assert.equal(formatSize(1024 * 100), '100 KB');
  });

  test('returns MB with 1 decimal for large sizes', () => {
    const { formatSize } = load();
    assert.equal(formatSize(1024 * 1024), '1.0 MB');
    assert.equal(formatSize(5.5 * 1024 * 1024), '5.5 MB');
  });

  test('exact 1024 boundary', () => {
    const { formatSize } = load();
    assert.equal(formatSize(1024), '1 KB');
    assert.equal(formatSize(1023), '1023 B');
  });
});

describe('DEFAULT_EXCLUDES (scanner config)', () => {
  test('excludes common dev folders', () => {
    const mod = loadModule('scanner.js', []);
    const excludes = vm.runInContext('Array.from(DEFAULT_EXCLUDES)', mod.__ctx);
    // Spot-check key exclusions — if the list changes in a surprising way
    // (e.g. node_modules suddenly not excluded), this test will flag it.
    for (const name of ['node_modules', '.git', 'dist', '.venv', '__pycache__']) {
      assert.ok(excludes.includes(name), 'expected ' + name + ' to be excluded');
    }
  });

  test('excludes .next, .claude, .trash', () => {
    const mod = loadModule('scanner.js', []);
    const excludes = vm.runInContext('Array.from(DEFAULT_EXCLUDES)', mod.__ctx);
    for (const name of ['.next', '.claude', '.trash']) {
      assert.ok(excludes.includes(name), name + ' should be excluded');
    }
  });
});

describe('MIN_FILE_SIZE threshold', () => {
  test('is 500 bytes', () => {
    const mod = loadModule('scanner.js', []);
    const min = vm.runInContext('MIN_FILE_SIZE', mod.__ctx);
    assert.equal(min, 500);
  });
});

describe('SKIP_FILENAMES', () => {
  test('skips Chromium license file', () => {
    const mod = loadModule('scanner.js', []);
    const skip = vm.runInContext('Array.from(SKIP_FILENAMES)', mod.__ctx);
    assert.ok(skip.includes('LICENSES.chromium.html'));
  });
});
