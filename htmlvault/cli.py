"""HTMLVault CLI — scan and serve HTML galleries."""

import os
import subprocess
import sys
import webbrowser

import click

from htmlvault.scanner import scan
from htmlvault.generator import generate
from htmlvault.server import serve, load_pins


def _resolve_dirs(directories):
    """Expand and validate directory paths."""
    resolved = []
    for d in directories:
        d = os.path.expanduser(d)
        d = os.path.abspath(d)
        if not os.path.isdir(d):
            click.echo(f"Warning: {d} is not a directory, skipping.", err=True)
            continue
        resolved.append(d)
    return resolved


def _vault_dir(base_dir):
    """Return .htmlvault/ dir path inside the scanned directory."""
    return os.path.join(base_dir, ".htmlvault")


def _pins_file(base_dir):
    """Return pins.json path."""
    return os.path.join(_vault_dir(base_dir), "pins.json")


@click.group()
@click.version_option()
def main():
    """HTMLVault — Your AI-generated HTML showcase."""
    pass


@main.command()
@click.argument("directories", nargs=-1, required=True)
@click.option("-o", "--output", default="gallery.html", help="Output file path.")
def scan_cmd(directories, output):
    """Scan directories and generate a static gallery HTML."""
    dirs = _resolve_dirs(directories)
    if not dirs:
        click.echo("Error: no valid directories.", err=True)
        sys.exit(1)

    base_dir = dirs[0]  # primary dir for display
    click.echo(f"Scanning {len(dirs)} director{'ies' if len(dirs) > 1 else 'y'}...")

    files = scan(dirs)
    click.echo(f"Found {len(files)} HTML files.")

    if not files:
        click.echo("Nothing to generate.")
        return

    pins = load_pins(_pins_file(base_dir))
    out = generate(files, base_dir, pins=pins, output_path=output)
    click.echo(f"Gallery written to {out}")


@main.command()
@click.argument("directories", nargs=-1, required=True)
@click.option("-p", "--port", default=7749, help="Server port.")
@click.option("--no-open", is_flag=True, help="Don't auto-open browser.")
def serve_cmd(directories, port, no_open):
    """Start a local server with live gallery (recommended)."""
    dirs = _resolve_dirs(directories)
    if not dirs:
        click.echo("Error: no valid directories.", err=True)
        sys.exit(1)

    base_dir = dirs[0]
    click.echo(f"Scanning {len(dirs)} director{'ies' if len(dirs) > 1 else 'y'}...")

    files = scan(dirs)
    click.echo(f"Found {len(files)} HTML files.")

    if not files:
        click.echo("No HTML files found.")
        return

    pins_path = _pins_file(base_dir)
    pins = load_pins(pins_path)
    gallery_html = generate(files, base_dir, pins=pins)

    if not no_open:
        # Open browser after a short delay
        import threading
        def _open():
            import time
            time.sleep(0.8)
            webbrowser.open(f"http://localhost:{port}")
        threading.Thread(target=_open, daemon=True).start()

    serve(gallery_html, pins_path, base_dir, port=port)


# Register commands with proper names
main.add_command(scan_cmd, "scan")
main.add_command(serve_cmd, "serve")
