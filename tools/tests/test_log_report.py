import json
import subprocess
import sys
from pathlib import Path


def test_log_report_runs(tmp_path: Path):
    log = tmp_path / "e.json"
    log.write_text(
        json.dumps({"events": [{"type": "item_collected", "label": "test"}]}),
        encoding="utf-8",
    )
    subprocess.run(
        [sys.executable, str(Path(__file__).resolve().parents[1] / "log_report.py"), str(log)],
        check=True,
        capture_output=True,
        text=True,
    )
