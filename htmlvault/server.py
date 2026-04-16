"""Local HTTP server for serve mode — enables Finder open + pin/unpin."""

import http.server
import json
import os
import subprocess
import urllib.parse
from typing import List


class VaultHandler(http.server.BaseHTTPRequestHandler):
    """HTTP handler with API endpoints for file/folder open and pin."""

    # Set by serve() before starting
    gallery_html = ""
    pins_file = ""
    base_dir = ""

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        if path == "/" or path == "/index.html":
            self._send_html(self.gallery_html)
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
            pins = _load_pins(self.pins_file)
            self._send_json({"ok": True, "pins": pins})
            return

        self.send_error(404)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path in ("/api/pin", "/api/unpin"):
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length)) if length else {}
            except (json.JSONDecodeError, ValueError):
                self._send_json({"ok": False, "error": "bad json"}, 400)
                return

            relpath = body.get("relpath", "")
            if not relpath:
                self._send_json({"ok": False, "error": "missing relpath"}, 400)
                return

            pins = _load_pins(self.pins_file)
            if path == "/api/pin":
                if relpath not in pins:
                    pins.append(relpath)
            else:
                pins = [p for p in pins if p != relpath]

            _save_pins(self.pins_file, pins)
            self._send_json({"ok": True, "pins": pins})
            return

        self.send_error(404)

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
        # Minimal logging
        if args and "/api/" in str(args[0]):
            print(f"  API: {args[0]}")


def serve(
    gallery_html: str,
    pins_file: str,
    base_dir: str,
    port: int = 7749,
) -> None:
    """Start the local server.

    Args:
        gallery_html: rendered gallery HTML string
        pins_file: path to pins.json
        base_dir: scanned root directory
        port: server port
    """
    VaultHandler.gallery_html = gallery_html
    VaultHandler.pins_file = pins_file
    VaultHandler.base_dir = base_dir

    server = http.server.HTTPServer(("127.0.0.1", port), VaultHandler)
    print(f"HTMLVault serving at http://localhost:{port}")
    print(f"Scanning: {base_dir}")
    print(f"Press Ctrl+C to stop.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        server.server_close()


# -- Pin storage --

def _load_pins(pins_file: str) -> List[str]:
    if os.path.isfile(pins_file):
        try:
            with open(pins_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                return data
        except (json.JSONDecodeError, IOError):
            pass
    return []


def _save_pins(pins_file: str, pins: List[str]) -> None:
    os.makedirs(os.path.dirname(pins_file) or ".", exist_ok=True)
    with open(pins_file, "w", encoding="utf-8") as f:
        json.dump(pins, f, ensure_ascii=False, indent=2)


def load_pins(pins_file: str) -> List[str]:
    """Public interface for loading pins."""
    return _load_pins(pins_file)
