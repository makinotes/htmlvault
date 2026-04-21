// HTMLVault Extension — Gallery main logic.
// Rewritten with event delegation (MV3 CSP compliant — no inline handlers).

const ICONS = {
  slide: { bg: '#faf8ff', svg: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>' },
  chart: { bg: '#f0fdf4', svg: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="1.5"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 5-5"/></svg>' },
  dashboard: { bg: '#f0f6ff', svg: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="4" rx="1"/><rect x="14" y="10" width="7" height="11" rx="1"/><rect x="3" y="13" width="7" height="8" rx="1"/></svg>' },
  card: { bg: '#fffbf5', svg: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c2410c" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/></svg>' },
  page: { bg: '#fafafa', svg: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>' },
};
const SVG_PIN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M16 2l-4 4-5-2-3 3 4 5-6 6h2l4-4 5 4 3-3-2-5 4-4-2-4z"/></svg>';
const SVG_PIN_OUTLINE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 2l-4 4-5-2-3 3 4 5-6 6h2l4-4 5 4 3-3-2-5 4-4-2-4z"/></svg>';
const SVG_TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg>';
const SVG_COPY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
const SVG_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>';

// -- State --
let FILES = [];
let PINS = [];
let HIDDEN = [];
let view = 'grid';
let groupBy = 'folder';
let typeFilter = 'all';
let _observer = null;
let _previewUrls = new Map(); // cache: relpath -> blob URL (truncated, for preview only)
let _scanLock = Promise.resolve(); // P1 fix: Promise-chain scan lock (replaces _scanning bool)
let _foldCounter = 0;           // P2-10: unique fold IDs
let _searchTimer = null;        // P1 fix: debounce search input

// -- Init --
// P2 fix: feature-detect the File System Access API so users on unsupported
// browsers (Safari, Firefox — which can technically side-load a Chromium
// extension via wrappers, but lack showDirectoryPicker) see a clear message
// instead of a dead "Add Folder" button.
function isFileSystemAccessSupported() {
  return typeof window.showDirectoryPicker === 'function';
}

function renderUnsupportedBrowser() {
  const el = document.getElementById('content');
  if (!el) return;
  // Best-effort browser name for the message.
  const ua = navigator.userAgent;
  let name = 'your browser';
  if (/Firefox\//.test(ua)) name = 'Firefox';
  else if (/Version\/[\d.]+.*Safari\//.test(ua) && !/Chrome|Chromium|Edg/.test(ua)) name = 'Safari';

  el.innerHTML =
    '<div class="empty unsupported">' +
      '<h2>HTMLVault needs a Chromium-based browser</h2>' +
      '<p class="empty-hint">' +
        name + ' does not support the File System Access API ' +
        '(<code>window.showDirectoryPicker</code>), which HTMLVault uses ' +
        'to read local folders. Nothing on this page will work here.' +
      '</p>' +
      '<p class="empty-hint">' +
        'Please use one of these instead:' +
      '</p>' +
      '<ul class="empty-list">' +
        '<li>Google Chrome (Windows, macOS, Linux, ChromeOS)</li>' +
        '<li>Microsoft Edge (Windows, macOS, Linux)</li>' +
        '<li>Brave, Arc, Opera, Vivaldi (all Chromium-based)</li>' +
      '</ul>' +
      '<p class="empty-hint">' +
        'Mobile browsers are not supported — HTMLVault is desktop-only.' +
      '</p>' +
    '</div>';
  // Also hide the toolbar / dir-bar since they would be useless.
  const tb = document.getElementById('toolbar');
  if (tb) tb.style.display = 'none';
  const bar = document.getElementById('dir-bar');
  if (bar) bar.style.display = 'none';
  const sub = document.getElementById('subtitle');
  if (sub) sub.textContent = 'Unsupported browser';
}

async function init() {
  // P2 fix: hard stop on unsupported browsers — every downstream call
  // (showDirectoryPicker, scanDirectory) would fail silently otherwise.
  if (!isFileSystemAccessSupported()) {
    renderUnsupportedBrowser();
    return;
  }

  const settings = await getSettings();
  view = settings.view || 'grid';
  groupBy = settings.groupBy || 'folder';
  PINS = await getPins();
  HIDDEN = await getHiddenFiles();

  // Restore button states
  document.querySelectorAll('#view-btns .gbtn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  document.querySelectorAll('#group-btns .gbtn').forEach(b => {
    b.classList.toggle('active', b.dataset.group === groupBy);
  });

  // Load saved directory handles
  const handles = await loadDirectoryHandles();
  renderDirBar(handles);

  if (handles.length > 0) {
    await scanAll(handles);
  }

  // -- Event binding (all via addEventListener, no inline handlers) --
  // P0 fix: bind event delegation FIRST, before any element may be missing,
  // so dynamic buttons (e.g. "Add Another Folder") always work.
  document.getElementById('content').addEventListener('click', handleContentClick);

  const searchEl = document.getElementById('search');
  if (searchEl) {
    // P1 fix: debounce to avoid O(n) filter on every keystroke at 5k+ files
    searchEl.addEventListener('input', () => {
      clearTimeout(_searchTimer);
      _searchTimer = setTimeout(() => render(), 150);
    });
  }

  // P0 fix: #empty-add-btn only exists in the initial HTML; scanAll() replaces
  // #content before this line runs, so the element is often gone. Guard null
  // to prevent init from crashing (which previously killed all later bindings).
  const emptyAddBtn = document.getElementById('empty-add-btn');
  if (emptyAddBtn) emptyAddBtn.addEventListener('click', addFolder);

  document.querySelectorAll('#group-btns .gbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      groupBy = btn.dataset.group;
      document.querySelectorAll('#group-btns .gbtn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setSettings({ view, groupBy });
      render();
    });
  });

  document.querySelectorAll('#view-btns .gbtn').forEach(btn => {
    btn.addEventListener('click', () => {
      view = btn.dataset.view;
      document.querySelectorAll('#view-btns .gbtn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setSettings({ view, groupBy });
      render();
    });
  });

  // (Event delegation for #content was moved to the top of Event binding above.)

  // P2 fix: keyboard shortcuts — Cmd/Ctrl+F focuses search, Esc clears it.
  document.addEventListener('keydown', (ev) => {
    // Cmd+F (mac) or Ctrl+F (win/linux) — focus search
    if ((ev.metaKey || ev.ctrlKey) && ev.key === 'f') {
      const s = document.getElementById('search');
      if (s) {
        ev.preventDefault();
        s.focus();
        s.select();
      }
      return;
    }
    // Esc — clear search if it has content or is focused
    if (ev.key === 'Escape') {
      const s = document.getElementById('search');
      if (s && (document.activeElement === s || s.value)) {
        s.value = '';
        s.blur();
        render();
      }
    }
  });
}

// P0-1: Central event delegation handler for all dynamic elements
async function handleContentClick(ev) {
  // Find the closest actionable element
  const btn = ev.target.closest('[data-action]');
  if (btn) {
    ev.preventDefault();
    ev.stopPropagation();
    const action = btn.dataset.action;
    const relpath = btn.dataset.relpath;
    const foldTarget = btn.dataset.foldTarget;

    if (action === 'open') await openFile(relpath);
    else if (action === 'pin') await togglePin(relpath);
    else if (action === 'copy') copyPath(relpath, btn);
    else if (action === 'hide') await hideFile(relpath);
    else if (action === 'fold') toggleFold(foldTarget, btn);
    else if (action === 'load-more') loadMoreInSection(btn);
    else if (action === 'add-folder') addFolder();
    return;
  }

  // Click on item-thumb or item-title opens file
  const thumb = ev.target.closest('.item-thumb');
  if (thumb) {
    const item = thumb.closest('.item');
    const rp = item && item.dataset.relpath;
    if (rp) { ev.preventDefault(); await openFile(rp); }
    return;
  }
  const title = ev.target.closest('.item-title');
  if (title) {
    const item = title.closest('.item');
    const rp = item && item.dataset.relpath;
    if (rp) { ev.preventDefault(); await openFile(rp); }
    return;
  }
  // List view: click on item-body opens file
  const body = ev.target.closest('.item-body');
  if (body && view === 'list') {
    const item = body.closest('.item');
    const rp = item && item.dataset.relpath;
    if (rp) { ev.preventDefault(); await openFile(rp); }
  }
}

// -- Scanning --
// P1 fix: Promise-chain lock so concurrent scanAll() calls (e.g. addFolder
// during an in-flight scan) serialize instead of either aborting or racing.
function scanAll(handles) {
  _scanLock = _scanLock.then(() => _scanAllInner(handles)).catch((e) => {
    console.error('scanAll failed:', e);
  });
  return _scanLock;
}

// P1 fix: yield to the UI between heavy chunks so the main thread can paint.
function _yield() {
  return new Promise((r) => setTimeout(r, 0));
}

async function _scanAllInner(handles) {
  // P1-4: cleanup old preview blob URLs
  for (const url of _previewUrls.values()) URL.revokeObjectURL(url);
  _previewUrls.clear();
  // P2-6: clear categorizer cache
  _catCache.clear();

  const el = document.getElementById('content');
  el.innerHTML = '<div class="scanning"><div class="scanning-spinner"></div><p>Scanning directories...</p></div>';

  FILES = [];
  let validHandles = [];
  const lostHandles = [];

  for (const record of handles) {
    const handle = record.handle;
    const ok = await verifyPermission(handle);
    if (!ok) {
      // P1 fix: track lost handles for a single, clearer end-of-scan message
      lostHandles.push(record.id);
      continue;
    }
    validHandles.push(record);

    const files = await scanDirectory(handle, record.id, (count) => {
      const p = el.querySelector('p');
      if (p) p.textContent = 'Scanning... ' + count + ' files found';
    });

    // P1 fix: categorize in chunks + yield, so 2k-file folders don't freeze UI.
    const CHUNK = 20;
    for (let i = 0; i < files.length; i += CHUNK) {
      const slice = files.slice(i, i + CHUNK);
      for (const f of slice) {
        const content = await readFileContent(f._fileHandle);
        f.type = categorize(content, f.size, f.relpath + ':' + f.mtime);
        f.size_fmt = formatSize(f.size);
      }
      // Update status after each chunk and let the browser paint.
      const p = el.querySelector('p');
      if (p) p.textContent = 'Categorizing... ' + Math.min(i + CHUNK, files.length) + '/' + files.length + ' in ' + record.id;
      await _yield();
    }

    FILES = FILES.concat(files);
  }

  // Filter hidden files — Set for O(n) instead of O(n×m) on power-user sets.
  const hiddenSet = new Set(HIDDEN);
  FILES = FILES.filter(f => !hiddenSet.has(f.relpath));
  FILES.sort((a, b) => b.mtime - a.mtime);

  const subtitle = validHandles.map(h => h.id).join(', ') + ' \u2014 ' + FILES.length + ' files';
  document.getElementById('subtitle').textContent = subtitle;

  // P1 fix: single informative toast about permission loss after scan settles.
  if (lostHandles.length) {
    toast('Permission lost for: ' + lostHandles.join(', ') + '. Remove the chip and re-add the folder to restore access.');
  }

  if (FILES.length > 0) {
    document.getElementById('toolbar').style.display = '';
    buildTypeFilters();
    render();
  } else {
    el.innerHTML = '<div class="empty"><p>No HTML files found yet.</p>' +
      '<p class="empty-hint">Pick a folder that contains <code>.html</code> or <code>.htm</code> files (at least 500 B each). Subfolders are scanned automatically.</p>' +
      '<button class="empty-btn" data-action="add-folder">Add Another Folder</button></div>';
  }
}

// -- Add / remove folder --
async function addFolder() {
  // P2 fix: defensive check — init() already hard-stops on unsupported
  // browsers, but if addFolder somehow fires (e.g. from a lingering bound
  // handler), give the user a real explanation instead of a silent catch.
  if (!isFileSystemAccessSupported()) {
    toast('This browser does not support folder picking. Use Chrome, Edge, Brave, or Arc.');
    return;
  }
  let dirHandle;
  try {
    dirHandle = await window.showDirectoryPicker({ mode: 'read' });
  } catch (e) {
    // User cancelled the picker, or the API threw a security error.
    // NotAllowedError / SecurityError have meaningful messages; cancellation
    // raises AbortError which we intentionally swallow.
    if (e && e.name && e.name !== 'AbortError') {
      toast('Could not open folder picker: ' + e.name);
    }
    return;
  }

  // P1-2: handle name collision — append timestamp if duplicate
  let name = dirHandle.name;
  const existing = await loadDirectoryHandles();
  if (existing.some(h => h.id === name)) {
    name = name + '-' + Date.now();
  }
  const saved = await saveDirectoryHandle(name, dirHandle);
  if (!saved) {
    // IndexedDB blocked (incognito / policy / quota). Don't lie to the user —
    // a reload would lose the folder. Abort so they can retry.
    toast('Could not save folder: browser storage is blocked. Try a regular (non-incognito) window.');
    return;
  }
  toast('Added: ' + dirHandle.name);

  const handles = await loadDirectoryHandles();
  renderDirBar(handles);
  await scanAll(handles);
}

async function removeFolder(name) {
  await removeDirectoryHandle(name);
  const handles = await loadDirectoryHandles();
  renderDirBar(handles);
  if (handles.length > 0) {
    await scanAll(handles);
  } else {
    FILES = [];
    document.getElementById('toolbar').style.display = 'none';
    document.getElementById('subtitle').textContent = '';
    document.getElementById('content').innerHTML = '<div class="empty"><p>No folders added yet.</p>' +
      '<p class="empty-hint">HTMLVault scans local folders for <code>.html</code> / <code>.htm</code> files and shows them here. Your files never leave your machine.</p>' +
      '<button class="empty-btn" data-action="add-folder">Add Folder</button></div>';
  }
}

function renderDirBar(handles) {
  const bar = document.getElementById('dir-bar');
  if (!handles || handles.length === 0) {
    bar.innerHTML = '';
    const addBtn = document.createElement('span');
    addBtn.className = 'dir-add-btn';
    addBtn.textContent = '+ Add folder';
    addBtn.addEventListener('click', addFolder);
    bar.appendChild(addBtn);
    return;
  }
  // Build with DOM to avoid inline handlers
  bar.innerHTML = '';
  handles.forEach(h => {
    const chip = document.createElement('span');
    chip.className = 'dir-chip';
    chip.textContent = h.id;
    // P2-8: always show remove button (even for single dir)
    const rm = document.createElement('span');
    rm.className = 'dir-remove';
    rm.textContent = '\u00d7';
    rm.addEventListener('click', () => {
      if (confirm('Remove ' + h.id + ' from scan?')) removeFolder(h.id);
    });
    chip.appendChild(rm);
    bar.appendChild(chip);
  });
  const addBtn = document.createElement('span');
  addBtn.className = 'dir-add-btn';
  addBtn.textContent = '+ Add folder';
  addBtn.addEventListener('click', addFolder);
  bar.appendChild(addBtn);
}

// -- Helpers --
// Full HTML entity escape: & < > " '  — single-quote matters if any future
// change moves user-controlled output into a single-quoted attribute.
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;'); }

// P2-4: show year for old files
function shortDate(ts) {
  const d = new Date(ts * 1000);
  const now = new Date();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  if (d.getFullYear() !== now.getFullYear()) {
    return String(d.getFullYear()).slice(2) + '-' + mm + '-' + dd;
  }
  return mm + '-' + dd;
}

function isPinned(relpath) { return PINS.indexOf(relpath) !== -1; }

function getFiltered() {
  // Null-guard: render() can fire from storage callbacks before init() finishes
  // wiring up the search input, so #search may not exist yet.
  const searchEl = document.getElementById('search');
  const q = searchEl ? searchEl.value.toLowerCase() : '';
  // Pre-compute a Set for O(1) hidden lookup instead of O(n×m) includes().
  // (HIDDEN is already applied at scan time, but this guards future call sites.)
  return FILES.filter(f => {
    if (typeFilter !== 'all' && f.type !== typeFilter) return false;
    if (q && f.name.toLowerCase().indexOf(q) === -1 && f.relpath.toLowerCase().indexOf(q) === -1) return false;
    return true;
  });
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2500);
}

function buildTypeFilters() {
  const counts = {};
  FILES.forEach(f => { counts[f.type] = (counts[f.type] || 0) + 1; });
  const el = document.getElementById('type-filters');
  let html = '<div class="ftag active" data-f="all">All<span class="cnt">' + FILES.length + '</span></div>';
  ['slide','chart','dashboard','card','page'].forEach(t => {
    if (counts[t]) html += '<div class="ftag" data-f="'+t+'">'+t.charAt(0).toUpperCase()+t.slice(1)+'s<span class="cnt">'+counts[t]+'</span></div>';
  });
  el.innerHTML = html;
  el.querySelectorAll('.ftag').forEach(tag => {
    tag.addEventListener('click', () => {
      typeFilter = tag.dataset.f;
      el.querySelectorAll('.ftag').forEach(t => t.classList.remove('active'));
      tag.classList.add('active');
      render();
    });
  });
}

// -- Actions (P1-1: always read full file for open, not truncated cache) --
// NOTE: "Open" deliberately drops all iframe sandboxing — the blob: tab runs
// the user's HTML with full browser privileges so that charts/slides work.
// This is acceptable because the user chose to scan these directories and
// clicked the file. Do NOT import this pattern for preview thumbnails, which
// run inside bare-`sandbox` iframes.
async function openFile(relpath) {
  const f = FILES.find(x => x.relpath === relpath);
  if (!f) return;
  const url = await readFileAsBlobUrl(f._fileHandle);
  if (url) {
    window.open(url, '_blank');
    // Revoke after a delay to let the new tab load
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

function copyPath(relpath, btn) {
  navigator.clipboard.writeText(relpath).then(() => {
    toast('Path copied');
    // P2 fix: inline visual feedback on the button itself — toast alone is
    // easy to miss when the user is mid-scan or scrolling.
    if (btn) {
      const original = btn.innerHTML;
      btn.innerHTML = SVG_CHECK;
      btn.classList.add('copied');
      clearTimeout(btn._copyTimer);
      btn._copyTimer = setTimeout(() => {
        btn.innerHTML = original;
        btn.classList.remove('copied');
      }, 1000);
    }
  }).catch((e) => {
    console.warn('Copy failed:', e);
    toast('Copy failed — clipboard permission denied');
  });
}

async function togglePin(relpath) {
  if (isPinned(relpath)) {
    PINS = PINS.filter(p => p !== relpath);
  } else {
    PINS.push(relpath);
  }
  await setPins(PINS);
  render();
}

// P1-8: honest confirm text — no mention of non-existent settings
async function hideFile(relpath) {
  if (!confirm('Hide "' + relpath + '" from the gallery?\n\nTo restore, clear extension data in chrome://extensions.')) return;
  HIDDEN.push(relpath);
  const res = await setHiddenFiles(HIDDEN);
  if (res && res.truncated) {
    // Oldest hidden entries were dropped to stay under quota. Keep state
    // in sync with what was actually persisted so reload doesn't diverge.
    HIDDEN = HIDDEN.slice(-5000);
    toast('Hidden list hit the 5000 limit — oldest entries dropped.');
  }
  FILES = FILES.filter(f => f.relpath !== relpath);
  render();
  toast('Hidden: ' + relpath);
}

// -- Render (P0-1: data-action attributes instead of onclick) --
async function getPreviewUrl(f) {
  if (_previewUrls.has(f.relpath)) return _previewUrls.get(f.relpath);
  // Read content for preview (may be truncated, that's OK for preview)
  const content = await readFileContent(f._fileHandle);
  if (!content) return '';
  const blob = new Blob([content], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  _previewUrls.set(f.relpath, url);
  return url;
}

function renderItem(f) {
  const ic = ICONS[f.type] || ICONS.page;
  const pinCls = isPinned(f.relpath) ? 'pinned' : '';
  const pinSvg = isPinned(f.relpath) ? SVG_PIN : SVG_PIN_OUTLINE;
  const rp = esc(f.relpath);

  if (view === 'grid') {
    return '<div class="item" data-relpath="' + rp + '">' +
      '<div class="item-thumb" style="background:' + ic.bg + '">' +
        '<div class="icon-fallback">' + ic.svg + '</div>' +
        '<iframe data-relpath="' + rp + '" sandbox loading="lazy"></iframe>' +
      '</div>' +
      '<div class="item-body">' +
        '<div class="item-row">' +
          '<span class="item-title">' + esc(f.name) + '</span>' +
          '<button class="icon-btn pin-btn ' + pinCls + '" data-action="pin" data-relpath="' + rp + '" title="Pin">' + pinSvg + '</button>' +
          '<button class="icon-btn" data-action="copy" data-relpath="' + rp + '" title="Copy path">' + SVG_COPY + '</button>' +
          '<button class="icon-btn del-btn" data-action="hide" data-relpath="' + rp + '" title="Hide">' + SVG_TRASH + '</button>' +
        '</div>' +
        '<div class="item-meta">' +
          '<span class="badge badge-' + f.type + '">' + f.type + '</span>' +
          '<span class="item-path">' + esc(f.relpath) + '</span>' +
          '<span class="item-date">' + shortDate(f.mtime) + '</span>' +
        '</div>' +
      '</div></div>';
  } else {
    return '<div class="item" data-relpath="' + rp + '">' +
      '<div class="item-body">' +
        '<span class="badge badge-' + f.type + '">' + f.type + '</span>' +
        '<span class="item-title">' + esc(f.name) + '</span>' +
        '<span class="item-meta">' +
          '<span class="item-path">' + esc(f.relpath) + '</span>' +
          '<span class="item-size">' + f.size_fmt + '</span>' +
          '<span class="item-date">' + shortDate(f.mtime) + '</span>' +
        '</span>' +
      '</div>' +
      '<button class="icon-btn pin-btn ' + pinCls + '" data-action="pin" data-relpath="' + rp + '" title="Pin">' + pinSvg + '</button>' +
      '<button class="icon-btn" data-action="copy" data-relpath="' + rp + '" title="Copy path">' + SVG_COPY + '</button>' +
      '<button class="icon-btn del-btn" data-action="hide" data-relpath="' + rp + '" title="Hide">' + SVG_TRASH + '</button>' +
    '</div>';
  }
}

function render() {
  // P1-4: revoke old preview URLs before re-render
  for (const url of _previewUrls.values()) URL.revokeObjectURL(url);
  _previewUrls.clear();

  const filtered = getFiltered();
  document.getElementById('stats').textContent = filtered.length + ' files';
  const el = document.getElementById('content');

  if (!filtered.length) { el.innerHTML = '<div class="empty">No files match.</div>'; return; }

  const pinned = filtered.filter(f => isPinned(f.relpath));
  const unpinned = filtered.filter(f => !isPinned(f.relpath));

  const now = Date.now() / 1000;
  const WEEK = 7 * 86400;
  const recent = unpinned.filter(f => (now - f.mtime) < WEEK);
  const older = unpinned.filter(f => (now - f.mtime) >= WEEK);

  _foldCounter = 0; // P2-10: reset fold counter per render
  // P1 fix: reset section paging state each render so stale section ids
  // (from previous groupBy/filter changes) don't accumulate in the Map.
  _sectionCounter = 0;
  _sectionState.clear();
  let html = '';
  el.className = 'content view-' + view;

  if (groupBy === 'none') {
    if (pinned.length) html += renderSection('Pinned', pinned);
    if (recent.length) html += renderSection('Recent', recent);
    if (older.length) html += renderSection('Older', older);
  } else {
    if (pinned.length) html += renderSection('Pinned', pinned);

    const groupKey = groupBy === 'folder' ? 'folder' : 'type';
    const groups = {};
    unpinned.forEach(f => {
      const k = f[groupKey] || '.';
      if (!groups[k]) groups[k] = [];
      groups[k].push(f);
    });
    // Reduce form — Math.max(...arr) can exceed the call-stack arg limit on
    // folders with 2000+ same-group files (V8 caps at ~65536 args but the cap
    // has bitten users at lower numbers on some builds).
    const maxMtime = (arr) => arr.reduce((m, f) => f.mtime > m ? f.mtime : m, 0);
    const keys = Object.keys(groups).sort((a,b) => maxMtime(groups[b]) - maxMtime(groups[a]));
    keys.forEach(k => {
      const label = groupBy === 'type' ? k.charAt(0).toUpperCase() + k.slice(1) + 's' : k;
      const gRecent = groups[k].filter(f => (now - f.mtime) < WEEK);
      const gOlder = groups[k].filter(f => (now - f.mtime) >= WEEK);
      if (!gOlder.length || !gRecent.length) {
        html += renderSection(label, groups[k]);
      } else {
        html += renderSection(label + ' \u2014 Recent', gRecent);
        html += renderSection(label + ' \u2014 Older', gOlder);
      }
    });
  }

  el.innerHTML = html;

  // Lazy-load iframes: read file content on intersect, set blob URL.
  // Each entry is processed in its own async task with try/catch so a single
  // bad file (permission revoked mid-render, handle invalidated by rescan)
  // doesn't leak an unhandled rejection or break the observer.
  if (_observer) _observer.disconnect();
  _observer = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const iframe = e.target;
      _observer.unobserve(iframe);
      (async () => {
        try {
          const relpath = iframe.dataset.relpath;
          if (!relpath || iframe.src) return;
          const f = FILES.find(x => x.relpath === relpath);
          if (!f) return;
          const url = await getPreviewUrl(f);
          if (!url) return;
          iframe.src = url;
          iframe.addEventListener('load', () => {
            const thumb = iframe.closest('.item-thumb');
            if (thumb) thumb.classList.add('loaded');
          }, { once: true });
        } catch (err) {
          console.warn('preview load failed:', err);
        }
      })();
    });
  }, { rootMargin: '200px' });
  el.querySelectorAll('iframe[data-relpath]').forEach(f => _observer.observe(f));
}

// -- Section paging state --
// P1 fix: avoid one-shot 10k-item innerHTML by paging each section.
// Key = section DOM id, value = { folded: [...], shown: N }.
const PAGE_SIZE = 100;
let _sectionCounter = 0;
const _sectionState = new Map();

function renderSection(title, files) {
  const sorted = [...files].sort((a,b) => b.mtime - a.mtime);
  const folded = foldVersions(sorted);
  const sid = 'sec-' + (_sectionCounter++);
  const shown = Math.min(PAGE_SIZE, folded.length);
  _sectionState.set(sid, { folded, shown });

  let body = folded.slice(0, shown).map(renderFoldedItem).join('');
  if (shown < folded.length) {
    body += _renderLoadMore(sid, folded.length - shown);
  }
  return '<div class="section" id="' + sid + '">' +
    '<div class="section-header"><h2>' + esc(title) + '</h2><span class="section-count">' + files.length + '</span></div>' +
    '<div class="items" data-section="' + sid + '">' + body + '</div>' +
  '</div>';
}

function _renderLoadMore(sid, remaining) {
  const next = Math.min(PAGE_SIZE, remaining);
  return '<div class="load-more" data-action="load-more" data-section="' + sid + '">' +
    'Show ' + next + ' more (' + remaining + ' remaining)' +
    '</div>';
}

// P1 fix: append the next page without re-rendering the whole section —
// O(page) DOM work instead of O(total).
function loadMoreInSection(btn) {
  const sid = btn.dataset.section;
  const state = _sectionState.get(sid);
  if (!state) return;
  const container = document.querySelector('.items[data-section="' + sid + '"]');
  if (!container) return;

  const nextShown = Math.min(state.shown + PAGE_SIZE, state.folded.length);
  const slice = state.folded.slice(state.shown, nextShown);
  state.shown = nextShown;

  // Insert new items just before the load-more button.
  const tmp = document.createElement('div');
  tmp.innerHTML = slice.map(renderFoldedItem).join('');
  const frag = document.createDocumentFragment();
  while (tmp.firstChild) frag.appendChild(tmp.firstChild);
  container.insertBefore(frag, btn);

  // Update or remove load-more button.
  const remaining = state.folded.length - state.shown;
  if (remaining <= 0) {
    btn.remove();
  } else {
    const next = Math.min(PAGE_SIZE, remaining);
    btn.textContent = 'Show ' + next + ' more (' + remaining + ' remaining)';
  }

  // Observe newly inserted iframes for lazy loading.
  if (_observer) {
    container.querySelectorAll('iframe[data-relpath]').forEach(f => {
      if (!f.src) _observer.observe(f);
    });
  }
}

// -- Multi-version folding --
function normalizeName(name) {
  return name
    .replace(/[-_]v?\d+$/i, '')
    .replace(/[-_](final|draft|old|new|backup|copy|rev\d*)$/i, '')
    .replace(/\s*\(\d+\)$/, '')
    .replace(/[-_]?\d{8,}$/, '')
    .toLowerCase();
}

function foldVersions(files) {
  const groups = [];
  const used = new Set();
  for (let i = 0; i < files.length; i++) {
    if (used.has(i)) continue;
    const f = files[i];
    const base = normalizeName(f.name);
    const cluster = [f];
    used.add(i);
    for (let j = i + 1; j < files.length; j++) {
      if (used.has(j)) continue;
      const g = files[j];
      if (g.folder === f.folder && normalizeName(g.name) === base && base.length > 2) {
        cluster.push(g);
        used.add(j);
      }
    }
    groups.push(cluster);
  }
  return groups;
}

function renderFoldedItem(cluster) {
  if (cluster.length === 1) return renderItem(cluster[0]);
  const latest = cluster[0];
  const rest = cluster.slice(1);
  // P2-10: use counter for unique fold IDs
  const foldId = 'fold-' + (_foldCounter++);
  let html = '<div class="item-fold">';
  html += renderItem(latest);
  html += '<div class="fold-toggle" data-action="fold" data-fold-target="' + foldId + '">' +
    '<span class="fold-arrow">&#9654;</span> ' + rest.length + ' older version' + (rest.length > 1 ? 's' : '') + '</div>';
  html += '<div class="fold-children" id="' + foldId + '" style="display:none">';
  rest.forEach(f => { html += renderItem(f); });
  html += '</div></div>';
  return html;
}

function toggleFold(id, el) {
  const c = document.getElementById(id);
  if (!c) return;
  const show = c.style.display === 'none';
  c.style.display = show ? '' : 'none';
  const arrow = el.querySelector('.fold-arrow');
  if (arrow) arrow.style.transform = show ? 'rotate(90deg)' : '';
}

// -- Start --
init();
