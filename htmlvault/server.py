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
\"\"\"Local HTTP server for serve mode — enables Finder open, pin, trash, directory management.\"\"\"

import http.server
import json
import os
import shutil
import subprocess
import sys
import threading
import time
import urllib.parse
from typing import List, Optional

from htmlvault.scanner import scan
from htmlvault.generator import generate


def _open_native(target: str) -> bool:
    \"\"\"Platform-aware 'reveal in file manager / open with default app'.

    Returns True if a command was launched. Quietly no-ops on unknown platforms.
    \"\"\"
    try:
        if sys.platform == "darwin":
            subprocess.Popen(["open", target])
        elif sys.platform.startswith("linux"):
            subprocess.Popen(["xdg-open", target])
        elif sys.platform == "win32":
            os.startfile(target)  # type: ignore[attr-defined]
        else:
            return False
        return True
    except (OSError, FileNotFoundError):
        return False


class _Cache:
    \"\"\"Gallery cache — avoid re-scanning on every page load.\"\"\"
    html = ""          # rendered gallery HTML
    files = []         # scan results
    _dirty = True      # needs re-scan
    _last_scan = 0.0   # timestamp of last scan
    _lock = threading.Lock()

    @classmethod
    def invalidate(cls):
        with cls._lock:
            cls._dirty = True

    @classmethod
    def get_html(cls, vault_dir: str) -> str:
        # Auto-invalidate after 30s so new files eventually appear
        with cls._lock:
            if time.time() - cls._last_scan > 30:
                cls._dirty = True
            if not cls._dirty and cls.html:
                return cls.html

            dirs = _load_dirs(vault_dir)
            pins = _load_pins(_pins_path(vault_dir))
            cls.files = scan(dirs)
            cls.html = generate(cls.files, dirs[0] if dirs else ".", pins=pins)
            cls._dirty = False
            cls._last_scan = time.time()
            return cls.html


