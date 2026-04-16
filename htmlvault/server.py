"""Local HTTP server for serve mode — enables Finder open, pin, trash, directory management."""

import http.server
import json
import os
import subprocess
import urllib.parse
from typing import List

from htmlvault.scanner import scan
from htmlvault.generator import generate


class VaultHandler(http.server.BaseHTTPRequestHandler):
    """HTTP handler with API endpoints."""

    # Set by serve() before starting
    vault_dir = ""    # .htmlvault/ directory
    _dirs = []        # scan directories

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        if path == "/" or path == "/index.html":
            # Regenerate gallery on each request (picks up dir changes, trash, etc.)
            dirs = _load_dirs(self.vault_dir)
            pins = _load_pins(_pins_path(self.vault_dir))
            files = scan(dirs)
            html = generate(files, dirs[0] if dirs else ".", pins=pins)
            self._send_html(html)
            return

        if path == "/api/open-file":
            filepath = qs.get("path", [""])[0]
            if filepath and os.path.isfile(filepath):
                subprocess.Popen(["open", filepath])
                self._send_json({"ok": True})
            else:
                self._send_json({"ok": False, "error": "file not found"}, 400)
            return

        if path == "/api/open-folder":
            folder = qs.get("path", [""])[0]
            if folder and os.path.isdir(folder):
                subprocess.Popen(["open", folder])
                self._send_json({"ok": True})
            else:
                self._send_json({"ok": False, "error": "dir not found"}, 400)
            return

        if path == "/api/pins":
            pins = _load_pins(_pins_path(self.vault_dir))
            self._send_json({"ok": True, "pins": pins})
            return

        if path == "/api/dirs":
            dirs = _load_dirs(self.vault_dir)
            self._send_json({"ok": True, "dirs": dirs})
            return

        # Serve HTML files for iframe preview: /preview/<relpath>
        if path.startswith("/preview/"):
            relpath = urllib.parse.unquote(path[len("/preview/"):])
            # Search across all configured directories
            dirs = _load_dirs(self.vault_dir)
            for d in dirs:
                filepath = os.path.join(d, relpath)
                if filepath.endswith(".html") and os.path.isfile(filepath):
                    try:
                        with open(filepath, "rb") as f:
                            data = f.read()
                        self.send_response(200)
                        self.send_header("Content-Type", "text/html; charset=utf-8")
                        self.send_header("Content-Length", str(len(data)))
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

            # Safety: must be under one of the configured dirs
            dirs = _load_dirs(self.vault_dir)
            parent = None
            for d in dirs:
                if abs_path.startswith(os.path.abspath(d)):
                    parent = os.path.abspath(d)
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
                os.rename(abs_path, dest)
                self._send_json({"ok": True, "trashed": filepath})
            except OSError as e:
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
            self._send_json({"ok": True, "pins": pins})
            return

        if path == "/api/add-dir":
            dir_path = body.get("path", "")
            if dir_path:
                # Direct path provided (e.g. from drag-drop)
                dir_path = os.path.expanduser(dir_path)
                dir_path = os.path.abspath(dir_path)
            else:
                # No path — open native macOS folder picker
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
            self._send_json({"ok": True, "dirs": dirs})
            return

        if path == "/api/remove-dir":
            dir_path = body.get("path", "")
            dir_path = os.path.abspath(dir_path)
            dirs = _load_dirs(self.vault_dir)
            dirs = [d for d in dirs if os.path.abspath(d) != dir_path]
            if not dirs:
                self._send_json({"ok": False, "error": "need at least one dir"}, 400)
                return
            _save_dirs(self.vault_dir, dirs)
            self._send_json({"ok": True, "dirs": dirs})
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
        data = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        if args and "/api/" in str(args[0]):
            print(f"  API: {args[0]}")


# -- Storage helpers --

def _pick_folder() -> str:
    """Open macOS native folder picker dialog, return selected path or empty string."""
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

def _vault_dir_path(vault_dir: str, filename: str) -> str:
    return os.path.join(vault_dir, filename)

def _pins_path(vault_dir: str) -> str:
    return _vault_dir_path(vault_dir, "pins.json")

def _dirs_path(vault_dir: str) -> str:
    return _vault_dir_path(vault_dir, "config.json")

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
    """Public interface for loading pins."""
    return _load_pins(pins_file)


def serve(
    directories: List[str],
    vault_dir: str,
    port: int = 7749,
) -> None:
    """Start the local server.

    Args:
        directories: initial scan directories
        vault_dir: .htmlvault/ directory for config/pins/trash
        port: server port
    """
    os.makedirs(vault_dir, exist_ok=True)

    # Save initial directories to config
    existing = _load_dirs(vault_dir)
    if not existing:
        _save_dirs(vault_dir, directories)

    VaultHandler.vault_dir = vault_dir

    server = http.server.HTTPServer(("127.0.0.1", port), VaultHandler)
    dirs = _load_dirs(vault_dir)
    print(f"HTMLVault serving at http://localhost:{port}")
    print(f"Scanning: {', '.join(dirs)}")
    print(f"Press Ctrl+C to stop.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        server.server_close()
