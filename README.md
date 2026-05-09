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

HTMLVault is not on the Chrome Web Store. You install it from a GitHub release zip via Chrome's "Load unpacked" feature. Takes about a minute.

> ⚠️ **You'll see a yellow "Developer mode extensions" banner in Chrome**
> every time you launch. That's Chrome's standard warning for extensions
> installed outside the Web Store — it's not a bug and it's not dangerous.
> Click the **×** to dismiss. **Do not** click "Disable" or HTMLVault
> will stop working.

### Step-by-step

1. Go to the [Releases page](https://github.com/makinotes/htmlvault/releases) and download the latest `htmlvault-<version>.zip`.
2. **Unzip it** into a folder you won't delete (e.g. `~/Applications/htmlvault/` on macOS, `C:\Tools\htmlvault\` on Windows). Keep the whole folder — moving or deleting it later will break the extension.
3. Open `chrome://extensions` in Chrome (or Edge/Brave/Arc — same URL works).
4. Turn on the **Developer mode** toggle in the top-right corner.
5. Click **Load unpacked** and select the folder you unzipped in step 2 (pick the folder, not the zip).
6. HTMLVault appears in the extensions list. Click the puzzle icon in the Chrome toolbar and **pin** HTMLVault so its icon stays visible.

Done. Click the icon any time to open the gallery.

### Updating

1. Download the new `htmlvault-<version>.zip` from Releases.
2. Unzip it into the **same folder** as before, overwriting the old files.
3. Go back to `chrome://extensions` and click the **🔄 reload icon** on the HTMLVault card.

Your pinned files, hidden files, and added folders are preserved across updates — they live in Chrome's storage, not in the extension files.

### Uninstall

Go to `chrome://extensions`, find HTMLVault, and click **Remove**. Then delete the unzipped folder.

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

## Known limitations

- Categorization reads only the first 200 KB of each file — very large or unusual HTML may land in the wrong category.
- First scan of a deeply nested folder takes a few seconds; cached after that.
- No manual tags, collections, or notes — just pin / hide / search.
- Chromium-only. Safari and Firefox don't expose the File System Access API.

## Roadmap

Possible directions if there's interest:

- Manual tags or collections beyond the auto-categorizer
- Export a folder's gallery as a static HTML index
- Inline preview without opening files
- Better signal extraction from titles / first paragraphs

## Contributing

I'm not actively maintaining this — it solved a problem for me and now it's out there. If something is broken or you want a feature, PRs are the fastest path forward. Issues are fine but I may not get to them quickly.

## The old Python CLI (retired)

Earlier versions of HTMLVault shipped as a Python CLI (`pip install htmlvault` → `htmlvault serve` / `htmlvault scan`). **This CLI is retired.** All future development happens in the Chrome extension.

- The `htmlvault/` package and `pyproject.toml` have been removed from the working tree. If you specifically need the old CLI, check out commit `4fd67a1` (the last live-Python commit before retirement) or any earlier commit.
- PyPI release `htmlvault==0.1.0` remains available but will not receive updates.

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

package.sh          ← Build a release zip from extension/
tests/              ← Node unit tests for the extension's pure logic
```

## For maintainers — releasing a new version

1. Bump `version` in `extension/manifest.json`.
2. Run `./package.sh` — produces `dist/htmlvault-<version>.zip`.
3. Smoke-test locally: unzip to a fresh dir and Load unpacked in a clean Chrome profile.
4. `gh release create v<version> dist/htmlvault-<version>.zip --title "HTMLVault v<version>" --notes-file CHANGELOG.md`

The zip contains only the files under `extension/` with `manifest.json` at the archive root — that's the layout Chrome requires.

## License

MIT