class VaultHandler(http.server.BaseHTTPRequestHandler):
    \"\"\"HTTP handler with API endpoints.\"\"\"

    vault_dir = ""

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        if path == "/" or path == "/index.html":
            html = _Cache.get_html(self.vault_dir)
            self._send_html(html)
            return

        if path == "/api/open-file":
            filepath = qs.get("path", [""])[0]
            if not filepath or not os.path.isfile(filepath):
                self._send_json({"ok": False, "error": "file not found"}, 400)
                return
            if not _path_within_scan_dirs(filepath, _load_dirs(self.vault_dir)):
                self._send_json({"ok": False, "error": "not in scan dirs"}, 403)
                return
            if not _open_native(filepath):
                self._send_json({"ok": False, "error": "open not supported on this platform"}, 500)
                return
            self._send_json({"ok": True})
            return

        if path == "/api/open-folder":
            folder = qs.get("path", [""])[0]
            if not folder or not os.path.isdir(folder):
                self._send_json({"ok": False, "error": "dir not found"}, 400)
                return
            if not _path_within_scan_dirs(folder, _load_dirs(self.vault_dir)):
                self._send_json({"ok": False, "error": "not in scan dirs"}, 403)
                return
            if not _open_native(folder):
                self._send_json({"ok": False, "error": "open not supported on this platform"}, 500)
                return
            self._send_json({"ok": True})
            return

        if path == "/api/pins":
            pins = _load_pins(_pins_path(self.vault_dir))
            self._send_json({"ok": True, "pins": pins})
            return

        if path == "/api/dirs":
            dirs = _load_dirs(self.vault_dir)
            self._send_json({"ok": True, "dirs": dirs})
            return

        # Serve files for iframe preview (HTML + relative assets)
        if path.startswith("/preview/"):
            relpath = urllib.parse.unquote(path[len("/preview/"):])
            dirs = _load_dirs(self.vault_dir)
            for d in dirs:
                filepath = os.path.join(d, relpath)
                if not _path_within_scan_dirs(filepath, [d]):
                    continue
                if os.path.isfile(filepath):
                    try:
                        with open(filepath, "rb") as f:
                            data = f.read()
                        ctype = _guess_content_type(filepath)
                        self.send_response(200)
                        self.send_header("Content-Type", ctype)
                        self.send_header("Content-Length", str(len(data)))
                        self.send_header("Cache-Control", "max-age=60")
                        self.end_headers()
                        self.wfile.write(data)
                    except OSError:
                        self.send_error(404)
                    return

        self.send_error(404)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self._read_body()

        if path == "/api/delete-file":
            filepath = body.get("path", "")
            if not filepath or not os.path.isfile(filepath):
                self._send_json({"ok": False, "error": "file not found"}, 400)
                return

            abs_path = os.path.abspath(filepath)
            if not abs_path.endswith(".html"):
                self._send_json({"ok": False, "error": "not an html file"}, 403)
                return

            dirs = _load_dirs(self.vault_dir)
            if not _path_within_scan_dirs(abs_path, dirs):
                self._send_json({"ok": False, "error": "not in scan dirs"}, 403)
                return
            parent = None
            for d in dirs:
                abs_d = os.path.abspath(os.path.realpath(d))
                if (abs_path + os.sep).startswith(abs_d.rstrip(os.sep) + os.sep):
                    parent = abs_d
                    break
            if not parent:
                self._send_json({"ok": False, "error": "not in scan dirs"}, 403)
                return

            try:
                trash_dir = os.path.join(self.vault_dir, "trash")
                os.makedirs(trash_dir, exist_ok=True)
                rel = os.path.relpath(abs_path, parent)
                dest = os.path.join(trash_dir, rel)
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                # shutil.move falls back to copy+unlink across filesystems.
                shutil.move(abs_path, dest)
                _Cache.invalidate()
                self._send_json({"ok": True, "trashed": filepath})
            except (OSError, shutil.Error) as e:
                self._send_json({"ok": False, "error": str(e)}, 500)
            return

        if path in ("/api/pin", "/api/unpin"):
            relpath = body.get("relpath", "")
            if not relpath:
                self._send_json({"ok": False, "error": "missing relpath"}, 400)
                return

            pins_path = _pins_path(self.vault_dir)
            pins = _load_pins(pins_path)
            if path == "/api/pin":
                if relpath not in pins:
                    pins.append(relpath)
            else:
                pins = [p for p in pins if p != relpath]

            _save_json(pins_path, pins)
            _Cache.invalidate()
            self._send_json({"ok": True, "pins": pins})
            return

        if path == "/api/add-dir":
            dir_path = body.get("path", "")
            if dir_path:
                dir_path = os.path.expanduser(dir_path)
                dir_path = os.path.abspath(dir_path)
            else:
                dir_path = _pick_folder()

            if not dir_path:
                self._send_json({"ok": False, "error": "cancelled"})
                return
            if not os.path.isdir(dir_path):
                self._send_json({"ok": False, "error": "not a directory"}, 400)
                return

            dirs = _load_dirs(self.vault_dir)
            if dir_path not in dirs:
                dirs.append(dir_path)
                _save_dirs(self.vault_dir, dirs)
            _Cache.invalidate()
            self._send_json({"ok": True, "dirs": dirs})
            return

        if path == "/api/remove-dir":
            raw = body.get("path", "")
            if not raw:
                self._send_json({"ok": False, "error": "missing path"}, 400)
                return
            dir_path = os.path.abspath(raw)
            dirs = _load_dirs(self.vault_dir)
            new_dirs = [d for d in dirs if os.path.abspath(d) != dir_path]
            if new_dirs == dirs:
                self._send_json({"ok": False, "error": "path not in scan dirs"}, 404)
                return
            if not new_dirs:
                self._send_json({"ok": False, "error": "need at least one dir"}, 400)
                return
            _save_dirs(self.vault_dir, new_dirs)
            _Cache.invalidate()
            self._send_json({"ok": True, "dirs": new_dirs})
            return

        self.send_error(404)

    def _read_body(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            return json.loads(self.rfile.read(length)) if length else {}
        except (json.JSONDecodeError, ValueError):
            return {}

    def _send_html(self, html: str):
        data = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_json(self, obj: dict, code: int = 200):
        # No CORS header: gallery and API share the localhost:port origin, so the
        # same-origin policy already allows the gallery fetch. Omitting
        # Access-Control-Allow-Origin means cross-origin attackers cannot make
        # authenticated POST/DELETE calls from their own pages.
        data = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        if args and "/api/" in str(args[0]):
            print(f"  API: {args[0]}")


# -- Helpers --

_CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
}

