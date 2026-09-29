import json
from pathlib import Path

from model_gate import gate


def test_gate_rejects_more_false_positives(tmp_path: Path):
    base = tmp_path / "base.json"
    cand = tmp_path / "cand.json"
    base.write_text(json.dumps({"true_positives": 10, "false_positives": 1, "false_negatives": 1}))
    cand.write_text(json.dumps({"true_positives": 10, "false_positives": 2, "false_negatives": 1}))
    from eval_model import evaluate

    ok, _ = gate(evaluate(cand), evaluate(base))
    assert not ok


def test_gate_accepts_small_regression(tmp_path: Path):
    base = tmp_path / "base.json"
    cand = tmp_path / "cand.json"
    base.write_text(json.dumps({"true_positives": 10, "false_positives": 1, "false_negatives": 1}))
    cand.write_text(json.dumps({"true_positives": 11, "false_positives": 1, "false_negatives": 1}))
    from eval_model import evaluate

    ok, _ = gate(evaluate(cand), evaluate(base))
    assert ok
