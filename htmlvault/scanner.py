"""
RETIRED — HTMLVault has moved to a Chrome extension as its only supported form.

This Python CLI (`htmlvault serve` / `htmlvault scan`) is kept in the repo
for historical reference only. It is no longer installed by pyproject.toml,
no longer published to PyPI, and no longer maintained. The logic here has
been reimplemented in `extension/` as MV3-compliant JavaScript.

If you are a non-technical user: please install the Chrome extension
(see README.md for instructions).

If you want to run the old CLI, revert to an earlier git tag (<= v0.1.0).
The entire original source is preserved below as a docstring so it can be
read, copied, or revived, but it will NOT execute as a module.
"""

_RETIRED_ORIGINAL_SOURCE = r"""
\"\"\"Directory scanner — find user-created HTML files.\"\"\"

import os
from typing import List, Dict

DEFAULT_EXCLUDES = {
    "node_modules", ".venv", "venv", ".git", ".next",
    "dist", "build", "out", "site-packages", "__pycache__",
    ".claude", ".trash", ".cache", ".tox", ".mypy_cache",
    ".pytest_cache", "egg-info", ".worktrees",
}

# Files that are clearly not user content
SKIP_FILENAMES = {
    "LICENSES.chromium.html",
}

MIN_FILE_SIZE = 500  # bytes — skip empty shells


def scan(directories: List[str], extra_excludes: List[str] = None) -> List[Dict]:
    \"\"\"Scan directories for user-created HTML files.

    Returns list of dicts with keys:
        path (str): absolute path
        relpath (str): relative to scan root
        name (str): filename without extension
        folder (str): parent directory relative to scan root
        mtime (float): modification timestamp
        size (int): file size in bytes
    \"\"\"
    excludes = DEFAULT_EXCLUDES.copy()
    if extra_excludes:
        excludes.update(extra_excludes)

    results = []
    for root_dir in directories:
        root_dir = os.path.expanduser(root_dir)
        root_dir = os.path.abspath(root_dir)
        if not os.path.isdir(root_dir):
            continue
        _scan_dir(root_dir, root_dir, excludes, results)

    # Sort by mtime descending (newest first)
    results.sort(key=lambda f: f["mtime"], reverse=True)
    return results


def _scan_dir(
    current: str, root: str, excludes: set, results: list
) -> None:
    \"\"\"Recursively scan a directory.\"\"\"
    dirs = []
    try:
        # Use as context manager so the directory handle is released even if
        # iteration raises.
        with os.scandir(current) as entries:
            for entry in entries:
                if entry.name.startswith("."):
                    continue  # skip all hidden dirs/files
                try:
                    is_dir = entry.is_dir(follow_symlinks=False)
                except OSError:
                    continue
                if is_dir:
                    if entry.name in excludes:
                        continue
                    if any(ex in entry.name for ex in ("egg-info",)):
                        continue
                    dirs.append(entry.path)
                    continue
                try:
                    is_file = entry.is_file()
                except OSError:
                    continue
                if is_file and entry.name.endswith(".html"):
                    if entry.name in SKIP_FILENAMES:
                        continue
                    try:
                        stat = entry.stat()
                    except OSError:
                        continue
                    if stat.st_size < MIN_FILE_SIZE:
                        continue

                    relpath = os.path.relpath(entry.path, root)
                    folder = os.path.dirname(relpath)
                    name = os.path.splitext(entry.name)[0]

                    results.append({
                        "path": entry.path,
                        "relpath": relpath,
                        "name": name,
                        "folder": folder if folder else ".",
                        "mtime": stat.st_mtime,
                        "size": stat.st_size,
                    })
    except (PermissionError, OSError):
        return

    for d in sorted(dirs):
        _scan_dir(d, root, excludes, results)


def format_size(size_bytes: int) -> str:
    \"\"\"Human-readable file size.\"\"\"
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes // 1024} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
"""
