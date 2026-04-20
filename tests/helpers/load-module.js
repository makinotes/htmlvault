// Load a classic (non-ESM) script from extension/ into a sandbox and return
// the names we care about. The extension code is written for the browser and
// relies on globals, so we evaluate it inside a context that provides minimal
// browser shims (window, document stubs, etc.) and then read the defined
// names off the sandbox.
//
// Usage:
//   const { categorize, _catCache } = loadModule('categorizer.js', ['categorize', '_catCache']);

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const EXT_DIR = path.join(__dirname, '..', '..', 'extension');

function makeSandbox(extraGlobals = {}) {
  // Minimal browser-ish surface. Individual tests can add more via extraGlobals.
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
    // DOM-ish shims — real tests that need DOM should build on top of these.
    window: {},
    document: {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      createElement: () => ({
        addEventListener: () => {},
        appendChild: () => {},
        classList: { add: () => {}, remove: () => {}, toggle: () => {} },
      }),
    },
    navigator: { clipboard: { writeText: async () => {} }, userAgent: 'node-test' },
    ...extraGlobals,
  };
  sandbox.globalThis = sandbox;
  return vm.createContext(sandbox);
}

function loadModule(filename, names, extraGlobals = {}) {
  const full = path.join(EXT_DIR, filename);
  const src = fs.readFileSync(full, 'utf8');
  const ctx = makeSandbox(extraGlobals);
  vm.runInContext(src, ctx, { filename: full });
  const out = {};
  for (const n of names) out[n] = ctx[n];
  out.__ctx = ctx;
  return out;
}

module.exports = { loadModule, makeSandbox };
