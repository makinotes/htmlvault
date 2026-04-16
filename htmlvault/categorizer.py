"""HTML type categorizer — detect slide/chart/dashboard/card/page."""

import re
from typing import Optional


def categorize(filepath: str) -> str:
    """Categorize an HTML file by analyzing its content.

    Returns one of: slide, chart, dashboard, card, page
    """
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read(200_000)  # read first 200KB max
    except (OSError, IOError):
        return "page"

    lower = content.lower()

    if _is_slide(lower, content):
        return "slide"
    if _is_chart(lower):
        return "chart"
    if _is_dashboard(lower):
        return "dashboard"
    if _is_card(lower, len(content)):
        return "card"
    return "page"


def _is_slide(lower: str, raw: str) -> bool:
    """Detect presentation / slide deck."""
    # Known slide libraries
    slide_libs = [
        "swiper", "reveal.js", "reveal.min", "impress.js",
        "slidev", "remark.js", "deck.js", "shower.js",
    ]
    if any(lib in lower for lib in slide_libs):
        return True

    # Slide-like patterns
    slide_patterns = [
        "currentslide", "totalslides", "slideindex",
        "class=\"slide\"", "class='slide'",
        "data-slide", "slide-container",
        "prev-slide", "next-slide", "prevslide", "nextslide",
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
    """Detect chart / data visualization."""
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
    """Detect dashboard / multi-panel layout."""
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
    """Detect card / small fixed-canvas output."""
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
