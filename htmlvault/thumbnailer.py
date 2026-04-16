"""Thumbnail generator — screenshot HTML files using Playwright."""

import hashlib
import os
from typing import Dict, List, Optional


CACHE_DIR_NAME = ".htmlvault/cache"
THUMB_WIDTH = 1280
THUMB_HEIGHT = 720


def get_cache_dir(base_dir: str) -> str:
    """Return the thumbnail cache directory path."""
    return os.path.join(base_dir, CACHE_DIR_NAME)


def content_hash(filepath: str) -> str:
    """Compute a short hash of the file content for cache key."""
    h = hashlib.md5()
    try:
        with open(filepath, "rb") as f:
            # Read first 100KB — enough to detect changes
            h.update(f.read(100_000))
    except OSError:
        h.update(filepath.encode())
    return h.hexdigest()[:12]


def generate_thumbnails(
    files: List[Dict],
    base_dir: str,
    force: bool = False,
) -> Dict[str, str]:
    """Generate thumbnails for HTML files.

    Returns dict mapping relpath -> thumbnail filename (in cache dir).
    Only generates missing/changed thumbnails (incremental).
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("  Playwright not installed. Run: pip install playwright && playwright install chromium")
        return {}

    cache_dir = get_cache_dir(base_dir)
    os.makedirs(cache_dir, exist_ok=True)

    # Determine which files need thumbnails
    to_generate = []
    thumb_map = {}

    for f in files:
        h = content_hash(f["path"])
        thumb_name = h + ".png"
        thumb_path = os.path.join(cache_dir, thumb_name)
        thumb_map[f["relpath"]] = thumb_name

        if force or not os.path.isfile(thumb_path):
            to_generate.append((f, thumb_path))

    if not to_generate:
        print(f"  All {len(files)} thumbnails cached.")
        return thumb_map

    print(f"  Generating {len(to_generate)} thumbnails ({len(files) - len(to_generate)} cached)...")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": THUMB_WIDTH, "height": THUMB_HEIGHT})

        for i, (f, thumb_path) in enumerate(to_generate):
            try:
                file_url = "file://" + f["path"]
                page.goto(file_url, wait_until="networkidle", timeout=10000)
                page.screenshot(path=thumb_path, type="png")
                if (i + 1) % 10 == 0 or (i + 1) == len(to_generate):
                    print(f"    [{i + 1}/{len(to_generate)}] done")
            except Exception as e:
                # On failure, skip — gallery will show type icon fallback
                print(f"    Skip {f['relpath']}: {e}")
                # Remove from map so gallery uses icon fallback
                thumb_map.pop(f["relpath"], None)

        browser.close()

    return thumb_map
