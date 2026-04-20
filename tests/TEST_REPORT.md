# HTMLVault Test Report

**Generated**: 2026-04-20  
**Extension version**: 0.1.0  
**Test runner**: Node.js 23 built-in `node:test`  
**Total tests**: 74 automated + 14 manual  
**Automated pass rate**: 74/74 (100%)

## How to run

```bash
# Automated tests only
./tests/run-tests.sh
# or: node --test tests/unit/*.test.js
```

Manual tests (browser-integration items marked 🟡 below) require loading the unpacked extension into Chrome and following the steps in §3.

---

## 1. Coverage by capability

Every feature the extension exposes is listed below. Each row says **what the capability is**, **how it's covered**, and **status**.

### 1.1 Pure logic (covered by automated unit tests)

| # | Capability | File:Function | Test count | Status |
|---|---|---|---|---|
| 1 | Slide detection (10 libs + 10 patterns + 3+ sections w/ nav) | `categorizer.js:_isSlide` | 9 | ✅ |
| 2 | Chart detection (14 libs + >20 SVG paths) | `categorizer.js:_isChart` | 5 | ✅ |
| 3 | Dashboard detection (2+ patterns OR keyword+grids) | `categorizer.js:_isDashboard` | 4 | ✅ |
| 4 | Card detection (fixed width + size + div count) | `categorizer.js:_isCard` | 4 | ✅ |
| 5 | Page fallback | `categorizer.js:categorize` | 2 | ✅ |
| 6 | Category priority order (slide > chart > dashboard > card > page) | `categorizer.js:categorize` | 3 | ✅ |
| 7 | mtime-based cache keyed by `relpath:mtime` | `categorizer.js:_catCache` | 3 | ✅ |
| 8 | Case-insensitive detection | `categorizer.js:categorize` | 1 | ✅ |
| 9 | Special-character / long-content robustness | `categorizer.js:categorize` | 2 | ✅ |
| 10 | HTML escaping (`&`, `<`, `>`, `"`) | `gallery.js:esc` | 4 | ✅ |
| 11 | Short date formatting (MM-DD vs YY-MM-DD for past years) | `gallery.js:shortDate` | 3 | ✅ |
| 12 | File name normalization for version folding | `gallery.js:normalizeName` | 6 | ✅ |
| 13 | Multi-version folding (same folder + same base name) | `gallery.js:foldVersions` | 4 | ✅ |
| 14 | Human-readable file size | `scanner.js:formatSize` | 4 | ✅ |
| 15 | File System Access API feature detection | `gallery.js:isFileSystemAccessSupported` | 3 | ✅ |
| 16 | Unsupported-browser UA detection (Firefox / Safari / fallback) | `gallery.js:renderUnsupportedBrowser` | 3 | ✅ |
| 17 | File filtering (type + case-insensitive search + AND logic) | `gallery.js:getFiltered` | 5 | ✅ |
| 18 | Default excluded folders (`node_modules`, `.git`, `dist`, `.venv`, ...) | `scanner.js:DEFAULT_EXCLUDES` | 2 | ✅ |
| 19 | Minimum file size threshold (500 B) | `scanner.js:MIN_FILE_SIZE` | 1 | ✅ |
| 20 | Chromium license file skip | `scanner.js:SKIP_FILENAMES` | 1 | ✅ |
|   | **Subtotal** | | **74** | **✅ 74/74** |

### 1.2 Browser integration (manual — requires loaded extension)

