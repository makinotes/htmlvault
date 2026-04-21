// Storage layer — IndexedDB for directory handles, chrome.storage for pins/settings.

const DB_NAME = "htmlvault";
const DB_VERSION = 1;
const STORE_HANDLES = "handles";

// -- IndexedDB helpers (P1-7: cached connection) --

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_HANDLES)) {
        db.createObjectStore(STORE_HANDLES, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { _dbPromise = null; reject(req.error); };
  });
  return _dbPromise;
}

function idbPut(storeName, value) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

function idbGetAll(storeName) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  });
}

function idbDelete(storeName, key) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

// -- Directory handle persistence --

// Returns true on success, false on failure. Callers should surface a toast
// if this returns false so the user isn't misled into thinking a folder has
// been persisted when IndexedDB is blocked (incognito, policy, quota).
async function saveDirectoryHandle(name, handle) {
  try {
    await idbPut(STORE_HANDLES, { id: name, handle: handle, addedAt: Date.now() });
    return true;
  } catch (e) {
    console.warn('saveDirectoryHandle failed:', e);
    return false;
  }
}

async function loadDirectoryHandles() {
  try {
    const records = await idbGetAll(STORE_HANDLES);
    return records || [];
  } catch (e) {
    console.warn('Failed to load directory handles:', e);
    return [];
  }
}

async function removeDirectoryHandle(name) {
  await idbDelete(STORE_HANDLES, name);
}

// Verify permission on a stored handle. Returns true if still granted.
// P2-5: log errors instead of silently swallowing
async function verifyPermission(handle) {
  try {
    const opts = { mode: "read" };
    if ((await handle.queryPermission(opts)) === "granted") return true;
    if ((await handle.requestPermission(opts)) === "granted") return true;
  } catch (e) {
    console.warn('Permission check failed for handle:', e);
  }
  return false;
}

// -- Pins (chrome.storage.local) -- P2-3: check lastError --

function getPins() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get({ pins: [] }, (data) => {
      if (chrome.runtime.lastError) {
        console.warn('getPins error:', chrome.runtime.lastError);
        return resolve([]);
      }
      resolve(data.pins);
    });
  });
}

function setPins(pins) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ pins: pins }, () => {
      if (chrome.runtime.lastError) console.warn('setPins error:', chrome.runtime.lastError);
      resolve();
    });
  });
}

// -- Settings (chrome.storage.local) --

const DEFAULT_SETTINGS = { view: "grid", groupBy: "folder" };

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ settings: DEFAULT_SETTINGS }, (data) => {
      if (chrome.runtime.lastError) {
        console.warn('getSettings error:', chrome.runtime.lastError);
        return resolve(DEFAULT_SETTINGS);
      }
      resolve(data.settings);
    });
  });
}

function setSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ settings: settings }, () => {
      if (chrome.runtime.lastError) console.warn('setSettings error:', chrome.runtime.lastError);
      resolve();
    });
  });
}

// -- Hidden files (soft delete) --

// Cap to stay well under chrome.storage.local's 5 MB per-extension quota.
// 5000 paths × ~200 B avg ≈ 1 MB, leaving headroom for pins and settings.
const HIDDEN_MAX = 5000;

function getHiddenFiles() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ hidden: [] }, (data) => {
      if (chrome.runtime.lastError) {
        console.warn('getHiddenFiles error:', chrome.runtime.lastError);
        return resolve([]);
      }
      resolve(data.hidden);
    });
  });
}

// Returns { ok, truncated } so UI can toast a warning when the cap bites.
function setHiddenFiles(hidden) {
  let trimmed = hidden;
  let truncated = false;
  if (trimmed.length > HIDDEN_MAX) {
    // Keep the most recently added (end of list) entries.
    trimmed = trimmed.slice(-HIDDEN_MAX);
    truncated = true;
  }
  return new Promise((resolve) => {
    chrome.storage.local.set({ hidden: trimmed }, () => {
      if (chrome.runtime.lastError) {
        console.warn('setHiddenFiles error:', chrome.runtime.lastError);
        return resolve({ ok: false, truncated });
      }
      resolve({ ok: true, truncated });
    });
  });
}
