// HTMLVault Extension — Gallery main logic.
// Ported from CLI version gallery.html <script>, adapted for extension APIs.

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

// -- State --
let FILES = [];
let PINS = [];
let HIDDEN = [];
let view = 'grid';
let groupBy = 'folder';
let typeFilter = 'all';
let _observer = null;
let _blobUrls = new Map(); // cache: relpath -> blob URL

// -- Init --
async function init() {
  // Load saved settings
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

  // Bind events
  document.getElementById('search').addEventListener('input', render);
  document.getElementById('empty-add-btn').addEventListener('click', addFolder);

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
}

// -- Scanning --
async function scanAll(handles) {
  const el = document.getElementById('content');
  el.innerHTML = '<div class="scanning"><div class="scanning-spinner"></div><p>Scanning directories...</p></div>';

  FILES = [];
  let validHandles = [];

  for (const record of handles) {
    const handle = record.handle;
    const ok = await verifyPermission(handle);
    if (!ok) {
      toast('Permission needed for ' + record.id + '. Click to re-authorize.');
      continue;
    }
    validHandles.push(record);

    const files = await scanDirectory(handle, record.id, (count) => {
      el.querySelector('p').textContent = 'Scanning... ' + count + ' files found';
    });

    // Categorize files
    for (const f of files) {
      const content = await readFileContent(f._fileHandle);
      f.type = categorize(content, f.size, f.relpath + ':' + f.mtime);
      f.size_fmt = formatSize(f.size);
      f._content = content; // keep for blob preview
    }

    FILES = FILES.concat(files);
  }

  // Filter hidden files
  FILES = FILES.filter(f => !HIDDEN.includes(f.relpath));

  // Sort by mtime desc
  FILES.sort((a, b) => b.mtime - a.mtime);

  const subtitle = validHandles.map(h => h.id).join(', ') + ' \u2014 ' + FILES.length + ' files';
  document.getElementById('subtitle').textContent = subtitle;

  if (FILES.length > 0) {
    document.getElementById('toolbar').style.display = '';
    buildTypeFilters();
    render();
  } else {
    el.innerHTML = '<div class="empty"><p>No HTML files found in scanned directories.</p><button class="empty-btn" onclick="addFolder()">Add Another Folder</button></div>';
  }
}

// -- Add / remove folder --
async function addFolder() {
  let dirHandle;
  try {
    dirHandle = await window.showDirectoryPicker({ mode: 'read' });
  } catch (e) {
    // User cancelled
    return;
  }

  const name = dirHandle.name;
  await saveDirectoryHandle(name, dirHandle);
  toast('Added: ' + name);

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
    document.getElementById('content').innerHTML = '<div class="empty"><p>No folders added yet.</p><button class="empty-btn" onclick="addFolder()">Add Folder</button></div>';
  }
}

function renderDirBar(handles) {
  const bar = document.getElementById('dir-bar');
  if (!handles || handles.length === 0) {
    bar.innerHTML = '<span class="dir-add-btn" id="dir-add-btn">+ Add folder</span>';
    document.getElementById('dir-add-btn').addEventListener('click', addFolder);
    return;
  }
  let html = handles.map(h =>
    '<span class="dir-chip">' + esc(h.id) +
    (handles.length > 1 ? ' <span class="dir-remove" data-dir="' + esc(h.id) + '">&times;</span>' : '') +
    '</span>'
  ).join('');
  html += '<span class="dir-add-btn" id="dir-add-btn">+ Add folder</span>';
  bar.innerHTML = html;

  document.getElementById('dir-add-btn').addEventListener('click', addFolder);
  bar.querySelectorAll('.dir-remove').forEach(el => {
    el.addEventListener('click', () => {
      if (confirm('Remove ' + el.dataset.dir + ' from scan?')) {
        removeFolder(el.dataset.dir);
      }
    });
  });
}

