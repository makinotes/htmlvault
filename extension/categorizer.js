// HTML type categorizer — detect slide/chart/dashboard/card/page.
// Ported 1:1 from htmlvault/categorizer.py.

// Cache: key (relpath + mtime) -> category
const _catCache = new Map();

/**
 * Categorize HTML content.
 * @param {string} content - HTML content (first 200KB)
 * @param {number} contentSize - total file size in bytes
 * @param {string} cacheKey - optional cache key (relpath + mtime)
 * @returns {string} one of: slide, chart, dashboard, card, page
 */
function categorize(content, contentSize, cacheKey) {
  if (cacheKey) {
    const cached = _catCache.get(cacheKey);
    if (cached) return cached;
  }

  const lower = content.toLowerCase();
  let result;

  if (_isSlide(lower, content)) {
    result = "slide";
  } else if (_isChart(lower)) {
    result = "chart";
  } else if (_isDashboard(lower)) {
    result = "dashboard";
  } else if (_isCard(lower, contentSize)) {
    result = "card";
  } else {
    result = "page";
  }

  if (cacheKey) _catCache.set(cacheKey, result);
  return result;
}

function _isSlide(lower, raw) {
  // Known slide libraries
  const slideLibs = [
    "swiper", "reveal.js", "reveal.min", "impress.js",
    "slidev", "remark.js", "deck.js", "shower.js",
    "bespoke.js", "webslides",
  ];
  if (slideLibs.some(lib => lower.includes(lib))) return true;

  // Slide-like patterns
  const slidePatterns = [
    "currentslide", "totalslides", "slideindex",
    'class="slide"', "class='slide'",
    "data-slide", "slide-container",
    "prev-slide", "next-slide", "prevslide", "nextslide",
    "slide-nav", "slide-number", "slide-content",
  ];
  if (slidePatterns.some(p => lower.includes(p))) return true;

  // Multiple <section> tags with navigation
  const sectionCount = (lower.match(/<section/g) || []).length;
  if (sectionCount >= 3) {
    const navHints = ["arrow", "prev", "next", "navigation", "indicator"];
    if (navHints.some(h => lower.includes(h))) return true;
  }

  return false;
}

function _isChart(lower) {
  const chartLibs = [
    "echarts.init", "echarts.min", "new chart(",
    "chart.js", "chartjs", "d3.select", "d3.min",
    "highcharts", "apexcharts", "plotly",
    "google.visualization", "c3.generate",
    "recharts", "nivo", "visx",
  ];
  if (chartLibs.some(lib => lower.includes(lib))) return true;

  // Heavy SVG path usage (likely a chart)
  const svgPaths = (lower.match(/<path\s+d=/g) || []).length;
  if (svgPaths > 20) return true;

  return false;
}

function _isDashboard(lower) {
  const dashPatterns = [
    "dashboard", "data-panel", "panel-container",
    "stat-card", "metric-card", "kpi",
  ];
  const dashHits = dashPatterns.filter(p => lower.includes(p)).length;
  if (dashHits >= 2) return true;

  if (lower.includes("dashboard")) {
    let gridCount = (lower.match(/display:\s*grid/g) || []).length;
    gridCount += (lower.match(/display:\s*flex/g) || []).length;
    if (gridCount >= 4) return true;
  }

  return false;
}

function _isCard(lower, contentSize) {
  if (contentSize > 100000) return false;

  const fixedPatterns = [
    /width:\s*1280px/, /width:\s*1080px/, /width:\s*720px/,
    /width:\s*800px/, /width:\s*640px/,
    /max-width:\s*1280px/,
  ];
  const hasFixed = fixedPatterns.some(p => p.test(lower));

  if (hasFixed && (lower.match(/<div/g) || []).length < 50) return true;

  return false;
}
