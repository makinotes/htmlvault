"""
RETIRED — HTMLVault has moved to a Chrome extension as its only supported form.

This Python CLI (`htmlvault serve` / `htmlvault scan`) is kept in the repo
for historical reference only. It is no longer installed by pyproject.toml,
no longer published to PyPI, and no longer maintained. The logic here has
been reimplemented in `extension/` as MV3-compliant JavaScript.

If you are a non-technical user: please install the Chrome extension
(see README.md for instructions).

If you want to run the old CLI, revert to an earlier git tag (<= v0.1.0).
The entire original source is preserved below as a docstring so it can be
read, copied, or revived, but it will NOT execute as a module.
"""

_RETIRED_ORIGINAL_SOURCE = r"""
\"\"\"HTML type categorizer — detect slide/chart/dashboard/card/page.\"\"\"

import os
import re
from collections import OrderedDict
from typing import Optional

# Bounded LRU cache: filepath -> (mtime, category). Cap avoids unbounded growth
# in long-running serve sessions over directories with rotating outputs.
_CACHE_MAX = 1000
_cache: "OrderedDict[str, tuple]" = OrderedDict()


def categorize(filepath: str) -> str:
    \"\"\"Categorize an HTML file by analyzing its content.

    Results are cached by filepath + mtime — only re-reads if file changed.
    Returns one of: slide, chart, dashboard, card, page
    \"\"\"
    try:
        mtime = os.path.getmtime(filepath)
    except OSError:
        return "page"

    cached = _cache.get(filepath)
    if cached and cached[0] == mtime:
        _cache.move_to_end(filepath)
        return cached[1]

    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read(200_000)  # read first 200KB max
    except (OSError, IOError):
        return "page"

    lower = content.lower()

    if _is_slide(lower, content):
        result = "slide"
    elif _is_chart(lower):
        result = "chart"
    elif _is_dashboard(lower):
        result = "dashboard"
    elif _is_card(lower, len(content)):
        result = "card"
    else:
        result = "page"

    _cache[filepath] = (mtime, result)
    _cache.move_to_end(filepath)
    if len(_cache) > _CACHE_MAX:
        _cache.popitem(last=False)
    return result


def _is_slide(lower: str, raw: str) -> bool:
    \"\"\"Detect presentation / slide deck.\"\"\"
    # Known slide libraries
    slide_libs = [
        "swiper", "reveal.js", "reveal.min", "impress.js",
        "slidev", "remark.js", "deck.js", "shower.js",
        "bespoke.js", "webslides",
    ]
    if any(lib in lower for lib in slide_libs):
        return True

    # Slide-like patterns
    slide_patterns = [
        "currentslide", "totalslides", "slideindex",
        "class=\"slide\"", "class='slide'",
        "data-slide", "slide-container",
        "prev-slide", "next-slide", "prevslide", "nextslide",
        "slide-nav", "slide-number", "slide-content",
    ]
    if any(p in lower for p in slide_patterns):
        return True

    # Multiple <section> tags with navigation
    section_count = lower.count("<section")
    if section_count >= 3:
        nav_hints = ["arrow", "prev", "next", "navigation", "indicator"]
        if any(h in lower for h in nav_hints):
            return True

    return False


def _is_chart(lower: str) -> bool:
    \"\"\"Detect chart / data visualization.\"\"\"
    chart_libs = [
        "echarts.init", "echarts.min", "new chart(",
        "chart.js", "chartjs", "d3.select", "d3.min",
        "highcharts", "apexcharts", "plotly",
        "google.visualization", "c3.generate",
        "recharts", "nivo", "visx",
    ]
    if any(lib in lower for lib in chart_libs):
        return True

    # Heavy SVG path usage (likely a chart)
    svg_paths = len(re.findall(r"<path\s+d=", lower))
    if svg_paths > 20:
        return True

    return False


def _is_dashboard(lower: str) -> bool:
    \"\"\"Detect dashboard / multi-panel layout.\"\"\"
    # Explicit dashboard keyword in meaningful context
    dash_patterns = [
        "dashboard", "data-panel", "panel-container",
        "stat-card", "metric-card", "kpi",
    ]
    dash_hits = sum(1 for p in dash_patterns if p in lower)
    if dash_hits >= 2:
        return True

    # Single strong signal
    if "dashboard" in lower:
        # Multiple grid/flex containers suggest multi-panel
        grid_count = lower.count("display:grid") + lower.count("display: grid")
        grid_count += lower.count("display:flex") + lower.count("display: flex")
        if grid_count >= 4:
            return True

    return False


def _is_card(lower: str, content_size: int) -> bool:
    \"\"\"Detect card / small fixed-canvas output.\"\"\"
    if content_size > 100_000:  # > 100KB is not a card
        return False

    # Fixed canvas dimensions
    fixed_patterns = [
        r"width:\s*1280px", r"width:\s*1080px", r"width:\s*720px",
        r"width:\s*800px", r"width:\s*640px",
        r"max-width:\s*1280px",
    ]
    has_fixed = any(re.search(p, lower) for p in fixed_patterns)

    # Small number of elements, card-like structure
    if has_fixed and lower.count("<div") < 50:
        return True

    return False
"""