| # | Capability | Verification step | Status |
|---|---|---|---|
| M1 | Icon click opens gallery tab | Click toolbar icon → new tab with gallery.html opens | 🟡 |
| M2 | `showDirectoryPicker` launches OS folder dialog | Click "Add Folder" → native picker appears | 🟡 |
| M3 | First-time folder permission grant persists in IndexedDB | Add folder → close Chrome → reopen → folder still listed | 🟡 |
| M4 | Permission re-prompt on revoked handle | macOS restart (which sometimes revokes handles) → open gallery → should see "Permission lost" toast | 🟡 |
| M5 | Multi-folder scanning (add 2+ folders, all scanned) | Add two folders → both chips appear in dir-bar → files from both show | 🟡 |
| M6 | Recursive scan with exclude list | Folder with `node_modules/foo.html` → file NOT in gallery | 🟡 |
| M7 | File content truncated at 200 KB for categorization | Large HTML file (>1 MB) → still classifies correctly based on first 200 KB | 🟡 |
| M8 | Full-file read on open (not truncated) | Click card of >200 KB file → new tab shows full content | 🟡 |
| M9 | Blob URL cleanup (no memory leak) | After 100+ scrolls & re-renders, `chrome://extensions → Inspect → Memory` stable | 🟡 |
| M10 | IntersectionObserver lazy-loads iframes | DevTools Network tab: iframe src only set when card scrolls into view | 🟡 |
| M11 | Promise-chain scan lock serializes concurrent scans | Click "Add Folder" mid-scan → second scan queues instead of racing | 🟡 |
| M12 | Search input debounce (150 ms) | Type quickly in search → filter applies after pause, not per keystroke | 🟡 |
| M13 | Load-more pagination (100 items/page) | Folder with 300+ HTML files → see "Show 100 more" button; clicking appends | 🟡 |
| M14 | Pin / unpin persists across sessions | Pin a file → reload gallery → still pinned | 🟡 |
| M15 | Hide file persists; restore via Chrome extension data clear | Hide a file → reload → absent; clear extension data → present again | 🟡 |
| M16 | Copy path writes to clipboard + shows green check for 1 s | Click copy on a card → paste works + button turns green briefly | 🟡 |
| M17 | Grid/List view toggle persists | Switch to list → reload → still list | 🟡 |
| M18 | Group-by folder/type/none toggle persists | Switch group → reload → still grouped same way | 🟡 |
| M19 | Type filter narrows the grid | Click "Charts" tag → only chart-type files show | 🟡 |
| M20 | Multi-version folding (`report.html` + `report-v2.html` collapse) | Drop two similarly-named files into same folder → latest shows, "1 older version" fold hint appears | 🟡 |
| M21 | Fold/unfold toggle with arrow rotation | Click fold hint → old versions expand, arrow rotates 90° | 🟡 |
| M22 | Folder chip × button removes folder after confirm | Click × on chip → confirm dialog → folder removed | 🟡 |
| M23 | Cmd+F focuses search; Esc clears it | Anywhere in gallery: Cmd+F focuses search; Esc clears value and blurs | 🟡 |
| M24 | Empty states (no folders / no matches) show friendly copy | Remove all folders → see "No folders added yet" + hint | 🟡 |

### 1.3 Visual / UX (eyeball verification)

| # | Capability | Verification step | Status |
|---|---|---|---|
| V1 | Dark mode follows `prefers-color-scheme` | Toggle macOS Appearance → gallery colors invert | 🟡 |
| V2 | Responsive layout at ≤600 px wide | Resize window narrow → grid becomes single column, toolbar stacks | 🟡 |
| V3 | Toast animation (fade + translate) | Trigger any toast (e.g., copy) → smooth fade-in bottom center | 🟡 |
| V4 | Copy button checkmark visible feedback | Click copy → green check for 1 s | 🟡 |
| V5 | Scan progress text updates every 50 files | Scan a 1000+ file folder → status text updates smoothly, not per-file | 🟡 |
| V6 | Section headers, badges, chips render correctly | All groupings render without visual overflow | 🟡 |
| V7 | Item hover reveals pin/copy/hide buttons | Hover over card → three action icons fade in top-right | 🟡 |
| V8 | Unsupported-browser screen renders in Firefox | Load extension in Firefox (via temp install) → see Chromium-required screen | 🟡 |
| V9 | Icons (16/48/128) display at correct sizes | Check Chrome toolbar, extensions list, detail page | 🟡 |
| V10 | Filter tag "active" highlight | Click a type filter → blue background, others gray | 🟡 |

**Legend**: ✅ automated pass · 🟡 manual test required · ❌ fail

---

## 2. Automated test summary

```
tests 74
suites 20
pass 74
fail 0
duration_ms ~75
```

Zero flakes across 3 consecutive runs.

### Test files

```
tests/
  run-tests.sh                      ← one-command runner
  helpers/
    load-module.js                  ← loads extension JS into node:vm sandbox
  unit/
    categorizer.test.js             ← 34 tests (§1.1 rows 1–9)
    gallery-helpers.test.js         ← 32 tests (§1.1 rows 10–17)
    scanner.test.js                 ← 8 tests  (§1.1 rows 14, 18–20)
```

