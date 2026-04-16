"""Gallery HTML generator — render scan results into gallery.html."""

import json
import os
from datetime import datetime
from typing import List, Dict

from jinja2 import Environment, FileSystemLoader

from htmlvault.scanner import format_size
from htmlvault.categorizer import categorize

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "template")


def generate(
    files: List[Dict],
    base_dir: str,
    pins: List[str] = None,
    output_path: str = None,
) -> str:
    """Generate gallery HTML from scan results.

    Args:
        files: list of file dicts from scanner.scan()
        base_dir: the root directory that was scanned
        pins: list of pinned relpaths
        output_path: if provided, write to this path and return path;
                     otherwise return HTML string
    Returns:
        HTML string or output file path
    """
    if pins is None:
        pins = []

    # Enrich files with category and formatted size
    enriched = []
    for f in files:
        entry = dict(f)
        entry["type"] = categorize(f["path"])
        entry["size_fmt"] = format_size(f["size"])
        enriched.append(entry)

    # Render template
    env = Environment(
        loader=FileSystemLoader(TEMPLATE_DIR),
        autoescape=False,
    )
    template = env.get_template("gallery.html")

    html = template.render(
        base_dir=base_dir,
        scan_date=datetime.now().strftime("%Y-%m-%d %H:%M"),
        files_json=json.dumps(enriched, ensure_ascii=False),
        pins_json=json.dumps(pins, ensure_ascii=False),
    )

    if output_path:
        output_path = os.path.expanduser(output_path)
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html)
        return output_path

    return html
