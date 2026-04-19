// Directory scanner — recursive scan via File System Access API.
// Ported from htmlvault/scanner.py.

const DEFAULT_EXCLUDES = new Set([
  "node_modules", ".venv", "venv", ".git", ".next",
  "dist", "build", "out", "site-packages", "__pycache__",
  ".claude", ".trash", ".cache", ".tox", ".mypy_cache",
  ".pytest_cache", "egg-info", ".worktrees",
]);

const SKIP_FILENAMES = new Set([
  "LICENSES.chromium.html",
]);

const MIN_FILE_SIZE = 500; // bytes

/**
 * Scan a directory handle recursively for HTML files.
 * @param {FileSystemDirectoryHandle} dirHandle - root directory
 * @param {string} dirName - display name for this root
 * @param {function} onProgress - optional callback(count) for progress updates
 * @returns {Promise<Array>} - list of file objects
 */
async function scanDirectory(dirHandle, dirName, onProgress) {
  const results = [];
  await _scanRecursive(dirHandle, "", dirName, results, onProgress);
  // Sort by mtime descending (newest first)
  results.sort((a, b) => b.mtime - a.mtime);
  return results;
}

async function _scanRecursive(dirHandle, relPrefix, rootName, results, onProgress) {
  const subdirs = [];
  try {
    for await (const [name, entry] of dirHandle.entries()) {
    // Skip hidden entries (dot files/dirs)
    if (name.startsWith(".")) continue;

    if (entry.kind === "directory") {
      if (DEFAULT_EXCLUDES.has(name)) continue;
      if (name.includes("egg-info")) continue;
      subdirs.push({ name, handle: entry });
    } else if (entry.kind === "file" && (name.endsWith(".html") || name.endsWith(".htm"))) {
      if (SKIP_FILENAMES.has(name)) continue;

      let file;
      try {
        file = await entry.getFile();
      } catch (e) {
        continue;
      }

      if (file.size < MIN_FILE_SIZE) continue;

      const relpath = relPrefix ? relPrefix + "/" + name : name;
      const folder = relPrefix || ".";
      const baseName = name.replace(/\.html?$/i, "");

      results.push({
        name: baseName,
        relpath: relpath,
        folder: folder,
        mtime: file.lastModified / 1000, // convert ms to seconds
        size: file.size,
        dirName: rootName,
        _fileHandle: entry, // keep handle for reading content later
      });

      if (onProgress) onProgress(results.length);
    }
    }
  } catch (e) {
    // Permission revoked mid-traversal or handle invalid — return what we have.
    return;
  }

  // Recurse into subdirectories (sorted for deterministic order)
  subdirs.sort((a, b) => a.name.localeCompare(b.name));
  for (const sub of subdirs) {
    const subPrefix = relPrefix ? relPrefix + "/" + sub.name : sub.name;
    await _scanRecursive(sub.handle, subPrefix, rootName, results, onProgress);
  }
}

/**
 * Read HTML content from a file handle (for categorization or preview).
 * Reads up to maxBytes (default 200KB, matching Python version).
 * @param {FileSystemFileHandle} fileHandle
 * @param {number} maxBytes
 * @returns {Promise<string>}
 */
async function readFileContent(fileHandle, maxBytes) {
  maxBytes = maxBytes || 200000;
  try {
    const file = await fileHandle.getFile();
    if (file.size <= maxBytes) {
      return await file.text();
    }
    // Read partial — slice the file
    const blob = file.slice(0, maxBytes);
    return await blob.text();
  } catch (e) {
    return "";
  }
}

/**
 * Read full file content as blob URL (for iframe preview or opening).
 * @param {FileSystemFileHandle} fileHandle
 * @returns {Promise<string>} blob URL
 */
async function readFileAsBlobUrl(fileHandle) {
  try {
    const file = await fileHandle.getFile();
    return URL.createObjectURL(file);
  } catch (e) {
    return "";
  }
}

/**
 * Human-readable file size.
 */
function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.floor(bytes / 1024) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
