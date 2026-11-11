#!/usr/bin/env python3
"""Apply, check or remove the Kintsugi Ember skin on a local Paperclip web UI.

Stdlib only. Idempotent. Touches nothing outside each Paperclip `ui-dist` folder:
  ui-dist/ksk-skin/            the CSS and fonts (copied from this folder)
  ui-dist/index.html           one marked block added after the app stylesheet
  ui-dist/index.html.ksk-original   one-time backup of the untouched index.html

Usage:
  python apply.py              apply to every Paperclip ui-dist found
  python apply.py --check      report whether the skin is applied (exit 1 if any is not)
  python apply.py --remove     restore the original index.html exactly and delete ksk-skin/
  python apply.py --ui-dist PATH [--ui-dist PATH ...]   target specific folders
"""
from __future__ import annotations

import argparse
import glob
import hashlib
import os
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CSS_NAME = "ksk-paperclip.css"
FONT_NAMES = ("fraunces-var.woff2", "inter-var.woff2")
SKIN_DIR = "ksk-skin"
BACKUP_NAME = "index.html.ksk-original"
START = b"<!-- KSK_SKIN_START (kaizen-artifacts/paperclip-skin; remove with apply.py --remove) -->"
END = b"<!-- KSK_SKIN_END -->"
BLOCK_RE = re.compile(rb"\r?\n[ \t]*<!-- KSK_SKIN_START.*?<!-- KSK_SKIN_END -->", re.S)
# The app stylesheet: <link rel="stylesheet" ... href="/assets/index-<hash>.css">
APP_CSS_RE = re.compile(rb'<link[^>]*rel="stylesheet"[^>]*href="/assets/index-[^"]+\.css"[^>]*>')


def find_ui_dists() -> list[Path]:
    """Every installed @paperclipai/server ui-dist with an index.html."""
    roots: list[str] = []
    local = os.environ.get("LOCALAPPDATA")
    appdata = os.environ.get("APPDATA")
    home = Path.home()
    if local:
        roots.append(os.path.join(local, "npm-cache", "_npx", "*", "node_modules"))
    roots.append(str(home / ".npm" / "_npx" / "*" / "node_modules"))
    if appdata:
        roots.append(os.path.join(appdata, "npm", "node_modules"))
        roots.append(os.path.join(appdata, "npm", "node_modules", "paperclipai", "node_modules"))
    found: list[Path] = []
    for root in roots:
        for p in glob.glob(os.path.join(root, "@paperclipai", "server", "ui-dist")):
            path = Path(p).resolve()
            if (path / "index.html").is_file() and path not in found:
                found.append(path)
    return found


def css_version() -> str:
    h = hashlib.sha256((HERE / CSS_NAME).read_bytes())
    for f in FONT_NAMES:
        h.update((HERE / "fonts" / f).read_bytes())
    return h.hexdigest()[:10]


def block(indent: bytes) -> bytes:
    v = css_version().encode()
    # One stylesheet link, plus a one-line script that forces the dark class (the theme is dark-only).
    return (
        b"\n" + indent + START + b"\n"
        + indent + b'<link rel="stylesheet" href="/' + SKIN_DIR.encode() + b"/" + CSS_NAME.encode() + b"?v=" + v + b'">\n'
        + indent + b'<script>(()=>{const d=document.documentElement;d.classList.add("dark");d.style.colorScheme="dark";'
        + b'const m=document.querySelector(\'meta[name="theme-color"]\');if(m)m.setAttribute("content","#121110")})()</script>\n'
        + indent + END
    )


def inside(base: Path, target: Path) -> Path:
    """Refuse any write outside ui-dist."""
    t = target.resolve()
    if t != base and base not in t.parents:
        raise SystemExit(f"refusing to touch {t}: outside {base}")
    return t


def strip_block(html: bytes) -> bytes:
    return BLOCK_RE.sub(b"", html)


def status(ui: Path) -> tuple[bool, str]:
    html = (ui / "index.html").read_bytes()
    has_block = START in html and END in html
    css = ui / SKIN_DIR / CSS_NAME
    if not has_block:
        return False, "not applied"
    if not css.is_file():
        return False, "index.html has the block but ksk-skin/ is missing"
    if css.read_bytes() != (HERE / CSS_NAME).read_bytes() or css_version().encode() not in html:
        return True, "applied, but out of date with this folder (run apply.py again)"
    return True, "applied, current"


def apply(ui: Path) -> str:
    index = inside(ui, ui / "index.html")
    backup = inside(ui, ui / BACKUP_NAME)
    html = index.read_bytes()
    original = strip_block(html)
    if not backup.exists():
        backup.write_bytes(original)
    # Copy skin files (only when changed).
    skin = inside(ui, ui / SKIN_DIR)
    (skin / "fonts").mkdir(parents=True, exist_ok=True)
    pairs = [(HERE / CSS_NAME, skin / CSS_NAME)] + [(HERE / "fonts" / f, skin / "fonts" / f) for f in FONT_NAMES]
    for src, dst in pairs:
        dst = inside(ui, dst)
        if not dst.exists() or dst.read_bytes() != src.read_bytes():
            shutil.copyfile(src, dst)
    m = APP_CSS_RE.search(original)
    if not m:
        raise SystemExit(f"{ui}: could not find the app stylesheet link in index.html; Paperclip's layout changed")
    line_start = original.rfind(b"\n", 0, m.start()) + 1
    indent = re.match(rb"[ \t]*", original[line_start:]).group(0)
    new = original[: m.end()] + block(indent) + original[m.end():]
    if new == html:
        return "already applied, current"
    index.write_bytes(new)
    return "applied"


def remove(ui: Path) -> str:
    index = inside(ui, ui / "index.html")
    backup = inside(ui, ui / BACKUP_NAME)
    html = index.read_bytes()
    stripped = strip_block(html)
    msg = []
    if stripped != html:
        index.write_bytes(stripped)
        msg.append("block removed")
    if backup.exists():
        if backup.read_bytes() == stripped:
            backup.unlink()
            msg.append("matches backup exactly (backup deleted)")
        else:
            msg.append(f"WARNING: index.html differs from {BACKUP_NAME}; kept the backup for you to compare")
    skin = inside(ui, ui / SKIN_DIR)
    if skin.exists():
        shutil.rmtree(skin)
        msg.append("ksk-skin/ deleted")
    return ", ".join(msg) or "nothing to remove"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ui-dist", action="append", type=Path, help="a Paperclip ui-dist folder (repeatable)")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--check", action="store_true", help="report whether the skin is applied")
    g.add_argument("--remove", action="store_true", help="restore the original index.html and delete ksk-skin/")
    args = ap.parse_args()

    uis = [p.resolve() for p in args.ui_dist] if args.ui_dist else find_ui_dists()
    if not uis:
        print("No Paperclip ui-dist found. Pass --ui-dist <path to @paperclipai/server/ui-dist>.")
        return 1
    bad = 0
    for ui in uis:
        if not (ui / "index.html").is_file():
            print(f"SKIP {ui}: no index.html")
            bad += 1
            continue
        if args.check:
            ok, why = status(ui)
            print(f"{'OK  ' if ok else 'NO  '} {ui}: {why}")
            bad += 0 if ok else 1
        elif args.remove:
            print(f"REMOVE {ui}: {remove(ui)}")
        else:
            print(f"APPLY {ui}: {apply(ui)}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
