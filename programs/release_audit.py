from __future__ import annotations

# Copyright (C) 2026 Zygons
# SPDX-License-Identifier: MIT
# This file is part of enCounter. See LICENSE for the full license terms.

import argparse
import os
import sys
from pathlib import Path


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def audit_release(root: Path, platform: str) -> None:
    root = root.resolve()
    if not root.is_dir():
        fail(f"Release directory does not exist: {root}")

    required = [
        "programs/app/index.html",
        "programs/app/display.html",
        "programs/app/js/theme-bootstrap.js",
        "assets/branding/enCounter-logo.png",
        "assets/branding/enCounter-icon.png",
        "assets/branding/favicon.png",
        "docs/enCounter User Guide.pdf",
        "enCounter User Guide.pdf",
        "LICENSE",
        "README.md",
        "CHANGELOG.md",
        "AI_ASSISTANCE.md",
        "PRIVACY.md",
        "THIRD_PARTY_NOTICES.md",
    ]

    executable = "enCounter.exe" if platform == "windows" else "enCounter"
    required.append(executable)

    missing = [item for item in required if not (root / item).is_file()]
    if missing:
        fail("Release is missing required files: " + ", ".join(missing))

    if platform == "linux" and not os.access(root / executable, os.X_OK):
        fail("Linux executable is not marked executable.")

    forbidden_roots = [".git", "tests", "build", "dist", "release"]
    present_forbidden = [name for name in forbidden_roots if (root / name).exists()]
    if present_forbidden:
        fail("Release contains development-only paths: " + ", ".join(present_forbidden))

    data_root = root / "data"
    if not data_root.is_dir():
        fail("Release data directory is missing.")
    leaked_data = [path for path in data_root.rglob("*") if path.is_file()]
    if leaked_data:
        fail(
            "Release contains runtime/user data: "
            + ", ".join(str(path.relative_to(root)) for path in leaked_data[:20])
        )

    asset_root = root / "assets"
    if not asset_root.is_dir():
        fail("Release assets directory is missing.")
    leaked_assets = []
    for path in asset_root.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(asset_root).as_posix()
        if not relative.startswith("branding/"):
            leaked_assets.append(path)
    if leaked_assets:
        fail(
            "Release contains non-branding campaign/user assets: "
            + ", ".join(str(path.relative_to(root)) for path in leaked_assets[:20])
        )

    print(f"Release audit passed: {root}")
    print(f"Platform: {platform}")
    print("Runtime data files: 0")
    print("Non-branding packaged assets: 0")


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit an enCounter portable release folder.")
    parser.add_argument("release_dir", type=Path)
    parser.add_argument("--platform", choices=("windows", "linux"), required=True)
    args = parser.parse_args()
    audit_release(args.release_dir, args.platform)


if __name__ == "__main__":
    main()
