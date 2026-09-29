"""Every relative markdown link in tracked docs must resolve."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

SKIP_PARTS = {
    ".git",
    "node_modules",
    ".pio",
    "dist",
    "__pycache__",
    ".pytest_cache",
    "agent/dist",
    "firmware/lib/TrashBot_inferencing",
}

LINK_RE = re.compile(r"\]\(([^)]+)\)")


def _skip(path: Path) -> bool:
    return any(p in SKIP_PARTS for p in path.parts)


def _is_external(target: str) -> bool:
    t = target.strip()
    return t.startswith(("http://", "https://", "mailto:")) or t.startswith("#")


def _resolve(md_file: Path, target: str) -> Path | None:
    t = target.strip().split("#", 1)[0].strip()
    if not t or _is_external(t):
        return None
    base = md_file.parent
    return (base / t).resolve()


def test_markdown_relative_links_resolve():
    broken: list[str] = []
    for md in ROOT.rglob("*.md"):
        if _skip(md):
            continue
        text = md.read_text(encoding="utf-8", errors="replace")
        for m in LINK_RE.finditer(text):
            raw = m.group(1).strip()
            if _is_external(raw):
                continue
            if raw.startswith("<"):
                continue
            resolved = _resolve(md, raw)
            if resolved is None:
                continue
            if not resolved.exists():
                broken.append(f"{md.relative_to(ROOT)}: {raw}")
    assert not broken, "Broken markdown links:\n" + "\n".join(broken[:50])
