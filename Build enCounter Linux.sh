#!/usr/bin/env bash
# Copyright (C) 2026 Zygons
# SPDX-License-Identifier: MIT
# See LICENSE for the full license terms.

set -euo pipefail
cd "$(dirname "$0")"

VERSION="0.1.0-alpha.1"
ARCH="$(uname -m)"
case "${ARCH}" in
  amd64) ARCH="x86_64" ;;
  arm64) ARCH="aarch64" ;;
esac
RELEASE_ROOT="release"
RELEASE_NAME="enCounter-v${VERSION}-Linux-${ARCH}"
RELEASE_DIR="${RELEASE_ROOT}/${RELEASE_NAME}"
RELEASE_TAR="${RELEASE_ROOT}/${RELEASE_NAME}.tar.gz"
RELEASE_SHA="${RELEASE_ROOT}/${RELEASE_NAME}.sha256.txt"

echo
echo "=========================================="
echo "  enCounter ${VERSION} Linux Build (${ARCH})"
echo "=========================================="
echo

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 was not found."
  exit 1
fi

if ! python3 -m PyInstaller --version >/dev/null 2>&1; then
  echo "ERROR: PyInstaller is not installed."
  echo "Run: python3 -m pip install -r requirements-build.txt"
  exit 1
fi

rm -rf build dist "${RELEASE_DIR}" "${RELEASE_TAR}" "${RELEASE_SHA}"
mkdir -p "${RELEASE_ROOT}"

echo "Building Linux executable..."
python3 -m PyInstaller \
  --noconfirm \
  --clean \
  --onedir \
  --name enCounter \
  programs/launcher.py

if [[ ! -x "dist/enCounter/enCounter" ]]; then
  echo "ERROR: dist/enCounter/enCounter was not created."
  exit 1
fi

echo "Creating clean portable release..."
mkdir -p "${RELEASE_DIR}"
cp -a dist/enCounter/. "${RELEASE_DIR}/"

mkdir -p "${RELEASE_DIR}/programs"
cp -a programs/app "${RELEASE_DIR}/programs/app"

mkdir -p "${RELEASE_DIR}/assets/branding"
cp -a assets/branding/. "${RELEASE_DIR}/assets/branding/"

for dir in \
  backgrounds/fantasy \
  backgrounds/sci-fi \
  backgrounds/dungeon \
  backgrounds/wilderness \
  backgrounds/custom \
  portraits/players \
  portraits/npcs \
  portraits/enemies \
  portraits/custom \
  icons/conditions \
  icons/combat \
  icons/systems \
  tokens \
  sounds; do
  mkdir -p "${RELEASE_DIR}/assets/${dir}"
done

mkdir -p \
  "${RELEASE_DIR}/data/backups" \
  "${RELEASE_DIR}/data/exports" \
  "${RELEASE_DIR}/data/imports"

[[ -d docs ]] && cp -a docs "${RELEASE_DIR}/docs"
cp LICENSE README.md AI_ASSISTANCE.md PRIVACY.md THIRD_PARTY_NOTICES.md "${RELEASE_DIR}/"

# Defensive cleanup: no prior user data may ship.
find "${RELEASE_DIR}/data/backups" -mindepth 1 -delete
find "${RELEASE_DIR}/data/exports" -mindepth 1 -delete
find "${RELEASE_DIR}/data/imports" -mindepth 1 -delete
rm -f "${RELEASE_DIR}/data/enCounter-startup-error.log"

chmod +x "${RELEASE_DIR}/enCounter"

echo "Creating tar.gz package..."
tar -C "${RELEASE_ROOT}" -czf "${RELEASE_TAR}" "${RELEASE_NAME}"
sha256sum "${RELEASE_TAR}" | sed "s#${RELEASE_ROOT}/##" > "${RELEASE_SHA}"

echo
echo "=========================================="
echo "          LINUX BUILD COMPLETE"
echo "=========================================="
echo
echo "Portable folder: ${RELEASE_DIR}"
echo "Archive: ${RELEASE_TAR}"
echo "SHA-256: ${RELEASE_SHA}"
echo "License: MIT"
echo
echo "This build contains NO previous backups, exports, imports,"
echo "saved Library data, or personal campaign assets."
echo
echo "NOTE: Browser IndexedDB lives outside the folder."
echo "This Alpha uses enCounterAlphaDB."
