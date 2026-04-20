// Unit tests for categorizer.js
// Run: node --test tests/unit/categorizer.test.js
//
// Covers the 5 category branches (slide, chart, dashboard, card, page),
// cache behavior, priority ordering, and boundary conditions.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../helpers/load-module.js');

function fresh() {
  // Reload to get a clean _catCache per test suite.
  return loadModule('categorizer.js', ['categorize', '_catCache', '_isSlide', '_isChart', '_isDashboard', '_isCard']);
}

describe('categorize() — slide branch', () => {
  test('detects Reveal.js', () => {
    const { categorize } = fresh();
    const html = '<html><script src="reveal.js"></script></html>';
    assert.equal(categorize(html, 5000, null), 'slide');
  });

  test('detects Swiper', () => {
    const { categorize } = fresh();
    const html = '<html><link href="swiper.min.css"><div class="swiper"></div></html>';
    assert.equal(categorize(html, 5000, null), 'slide');
  });

  test('detects Impress.js', () => {
    const { categorize } = fresh();
    const html = '<html><script src="impress.js"></script></html>';
    assert.equal(categorize(html, 5000, null), 'slide');
  });

  test('detects Slidev', () => {
    const { categorize } = fresh();
    const html = '<html data-generator="slidev"></html>';
    assert.equal(categorize(html, 5000, null), 'slide');
  });

  test('detects data-slide attribute', () => {
    const { categorize } = fresh();
    const html = '<div data-slide="1"></div>';
    assert.equal(categorize(html, 5000, null), 'slide');
  });

  test('detects slide-nav pattern', () => {
    const { categorize } = fresh();
    const html = '<div class="slide-nav"></div>';
    assert.equal(categorize(html, 5000, null), 'slide');
  });

  test('detects 3+ sections with nav hints', () => {
    const { categorize } = fresh();
    const html = '<section></section><section></section><section></section><button class="next"></button>';
    assert.equal(categorize(html, 5000, null), 'slide');
  });

  test('does NOT classify as slide with 3 sections but no nav hints', () => {
    const { categorize } = fresh();
    const html = '<section>a</section><section>b</section><section>c</section>';
    assert.notEqual(categorize(html, 5000, null), 'slide');
  });

  test('does NOT classify as slide with <3 sections even with nav hints', () => {
    const { categorize } = fresh();
    const html = '<section>a</section><button class="prev next"></button>';
    assert.notEqual(categorize(html, 5000, null), 'slide');
  });
});

describe('categorize() — chart branch', () => {
  test('detects echarts.init', () => {
    const { categorize } = fresh();
    const html = '<script>echarts.init(document.body);</script>';
    assert.equal(categorize(html, 5000, null), 'chart');
  });

  test('detects Chart.js', () => {
    const { categorize } = fresh();
    const html = '<script>new Chart(ctx, {});</script>';
    assert.equal(categorize(html, 5000, null), 'chart');
  });

  test('detects D3', () => {
    const { categorize } = fresh();
    const html = '<script>d3.select("body");</script>';
    assert.equal(categorize(html, 5000, null), 'chart');
  });

  test('detects Highcharts / Plotly / ApexCharts', () => {
    const { categorize } = fresh();
    assert.equal(categorize('<script>highcharts</script>', 5000, null), 'chart');
    assert.equal(categorize('<script>plotly.newPlot()</script>', 5000, null), 'chart');
    assert.equal(categorize('<script>apexcharts</script>', 5000, null), 'chart');
  });

  test('detects heavy SVG path usage (>20 paths)', () => {
    const { categorize } = fresh();
    const paths = '<path d="M0 0"/>'.repeat(21);
    const html = '<svg>' + paths + '</svg>';
    assert.equal(categorize(html, 5000, null), 'chart');
  });

  test('20 SVG paths is NOT enough (strict >)', () => {
    const { categorize } = fresh();
    const paths = '<path d="M0 0"/>'.repeat(20);
    const html = '<svg>' + paths + '</svg>';
    assert.notEqual(categorize(html, 5000, null), 'chart');
  });
});

describe('categorize() — dashboard branch', () => {
  test('detects 2+ dashboard patterns', () => {
    const { categorize } = fresh();
    const html = '<div class="dashboard"><div class="kpi"></div></div>';
    assert.equal(categorize(html, 5000, null), 'dashboard');
  });

  test('detects dashboard + 4 grid/flex layouts', () => {
    const { categorize } = fresh();
    const html = `
      <div class="dashboard">
        <div style="display: grid"></div>
        <div style="display: grid"></div>
        <div style="display: flex"></div>
        <div style="display: flex"></div>
      </div>
    `;
    assert.equal(categorize(html, 5000, null), 'dashboard');
  });

  test('does NOT classify single "dashboard" keyword alone as dashboard', () => {
    const { categorize } = fresh();
    const html = '<p>This page describes dashboard design.</p>';
    assert.notEqual(categorize(html, 5000, null), 'dashboard');
  });

  test('stat-card + metric-card = dashboard', () => {
    const { categorize } = fresh();
    const html = '<div class="stat-card"></div><div class="metric-card"></div>';
    assert.equal(categorize(html, 5000, null), 'dashboard');
  });
});

