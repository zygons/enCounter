#!/usr/bin/env bash
# Copyright (C) 2026 Zygons
# SPDX-License-Identifier: MIT
# See LICENSE for the full license terms.

set -e
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 was not found."
  exit 1
fi

exec python3 programs/launcher.py
