# HTMLVault

Your AI-generated HTML showcase. Scan directories, auto-categorize, and browse HTML files in an interactive gallery.

## Why

AI tools (Claude, ChatGPT, Cursor) generate self-contained HTML files — slides, charts, dashboards, data cards — that pile up across project directories with no good way to browse, organize, or find them later. HTMLVault solves this.

## Features

- **Auto-scan** directories recursively for HTML files
- **Smart categorization** — detects slides, charts, dashboards, cards, and pages by analyzing content
- **Time-based layering** — Pinned / Recent (7 days) / Older, no manual tagging needed
- **Live iframe previews** — real-time thumbnail rendering via CSS transform, zero dependencies
- **Multi-version folding** — similar filenames in the same folder collapse automatically (e.g. `report.html`, `report-v2.html`)
- **Finder-style UI** — clean white theme, hover-to-reveal actions, system blue accent
- **Pin & Trash** — pin important files, trash files (moves to `.htmlvault/trash/`)
- **Directory management** — add/remove scan directories via native macOS folder picker or drag-and-drop
- **Grid & List views** with folder/type/flat grouping
- **Search** across filenames and paths

## Install

```bash
pip install htmlvault
```

Or install from source:

```bash
git clone https://github.com/makinotes/htmlvault.git
cd htmlvault
pip install -e .
```

## Usage

### Serve mode (recommended)

Start a local server with live gallery:

```bash
htmlvault serve ~/projects
```

Opens `http://localhost:7749` in your browser. Features:
- Click file to open in system default app
- Click folder icon to reveal in Finder
- Pin/unpin files (persisted across sessions)
- Trash files (moved to `.htmlvault/trash/`)
- Add scan directories via folder picker

Options:
```bash
htmlvault serve ~/projects --port 8080 --no-open
```

### Scan mode

Generate a static gallery HTML file:

```bash
htmlvault scan ~/projects -o gallery.html
open gallery.html
```

## How categorization works

HTMLVault reads the first 200KB of each HTML file and pattern-matches against known libraries and structural patterns:

| Category | Detection signals |
|----------|-------------------|
| **slide** | Swiper, Reveal.js, Impress.js, `data-slide` attributes, multiple `<section>` with navigation |
| **chart** | ECharts, Chart.js, D3, Highcharts, Plotly, heavy SVG `<path>` usage (>20 paths) |
| **dashboard** | "dashboard" keyword + grid/flex layouts, panel/metric/KPI patterns |
| **card** | Fixed canvas dimensions (1280/1080/720px), small file (<100KB), few DOM elements |
| **page** | Default fallback |

Results are cached by file modification time — only re-reads changed files.

## Config

HTMLVault stores config in `.htmlvault/` inside the first scanned directory:

```
.htmlvault/
  config.json   # scan directories
  pins.json     # pinned file paths
  trash/        # trashed files (preserving directory structure)
```

## Requirements

- Python >= 3.9
- click >= 8.0
- jinja2 >= 3.0

## License

MIT