def _guess_content_type(filepath: str) -> str:
    ext = os.path.splitext(filepath)[1].lower()
    return _CONTENT_TYPES.get(ext, "application/octet-stream")

def _pick_folder() -> str:
    \"\"\"Open a native folder picker if available, else return empty.

    macOS: uses osascript (AppleScript).
    Linux/Windows: no picker — callers should supply the path via the request
    body instead. The frontend's drag-and-drop and typed-path flows both do this.
    \"\"\"
    if sys.platform != "darwin":
        return ""
    try:
        result = subprocess.run(
            ["osascript", "-e",
             'set f to choose folder with prompt "Select folder to scan"',
             "-e", 'return POSIX path of f'],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode == 0:
            return result.stdout.strip().rstrip("/")
    except (subprocess.TimeoutExpired, OSError):
        pass
    return ""


def _path_within_scan_dirs(target: str, scan_dirs: List[str]) -> bool:
    \"\"\"Check that `target` is inside one of the configured scan directories.

    Resolves both sides to absolute paths with trailing sep to avoid
    `/foo/bar` matching `/foo/bar-evil` as a prefix.
    \"\"\"
    try:
        abs_target = os.path.abspath(os.path.realpath(target))
    except (OSError, ValueError):
        return False
    for d in scan_dirs:
        try:
            abs_d = os.path.abspath(os.path.realpath(d))
        except (OSError, ValueError):
            continue
        abs_d = abs_d.rstrip(os.sep) + os.sep
        if (abs_target + os.sep).startswith(abs_d):
            return True
    return False

def _pins_path(vault_dir: str) -> str:
    return os.path.join(vault_dir, "pins.json")

def _dirs_path(vault_dir: str) -> str:
    return os.path.join(vault_dir, "config.json")

def _load_json(filepath: str, default=None):
    if os.path.isfile(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return default if default is not None else []

def _save_json(filepath: str, data) -> None:
    os.makedirs(os.path.dirname(filepath) or ".", exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def _load_pins(pins_file: str) -> List[str]:
    data = _load_json(pins_file, [])
    return data if isinstance(data, list) else []

def _load_dirs(vault_dir: str) -> List[str]:
    config = _load_json(_dirs_path(vault_dir), {})
    if isinstance(config, dict):
        return config.get("directories", [])
    return []

def _save_dirs(vault_dir: str, dirs: List[str]) -> None:
    config_path = _dirs_path(vault_dir)
    config = _load_json(config_path, {})
    if not isinstance(config, dict):
        config = {}
    config["directories"] = dirs
    _save_json(config_path, config)


# -- Public API --

def load_pins(pins_file: str) -> List[str]:
    return _load_pins(pins_file)

def serve(
    directories: List[str],
    vault_dir: str,
    port: int = 7749,
) -> None:
    os.makedirs(vault_dir, exist_ok=True)

    existing = _load_dirs(vault_dir)
    if not existing:
        _save_dirs(vault_dir, directories)

    VaultHandler.vault_dir = vault_dir

    # Pre-warm cache
    print("Scanning...")
    _Cache.get_html(vault_dir)
    print(f"Found {len(_Cache.files)} HTML files (cached).\n")

    server = http.server.HTTPServer(("127.0.0.1", port), VaultHandler)
    print(f"HTMLVault serving at http://localhost:{port}")
    print(f"Press Ctrl+C to stop.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        server.server_close()
"""
