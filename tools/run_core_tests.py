#!/usr/bin/env python3
"""Compile and run firmware/lib/core Unity suites with ziglang (no admin toolchain)."""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

from native_env import native_skipped, skip_exit_ok

ROOT = Path(__file__).resolve().parents[1]
FW = ROOT / "firmware"
UNITY = FW / "test" / "unity"
CORE = FW / "lib" / "core"
INCLUDE = FW / "include"
TEST_ROOT = FW / "test"
BUILD = ROOT / "tools" / ".core_test_build"

CORE_SOURCES = sorted(CORE.glob("*.cpp"))


def zig_cpp(args: list[str]) -> subprocess.CompletedProcess[str]:
    cmd = [sys.executable, "-m", "ziglang", "c++", "-std=c++17"] + args
    return subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT))


def discover_suites() -> list[tuple[str, Path]]:
    suites: list[tuple[str, Path]] = []
    for d in sorted(TEST_ROOT.glob("test_*")):
        if d.name == "test_unity":
            continue
        cpp = d / f"{d.name}.cpp"
        if cpp.is_file():
            suites.append((d.name, cpp))
    return suites


def compile_c_objs(sources: list[Path], build_dir: Path) -> tuple[list[Path], str | None]:
    objs: list[Path] = []
    for src in sources:
        obj = build_dir / (src.stem + ".obj")
        cmd = [
            sys.executable,
            "-m",
            "ziglang",
            "cc",
            "-std=c17",
            f"-I{UNITY}",
            "-O0",
            "-g",
            "-c",
            str(src),
            "-o",
            str(obj),
        ]
        r = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT))
        if r.returncode != 0:
            return [], (r.stderr or r.stdout or f"{src.name} compile failed").strip()
        objs.append(obj)
    return objs, None


def compile_suite(name: str, test_cpp: Path, c_objs: list[Path], out: Path) -> str | None:
    out.parent.mkdir(parents=True, exist_ok=True)
    sources = [str(test_cpp)] + [str(o) for o in c_objs] + [str(p) for p in CORE_SOURCES]
    flags = [
        "-DUNIT_TEST",
        f"-I{UNITY}",
        f"-I{CORE}",
        f"-I{INCLUDE}",
        "-O0",
        "-g",
        *sources,
        "-o",
        str(out),
    ]
    if sys.platform == "win32":
        flags.insert(0, "-static")
    r = zig_cpp(flags)
    if r.returncode != 0:
        return (r.stderr or r.stdout or "compile failed").strip()
    return None


def run_exe(exe: Path) -> tuple[int, str]:
    r = subprocess.run([str(exe)], capture_output=True, text=True, cwd=str(ROOT))
    out = (r.stdout or "") + (r.stderr or "")
    return r.returncode, out


def main() -> int:
    if native_skipped():
        return skip_exit_ok()
    if not UNITY.joinpath("unity.h").is_file():
        print("Missing vendored Unity in firmware/test/unity/", file=sys.stderr)
        return 1

    suites = discover_suites()
    if BUILD.exists():
        shutil.rmtree(BUILD)
    BUILD.mkdir(parents=True)

    c_objs, uerr = compile_c_objs([UNITY / "unity.c", UNITY / "unity_port.c"], BUILD)
    if uerr:
        print(uerr, file=sys.stderr)
        return 1

    results: list[tuple[str, bool, str]] = []
    for name, cpp in suites:
        exe = BUILD / (name + (".exe" if sys.platform == "win32" else ""))
        err = compile_suite(name, cpp, c_objs, exe)
        if err:
            results.append((name, False, f"COMPILE: {err[:500]}"))
            continue
        code, out = run_exe(exe)
        ok = code == 0
        tail = out.strip().splitlines()[-8:] if out.strip() else ["(no output)"]
        results.append((name, ok, "\n".join(tail)))

    print("\n=== Core test summary ===")
    passed = 0
    for name, ok, detail in results:
        status = "PASS" if ok else "FAIL"
        if ok:
            passed += 1
        print(f"  {name}: {status}")
        if not ok:
            print(detail)
    print(f"\n{passed}/{len(results)} suites passed")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