// -- Helpers --
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function shortDate(ts) { const d = new Date(ts * 1000); return String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function isPinned(relpath) { return PINS.indexOf(relpath) !== -1; }

function getFiltered() {
  const q = document.getElementById('search').value.toLowerCase();
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

// -- Actions --
async function openFile(relpath, ev) {
  ev.preventDefault(); ev.stopPropagation();
  const f = FILES.find(x => x.relpath === relpath);
  if (!f) return;
  let url = _blobUrls.get(relpath);
  if (!url) {
    url = await readFileAsBlobUrl(f._fileHandle);
    if (url) _blobUrls.set(relpath, url);
  }
  if (url) window.open(url, '_blank');
}

function copyPath(relpath, ev) {
  ev.preventDefault(); ev.stopPropagation();
  navigator.clipboard.writeText(relpath).then(() => toast('Path copied'));
}

async function togglePin(relpath, ev) {
  ev.preventDefault(); ev.stopPropagation();
  if (isPinned(relpath)) {
    PINS = PINS.filter(p => p !== relpath);
  } else {
    PINS.push(relpath);
  }
  await setPins(PINS);
  render();
}

async function hideFile(relpath, ev) {
  ev.preventDefault(); ev.stopPropagation();
  if (!confirm('Hide ' + relpath + '? (Can be restored in settings)')) return;
  HIDDEN.push(relpath);
  await setHiddenFiles(HIDDEN);
  FILES = FILES.filter(f => f.relpath !== relpath);
  render();
  toast('Hidden: ' + relpath);
}

// -- Render --
function getBlobPreviewUrl(f) {
  // Create blob URL from stored content for iframe preview
  if (_blobUrls.has(f.relpath)) return _blobUrls.get(f.relpath);
  if (f._content) {
    const blob = new Blob([f._content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    _blobUrls.set(f.relpath, url);
    return url;
  }
  return '';
}

function renderItem(f) {
  const ic = ICONS[f.type] || ICONS.page;
  const pinCls = isPinned(f.relpath) ? 'pinned' : '';
  const pinSvg = isPinned(f.relpath) ? SVG_PIN : SVG_PIN_OUTLINE;
  const rp = esc(f.relpath);
  const pUrl = getBlobPreviewUrl(f);

  if (view === 'grid') {
    return '<div class="item">' +
      '<div class="item-thumb" onclick="openFile(\'' + rp + '\',event)" style="background:' + ic.bg + '">' +
        '<div class="icon-fallback">' + ic.svg + '</div>' +
        (pUrl ? '<iframe data-src="' + pUrl + '" sandbox="allow-same-origin" onload="this.parentNode.classList.add(\'loaded\')"></iframe>' : '') +
      '</div>' +
      '<div class="item-body">' +
        '<div class="item-row">' +
          '<span class="item-title" onclick="openFile(\'' + rp + '\',event)">' + esc(f.name) + '</span>' +
          '<button class="icon-btn pin-btn ' + pinCls + '" onclick="togglePin(\'' + rp + '\',event)" title="Pin">' + pinSvg + '</button>' +
          '<button class="icon-btn" onclick="copyPath(\'' + rp + '\',event)" title="Copy path">' + SVG_COPY + '</button>' +
          '<button class="icon-btn del-btn" onclick="hideFile(\'' + rp + '\',event)" title="Hide">' + SVG_TRASH + '</button>' +
        '</div>' +
        '<div class="item-meta">' +
          '<span class="badge badge-' + f.type + '">' + f.type + '</span>' +
          '<span class="item-path">' + esc(f.relpath) + '</span>' +
          '<span class="item-date">' + shortDate(f.mtime) + '</span>' +
        '</div>' +
      '</div></div>';
  } else {
    return '<div class="item">' +
      '<div class="item-body" onclick="openFile(\'' + rp + '\',event)">' +
        '<span class="badge badge-' + f.type + '">' + f.type + '</span>' +
        '<span class="item-title">' + esc(f.name) + '</span>' +
        '<span class="item-meta">' +
          '<span class="item-path">' + esc(f.relpath) + '</span>' +
          '<span class="item-size">' + f.size_fmt + '</span>' +
          '<span class="item-date">' + shortDate(f.mtime) + '</span>' +
        '</span>' +
      '</div>' +
      '<button class="icon-btn pin-btn ' + pinCls + '" onclick="togglePin(\'' + rp + '\',event)" title="Pin">' + pinSvg + '</button>' +
      '<button class="icon-btn" onclick="copyPath(\'' + rp + '\',event)" title="Copy path">' + SVG_COPY + '</button>' +
      '<button class="icon-btn del-btn" onclick="hideFile(\'' + rp + '\',event)" title="Hide">' + SVG_TRASH + '</button>' +
    '</div>';
  }
}

function render() {
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
    const keys = Object.keys(groups).sort((a,b) => {
      return Math.max(...groups[b].map(f=>f.mtime)) - Math.max(...groups[a].map(f=>f.mtime));
    });
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

  // Lazy-load iframes
  if (_observer) _observer.disconnect();
  _observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const iframe = e.target;
        if (iframe.dataset.src && !iframe.src) {
          iframe.src = iframe.dataset.src;
        }
        _observer.unobserve(iframe);
      }
    });
  }, { rootMargin: '200px' });
  el.querySelectorAll('iframe[data-src]').forEach(f => _observer.observe(f));
}

function renderSection(title, files) {
  const sorted = [...files].sort((a,b) => b.mtime - a.mtime);
  const folded = foldVersions(sorted);
  return '<div class="section">' +
    '<div class="section-header"><h2>' + title + '</h2><span class="section-count">' + files.length + '</span></div>' +
    '<div class="items">' + folded.map(renderFoldedItem).join('') + '</div>' +
  '</div>';
}

// -- Multi-version folding (identical to CLI version) --
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
  const foldId = 'fold-' + latest.relpath.replace(/[^a-zA-Z0-9]/g, '-');
  let html = '<div class="item-fold">';
  html += renderItem(latest);
  html += '<div class="fold-toggle" onclick="toggleFold(\'' + foldId + '\',this)">' +
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
  el.querySelector('.fold-arrow').style.transform = show ? 'rotate(90deg)' : '';
}

// -- Start --
init();