---

## 3. Manual test script

Copy-paste this into your browser and follow the steps. Takes about 10 minutes. Mark 🟡 rows above as ✅ or ❌ as you go.

**Setup**:

1. Unzip `dist/htmlvault-0.1.0.zip` into `~/test-htmlvault/`
2. `chrome://extensions` → Developer mode ON → Load unpacked → select `~/test-htmlvault/`
3. Pin HTMLVault to toolbar

**Test folder prep** (once):

```bash
mkdir -p /tmp/htmlvault-test/{slides,charts,dashboards,cards,pages,node_modules,.git}
# Slides
cat > /tmp/htmlvault-test/slides/deck.html <<EOF
<!doctype html><html><head><script src="reveal.js"></script></head><body></body></html>
EOF
# Charts
cat > /tmp/htmlvault-test/charts/trend.html <<EOF
<!doctype html><html><body><script>echarts.init(document.body)</script></body></html>
EOF
# Card
cat > /tmp/htmlvault-test/cards/hero.html <<EOF
<!doctype html><html><body><div style="width:1280px"><div>hi</div></div></body></html>
EOF
# Pages
cat > /tmp/htmlvault-test/pages/article.html <<EOF
<!doctype html><html><body><h1>Hello</h1><p>world.</p></body></html>
EOF
# Should be excluded
cat > /tmp/htmlvault-test/node_modules/vendor.html <<EOF
<!doctype html><html><body>library</body></html>
EOF
# File under 500 B should be skipped
echo "<html>tiny</html>" > /tmp/htmlvault-test/pages/tiny.html
# Two versions — should fold
echo "$(cat /tmp/htmlvault-test/pages/article.html) <!-- v1 -->" > /tmp/htmlvault-test/pages/article-v1.html
echo "$(cat /tmp/htmlvault-test/pages/article.html) <!-- v2 -->" > /tmp/htmlvault-test/pages/article-v2.html
```

**Run through §1.2 and §1.3 rows** against `/tmp/htmlvault-test/`. Expected highlights:

- 1 slide, 1 chart, 1 card, 3 pages (article + article-v1/v2 folded into one group)
- `node_modules/vendor.html` absent
- `pages/tiny.html` absent (size < 500 B)
- Total after folding: 5 visible items; click fold toggle to see v1/v2

---

## 4. Known gaps

Things NOT covered by this report and why:

- **iframe sandbox CSP boundary** — the extension uses `<iframe sandbox>` with no `allow-scripts`. Verifying that no malicious preview content can escape the sandbox requires a security fuzz test beyond this scope.
- **IndexedDB corruption recovery** — if Chrome's IndexedDB storage is corrupted, the code falls back to an empty handle list with a console warning. Not tested because reproducing corruption is nondeterministic.
- **Chrome service-worker lifecycle** — `background.js` is 4 lines and only handles one event. If Chrome kills the service worker between icon clicks (it can), a fresh worker spins up. No test for this.
- **File > 2 GB** — File System Access API behavior on multi-GB files isn't validated; the categorizer only reads first 200 KB anyway, but the preview iframe may OOM.
- **Concurrent IndexedDB writes** — if the user clicks pin/unpin very fast, `chrome.storage.local.set` calls race. The last-write-wins behavior is by design.

## 5. Recommendations for next round

If you want to push coverage higher:

1. **Add Playwright E2E tests** against a real Chrome instance with the extension loaded. The File System Access prompt can be auto-accepted via Chrome's `--enable-file-cookies` + a pre-granted origin list. This would automate most of §1.2 rows M1–M24.
2. **Snapshot tests for `renderItem()`** — compare generated HTML against a golden file to catch accidental markup changes.
3. **Fuzz test `categorize()`** with 1000 random real-world HTML files (scrape HN top 500 + random GitHub Pages) and inspect the distribution. Would uncover heuristic drift.
4. **Accessibility audit** — run Lighthouse or axe-core against `gallery.html`. The contrast fixes from batch 3 should pass WCAG AA; verify.

---

## 6. Appendix — What each automated test asserts

See the three test files directly; each `test(...)` block is a single assertion with a descriptive name, so you can `grep -n "test(" tests/unit/*.test.js` for the full list.
