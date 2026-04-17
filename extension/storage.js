// Storage layer — IndexedDB for directory handles, chrome.storage for pins/settings.

const DB_NAME = "htmlvault";
const DB_VERSION = 1;
const STORE_HANDLES = "handles";
const STORE_FILES = "files";

// -- IndexedDB helpers --

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_HANDLES)) {
        db.createObjectStore(STORE_HANDLES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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

function idbClear(storeName) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });
}

// -- Directory handle persistence --

async function saveDirectoryHandle(name, handle) {
  await idbPut(STORE_HANDLES, { id: name, handle: handle, addedAt: Date.now() });
}

async function loadDirectoryHandles() {
  const records = await idbGetAll(STORE_HANDLES);
  return records || [];
}

async function removeDirectoryHandle(name) {
  await idbDelete(STORE_HANDLES, name);
}

// Verify permission on a stored handle. Returns true if still granted.
async function verifyPermission(handle) {
  try {
    const opts = { mode: "read" };
    if ((await handle.queryPermission(opts)) === "granted") return true;
    if ((await handle.requestPermission(opts)) === "granted") return true;
  } catch (e) {
    // Permission denied or handle invalid
  }
  return false;
}

// -- Pins (chrome.storage.local) --

function getPins() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ pins: [] }, (data) => resolve(data.pins));
  });
}

function setPins(pins) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ pins: pins }, resolve);
  });
}

// -- Settings (chrome.storage.local) --

const DEFAULT_SETTINGS = { view: "grid", groupBy: "folder" };

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ settings: DEFAULT_SETTINGS }, (data) => resolve(data.settings));
  });
}

function setSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ settings: settings }, resolve);
  });
}

// -- Hidden files (soft delete) --

function getHiddenFiles() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ hidden: [] }, (data) => resolve(data.hidden));
  });
}

function setHiddenFiles(hidden) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ hidden: hidden }, resolve);
  });
}
