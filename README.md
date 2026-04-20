# HTMLVault

**Your AI-generated HTML showcase, as a Chrome extension.**

AI tools (Claude, ChatGPT, Cursor) generate self-contained HTML files — slides, charts, dashboards, data cards — that pile up across project directories with no good way to browse, organize, or find them later. HTMLVault solves this.

Pick a folder on your machine, HTMLVault scans it for `.html` / `.htm` files, auto-categorizes them, and shows everything in a clean gallery. Files never leave your machine.

## Supported browsers

HTMLVault needs the **File System Access API** (`window.showDirectoryPicker`), which is currently Chromium-only. That's a hard requirement — without it, there's no way to let you pick a local folder.

| Browser | Windows | macOS | Linux | Verdict |
|---|---|---|---|---|
| **Chrome** | ✅ | ✅ | ✅ | Fully supported |
| **Edge** | ✅ | ✅ | ✅ | Fully supported |
| **Brave** | ✅ | ✅ | ✅ | Fully supported |
| **Arc** | ✅ | ✅ | — | Fully supported |
| **Opera / Vivaldi** | ✅ | ✅ | ✅ | Fully supported |
| **Safari** | — | ❌ | — | Not supported (no File System Access API) |
| **Firefox** | ❌ | ❌ | ❌ | Not supported (no File System Access API) |
| **Any mobile browser** | — | — | — | Not supported (extensions and/or the API are missing) |

If you open HTMLVault in Safari or Firefox, the gallery shows a clear "unsupported browser" message instead of silently failing.

## Install

HTMLVault is a Chrome extension. Two ways to install:

### Option 1 — Chrome Web Store (recommended once published)

Search **HTMLVault** in the Chrome Web Store and click **Add to Chrome**.

### Option 2 — Load unpacked (developer mode)

1. Clone or download this repo.
2. Open `chrome://extensions` in Chrome.
3. Toggle **Developer mode** (top right).
4. Click **Load unpacked** and select the `extension/` folder in this repo.
5. Pin HTMLVault to the toolbar for easy access.

## Usage

1. Click the HTMLVault toolbar icon → the gallery opens in a new tab.
2. Click **Add Folder** and pick a directory containing HTML files (subfolders are scanned automatically).
3. Browse. Search. Pin the good stuff. Hide the noise.

### Keyboard shortcuts

- `Cmd/Ctrl + F` — focus the search box
- `Esc` — clear search

### Categories

HTMLVault reads the first 200 KB of each file and pattern-matches against known libraries and structural patterns:

| Category | Detection signals |
|----------|-------------------|
| **slide** | Swiper, Reveal.js, Impress.js, `data-slide` attributes, multiple `<section>` with navigation |
| **chart** | ECharts, Chart.js, D3, Highcharts, Plotly, heavy SVG `<path>` usage (>20 paths) |
| **dashboard** | "dashboard" keyword + grid/flex layouts, panel/metric/KPI patterns |
| **card** | Fixed canvas dimensions (1280/1080/720px), small file (<100 KB), few DOM elements |
| **page** | Default fallback |

Results are cached by file modification time — only changed files are re-read.

## Privacy

- Your files never leave your machine. No network calls, no telemetry.
- Folder access uses the Chrome **File System Access API** — you grant permission per folder, and Chrome can revoke it anytime.
- Pinned paths and hidden paths are stored in `chrome.storage.local`.
- Directory handles are stored in the extension's IndexedDB.

## The old Python CLI (retired)

Earlier versions of HTMLVault shipped as a Python CLI (`pip install htmlvault` → `htmlvault serve` / `htmlvault scan`). **This CLI is retired.** All future development happens in the Chrome extension.

The Python source under `htmlvault/` is kept in the repo for historical reference only:

- The `.py` files are wrapped in docstrings — they import cleanly but export nothing, so `from htmlvault.cli import main` fails at import time.
- `pyproject.toml` is fully commented out, so `pip install .` / `pip install -e .` / `python -m build` will all refuse to produce a package.
- PyPI release `htmlvault==0.1.0` remains available but will not receive updates.

If you specifically need the old CLI, check out an earlier git tag (`<= v0.1.0`) — but you almost certainly don't.

**Why the change?** HTMLVault's target user is someone who just wants to browse their AI-generated HTML files. That user doesn't have Python installed. A Chrome extension removes the entire Python toolchain from the install path and gets us cross-platform for free. Maintaining both forms meant every categorizer tweak had to be written twice.

## Repo layout

```
extension/          ← Chrome MV3 extension (the product)
  manifest.json
  gallery.html / .css / .js
  background.js
  scanner.js
  categorizer.js
  storage.js
  icons/

htmlvault/          ← Retired Python CLI (commented out, kept for history)
pyproject.toml      ← Commented out; repo is no longer a Python package
```

## License

MIT
