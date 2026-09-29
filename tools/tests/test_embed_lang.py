"""Tests for tools/embed_lang.py (standard library + pytest only)."""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "tools" / "embed_lang.py"


def run(*args):
    return subprocess.run([sys.executable, str(SCRIPT), *args], capture_output=True, text=True, encoding="utf-8")


def test_header_contains_both_files_verbatim(tmp_path):
    out = tmp_path / "web_lang.h"
    assert run("--out", str(out)).returncode == 0
    text = out.read_text(encoding="utf-8")
    bodies = dict(re.findall(r'static const char (\w+)\[\] PROGMEM = R"TBJS\((.*?)\)TBJS";', text, flags=re.S))
    lang = (ROOT / "shared/lang/trashbot-lang.mjs").read_text(encoding="utf-8")
    ui = (ROOT / "shared/lang/web/bolo-ui.mjs").read_text(encoding="utf-8")
    assert bodies["WEB_LANG_MJS"] == lang
    assert bodies["WEB_BOLO_UI_MJS"] == ui
    assert "रुको" in bodies["WEB_LANG_MJS"]  # UTF-8 survives


def test_check_detects_stale_and_fresh(tmp_path):
    out = tmp_path / "web_lang.h"
    assert run("--check", "--out", str(out)).returncode == 1  # missing
    assert run("--out", str(out)).returncode == 0
    assert run("--check", "--out", str(out)).returncode == 0  # fresh
    out.write_text(out.read_text(encoding="utf-8") + "// edited\n", encoding="utf-8")
    assert run("--check", "--out", str(out)).returncode == 1  # stale