describe('categorize() — card branch', () => {
  test('detects fixed 1280px width + small file + few divs', () => {
    const { categorize } = fresh();
    const html = '<div style="width: 1280px;"><div></div><div></div></div>';
    assert.equal(categorize(html, 5000, null), 'card');
  });

  test('detects 1080px width', () => {
    const { categorize } = fresh();
    const html = '<div style="width: 1080px;"><div></div></div>';
    assert.equal(categorize(html, 5000, null), 'card');
  });

  test('rejects files >100KB even with fixed width', () => {
    const { categorize } = fresh();
    const html = '<div style="width: 1280px;"><div></div></div>';
    assert.notEqual(categorize(html, 100001, null), 'card');
  });

  test('rejects when div count >= 50', () => {
    const { categorize } = fresh();
    const html = '<div style="width: 1280px;">' + '<div></div>'.repeat(50) + '</div>';
    assert.notEqual(categorize(html, 5000, null), 'card');
  });
});

describe('categorize() — page fallback', () => {
  test('plain HTML falls back to page', () => {
    const { categorize } = fresh();
    const html = '<html><body><h1>Hello</h1><p>world</p></body></html>';
    assert.equal(categorize(html, 5000, null), 'page');
  });

  test('empty content is page', () => {
    const { categorize } = fresh();
    assert.equal(categorize('', 0, null), 'page');
  });
});

describe('categorize() — priority order', () => {
  // The function tests slide → chart → dashboard → card → page, so the earliest
  // match wins. Content that would match multiple categories should get the
  // earlier one.

  test('slide wins over chart when both match', () => {
    const { categorize } = fresh();
    const html = '<script src="reveal.js"></script><script>new Chart(ctx)</script>';
    assert.equal(categorize(html, 5000, null), 'slide');
  });

  test('chart wins over dashboard when both match', () => {
    const { categorize } = fresh();
    const html = '<div class="dashboard kpi"></div><script>echarts.init(ctx)</script>';
    assert.equal(categorize(html, 5000, null), 'chart');
  });

  test('dashboard wins over card when both match', () => {
    const { categorize } = fresh();
    const html = '<div style="width: 1280px;" class="dashboard"><div class="kpi"></div></div>';
    assert.equal(categorize(html, 5000, null), 'dashboard');
  });
});

describe('categorize() — cache behavior', () => {
  test('second call with same key uses cache', () => {
    const mod = fresh();
    const { categorize } = mod;
    // Inject a helper into the sandbox context to prove cache is active by
    // checking that a mutating side-effect done via eval shows up in the
    // next call. Works because _catCache is a module-scope const but we
    // can run arbitrary code in the same vm context.
    const html = '<script src="reveal.js"></script>';
    assert.equal(categorize(html, 5000, 'file1:100'), 'slide');
    const vm = require('node:vm');
    vm.runInContext("_catCache.set('file1:100', 'chart')", mod.__ctx);
    // Same key → must return the cached (overridden) value.
    assert.equal(categorize(html, 5000, 'file1:100'), 'chart');
  });

  test('different cache key re-runs categorization', () => {
    const { categorize } = fresh();
    const html = '<script src="reveal.js"></script>';
    assert.equal(categorize(html, 5000, 'file1:100'), 'slide');
    // Different key = different mtime = re-categorize, same result.
    assert.equal(categorize(html, 5000, 'file1:101'), 'slide');
  });

  test('null cache key bypasses cache entirely', () => {
    const mod = fresh();
    const { categorize } = mod;
    categorize('<script src="reveal.js"></script>', 5000, null);
    const vm = require('node:vm');
    const size = vm.runInContext("_catCache.size", mod.__ctx);
    assert.equal(size, 0);
  });
});

describe('categorize() — edge cases', () => {
  test('case-insensitive detection', () => {
    const { categorize } = fresh();
    assert.equal(categorize('<SCRIPT SRC="REVEAL.JS"></SCRIPT>', 5000, null), 'slide');
  });

  test('extremely long content handled', () => {
    const { categorize } = fresh();
    const html = '<p>text</p>'.repeat(10000);
    assert.equal(categorize(html, 10000 * 11, null), 'page');
  });

  test('no crash on special characters', () => {
    const { categorize } = fresh();
    assert.equal(categorize('<p>中文 🚀 \\x00 \\u0000</p>', 5000, null), 'page');
  });
});
