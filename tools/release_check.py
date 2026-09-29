#!/usr/bin/env python3
"""Release gate: GO / NO-GO. Respects TRASHBOT_NO_NATIVE on office laptops."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from native_env import native_skipped, SKIP_MSG


def run(cmd: list[str], cwd: Path | None = None) -> bool:
    label = " ".join(cmd[:4])
    print(f"\n>> {label}...")
    r = subprocess.run(cmd, cwd=str(cwd or ROOT))
    ok = r.returncode == 0
    print(f"   {'PASS' if ok else 'FAIL'} ({r.returncode})")
    return ok


def main() -> int:
    os.chdir(ROOT)
    results: list[tuple[str, bool]] = []

    results.append(("firmware xiao build", run([sys.executable, "-m", "platformio", "run", "-d", "firmware", "-e", "xiao"])))
    if native_skipped():
        print(f"\n>> core tests (zig): SKIP\n   {SKIP_MSG}")
        results.append(("core tests (zig)", True))
        results.append(("sim suite", True))
    else:
        results.append(("core tests (zig)", run([sys.executable, "tools/run_core_tests.py"])))
        results.append(("sim build", run([sys.executable, "tools/sim/build_sim_brain.py"])))
        results.append(
            (
                "sim suite",
                run([sys.executable, "tools/sim/run.py", "--suite", "all", "--runs", "3"]),
            )
        )

    results.append(("pytest tools", run([sys.executable, "-m", "pytest", "tools", "-q"])))

    agent = ROOT / "agent"
    results.append(("agent build", run(["npm", "run", "build"], cwd=agent)))
    results.append(("agent test", run(["npm", "test"], cwd=agent)))
    if os.name != "nt" or os.environ.get("TRASHBOT_E2E_LOCAL") == "1":
        results.append(("e2e", run(["npm", "test"], cwd=ROOT / "e2e")))
    else:
        print("\n>> e2e: SKIP (office laptop — CI only; set TRASHBOT_E2E_LOCAL=1 to force)")
        results.append(("e2e", True))

    if not native_skipped():
        results.append(("verify:mcpb", run(["npm", "run", "verify:mcpb"], cwd=agent)))
    else:
        print("\n>> verify:mcpb: SKIP (TRASHBOT_NO_NATIVE)")
        results.append(("verify:mcpb", True))

    print("\n=== Release check ===")
    failed = [n for n, ok in results if not ok]
    for name, ok in results:
        print(f"  {'GO' if ok else 'NO-GO':6} {name}")
    if failed:
        print(f"\nNO-GO ({len(failed)} failed)")
        return 1
    print("\nGO — safe to flash after your own hardware checks (see USER_STEPS.md G0).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
