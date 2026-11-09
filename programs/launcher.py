from __future__ import annotations

# Copyright (C) 2026 Zygons
# SPDX-License-Identifier: MIT
# This file is part of enCounter. See LICENSE for the full license terms.

import http.server
import json
import os
import posixpath
import re
import socket
import socketserver
import sys
import threading
import time
import urllib.parse
import urllib.request
import urllib.error
import webbrowser
from datetime import datetime, timezone
from pathlib import Path

PORT = int(os.environ.get("ENCOUNTER_PORT", "5500"))
APP_NAME = "enCounter"
APP_VERSION = "0.3.0-alpha.1"
APP_STAGE = "Alpha"
COMPENDIUM_PROXY_VERSION = "3.1.12.4"

if getattr(sys, "frozen", False):
    # Running as a PyInstaller executable.
    # sys.executable points to enCounter.exe (Windows) or enCounter (Linux).
    ROOT = Path(sys.executable).resolve().parent
    PROGRAMS_DIR = ROOT / "programs"
else:
    # Running normally from launcher.py.
    PROGRAMS_DIR = Path(__file__).resolve().parent
    ROOT = PROGRAMS_DIR.parent

APP_URL = f"http://127.0.0.1:{PORT}/programs/app/index.html"

BACKUP_DIR = ROOT / "data" / "backups"
EXPORT_DIR = ROOT / "data" / "exports"
IMPORT_DIR = ROOT / "data" / "imports"
COMPENDIUM_CACHE_DIR = ROOT / "data" / "cache" / "compendium"
SRD_BASE_URL = "https://www.dnd5eapi.co"
SRD_INDEX_PATH = "/api/2014/monsters"
SRD_CACHE_MAX_AGE_SECONDS = 24 * 60 * 60

ALLOWED_ASSET_CATEGORIES = {
    "backgrounds/fantasy",
    "backgrounds/sci-fi",
    "backgrounds/dungeon",
    "backgrounds/wilderness",
    "backgrounds/custom",
    "portraits/players",
    "portraits/npcs",
    "portraits/enemies",
    "portraits/custom",
    "icons/conditions",
    "icons/combat",
    "icons/systems",
    "tokens",
    "sounds/music",
    "sounds/ambience",
    "sounds/sfx",
    "sounds/custom",
}
ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
ALLOWED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".ogg", ".flac"}
PUBLIC_ASSET_EXTENSIONS = ALLOWED_IMAGE_EXTENSIONS | ALLOWED_AUDIO_EXTENSIONS | {".ico"}
APP_FILE_EXTENSIONS = {".html", ".css", ".js", ".map"}
DOC_FILE_EXTENSIONS = {".html", ".md", ".txt"}
PUBLIC_ROOT_FILES = {
    "/LICENSE",
    "/README.md",
    "/AI_ASSISTANCE.md",
    "/PRIVACY.md",
    "/THIRD_PARTY_NOTICES.md",
    "/CHANGELOG.md",
}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024
MAX_BACKUP_BYTES = 50 * 1024 * 1024

def console_print(*args, **kwargs):
    """Print only when a console is attached; stay silent under pythonw.exe."""
    try:
        if sys.stdout is not None:
            print(*args, **kwargs)
    except Exception:
        pass


def browser_launch_enabled() -> bool:
    value = os.environ.get("ENCOUNTER_NO_BROWSER", "").strip().lower()
    return value not in {"1", "true", "yes", "on"}


def ensure_runtime_layout() -> None:
    """Create writable runtime folders only when the launcher actually starts."""
    for path in [BACKUP_DIR, EXPORT_DIR, IMPORT_DIR, COMPENDIUM_CACHE_DIR]:
        path.mkdir(parents=True, exist_ok=True)
    for category in ALLOWED_ASSET_CATEGORIES:
        (ROOT / "assets" / category).mkdir(parents=True, exist_ok=True)
    (ROOT / "assets" / "sounds").mkdir(parents=True, exist_ok=True)


def write_startup_error(message: str) -> None:
    try:
        log_path = ROOT / "data" / "enCounter-startup-error.log"
        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_path.write_text(message, encoding="utf-8")
    except OSError:
        pass


def show_startup_error(message: str) -> None:
    write_startup_error(message)
    console_print(message)

    if os.name == "nt":
        try:
            import ctypes

            ctypes.windll.user32.MessageBoxW(
                None,
                message,
                f"{APP_NAME} startup error",
                0x10,
            )
        except Exception:
            pass


def current_server_is_compatible(timeout: float = 0.8) -> bool:
    """Return True when this port already hosts the current enCounter server."""
    status_url = f"http://127.0.0.1:{PORT}/api/compendium/dnd5e/status"
    request = urllib.request.Request(
        status_url,
        headers={"Accept": "application/json"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return (
            isinstance(payload, dict)
            and payload.get("ok") is True
            and payload.get("proxyVersion") == COMPENDIUM_PROXY_VERSION
        )
    except (OSError, ValueError, json.JSONDecodeError, UnicodeDecodeError):
        return False


def safe_name(name: str) -> str:
    base = Path(name).name
    sanitized = re.sub(r"[^A-Za-z0-9._ -]+", "_", base).strip(" .")
    return sanitized or "asset"


def unique_path(folder: Path, name: str) -> Path:
    candidate = folder / name
    if not candidate.exists():
        return candidate

    stem = candidate.stem
    suffix = candidate.suffix
    counter = 2
    while True:
        candidate = folder / f"{stem}-{counter}{suffix}"
        if not candidate.exists():
            return candidate
        counter += 1


def detect_image_type(data: bytes) -> str | None:
    """Return the MIME type for supported image signatures, or None."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def detect_audio_type(data: bytes) -> str | None:
    """Return a normalized MIME type for supported audio signatures, or None."""
    if data.startswith(b"ID3"):
        return "audio/mpeg"
    if len(data) >= 2 and data[0] == 0xFF and (data[1] & 0xE0) == 0xE0:
        return "audio/mpeg"
    if data.startswith(b"OggS"):
        return "audio/ogg"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WAVE":
        return "audio/wav"
    if data.startswith(b"fLaC"):
        return "audio/flac"
    return None


def compendium_cache_path(name: str) -> Path:
    safe = re.sub(r"[^a-z0-9-]+", "-", name.lower()).strip("-")
    return COMPENDIUM_CACHE_DIR / f"dnd5e-2014-{safe}.json"


def read_json_cache(path: Path):
    try:
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def write_json_cache(path: Path, payload) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix(path.suffix + ".tmp")
        temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(temp, path)
    except OSError as exc:
        console_print(f"Compendium cache write failed: {exc}")


def cache_is_fresh(path: Path, max_age_seconds: int = SRD_CACHE_MAX_AGE_SECONDS) -> bool:
    try:
        return path.exists() and (time.time() - path.stat().st_mtime) <= max_age_seconds
    except OSError:
        return False


def fetch_srd_json(path: str, timeout: int = 15):
    upstream = f"{SRD_BASE_URL}{path}"
    request = urllib.request.Request(
        upstream,
        headers={
            "Accept": "application/json",
            "User-Agent": f"{APP_NAME}/{APP_VERSION}",
        },
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


class EnCounterHandler(http.server.SimpleHTTPRequestHandler):
    server_version = f"{APP_NAME}Local/{APP_VERSION}"
    sys_version = ""

    def version_string(self):
        # Do not disclose the embedded/system Python version in HTTP headers.
        return self.server_version

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        console_print(f"[{self.log_date_time_string()}] {fmt % args}")

    def end_headers(self):
        # Local-only application hardening. These headers do not make enCounter
        # an internet-facing service; the server remains bound to 127.0.0.1.
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
        )
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; "
            "connect-src 'self' https://www.dnd5eapi.co; "
            "font-src 'self'; "
            "object-src 'none'; "
            "base-uri 'none'; "
            "frame-ancestors 'none'; "
            "form-action 'self'",
        )

        # Browser caches should never strand a user on stale Alpha code after
        # replacing a portable build. HTML is never stored; JS/CSS/assets are
        # revalidated on each load while still allowing conditional requests.
        request_path = urllib.parse.urlparse(self.path).path
        if not request_path.startswith("/api/"):
            if request_path == "/" or request_path.lower().endswith(".html"):
                self.send_header("Cache-Control", "no-store")
            else:
                self.send_header("Cache-Control", "no-cache")

        super().end_headers()

    def send_json(self, payload, status=200):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def send_text(self, text, status=400):
        data = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _request_path(self) -> str:
        raw_path = urllib.parse.unquote(urllib.parse.urlparse(self.path).path)
        normalized = posixpath.normpath(raw_path)
        if not normalized.startswith("/"):
            normalized = "/" + normalized
        return normalized

    def _is_local_host(self) -> bool:
        host = self.headers.get("Host", "").strip().lower()
        if not host:
            return False
        if host.startswith("["):
            hostname = host.split("]", 1)[0].lstrip("[")
        else:
            hostname = host.split(":", 1)[0]
        return hostname in {"127.0.0.1", "localhost"}

    def _origin_is_local(self) -> bool:
        origin = self.headers.get("Origin")
        if not origin:
            # Same-origin requests made by some clients omit Origin.
            return True
        try:
            parsed = urllib.parse.urlparse(origin)
            return (
                parsed.scheme == "http"
                and parsed.hostname in {"127.0.0.1", "localhost"}
                and parsed.port == PORT
            )
        except ValueError:
            return False

    def _is_allowed_static_path(self, path: str) -> bool:
        if path in PUBLIC_ROOT_FILES:
            return True

        if path.startswith("/programs/app/"):
            return not path.endswith("/") and Path(path).suffix.lower() in APP_FILE_EXTENSIONS

        if path.startswith("/docs/"):
            return not path.endswith("/") and Path(path).suffix.lower() in DOC_FILE_EXTENSIONS

        if path.startswith("/assets/"):
            parts = Path(path).parts
            if any(part.startswith(".") for part in parts):
                return False
            return not path.endswith("/") and Path(path).suffix.lower() in PUBLIC_ASSET_EXTENSIONS

        return False

    def _read_content_length(self, maximum: int) -> int | None:
        value = self.headers.get("Content-Length")
        if value is None:
            return None
        try:
            length = int(value)
        except (TypeError, ValueError):
            return None
        if length <= 0 or length > maximum:
            return None
        return length

    def _reject_nonlocal_request(self) -> bool:
        if self._is_local_host():
            return False
        self.send_text("enCounter only accepts requests addressed to localhost.", 403)
        return True

    def do_HEAD(self):
        if self._reject_nonlocal_request():
            return
        if not self._origin_is_local():
            return self.send_text("Cross-origin requests are not allowed.", 403)
        path = self._request_path()
        if not self._is_allowed_static_path(path):
            self.send_error(404, "File not found")
            return
        super().do_HEAD()

    def do_GET(self):
        if self._reject_nonlocal_request():
            return
        if not self._origin_is_local():
            return self.send_text("Cross-origin requests are not allowed.", 403)

        path = self._request_path()

        if path == "/":
            self.send_response(302)
            self.send_header("Location", "/programs/app/index.html")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return

        # ============================================================
        # D&D 5E SRD Compendium API — Phase 3.1.12 production proxy
        # ============================================================

        if path == "/api/compendium/dnd5e/status":
            index_cache = compendium_cache_path("monsters-index")
            return self.send_json(
                {
                    "ok": True,
                    "provider": "dnd5eapi-srd-2014",
                    "apiVersion": "2014",
                    "proxyVersion": COMPENDIUM_PROXY_VERSION,
                    "upstream": f"{SRD_BASE_URL}{SRD_INDEX_PATH}",
                    "port": PORT,
                    "indexCached": index_cache.exists(),
                    "indexCacheFresh": cache_is_fresh(index_cache),
                    "indexCacheAgeSeconds": round(max(0, time.time() - index_cache.stat().st_mtime), 1)
                    if index_cache.exists()
                    else None,
                    "detailCacheCount": len(
                        list(COMPENDIUM_CACHE_DIR.glob("dnd5e-2014-monster-*.json"))
                    ),
                    "cacheMaxAgeHours": round(SRD_CACHE_MAX_AGE_SECONDS / 3600, 1),
                }
            )

        if path == "/api/compendium/dnd5e/monsters":
            cache_path = compendium_cache_path("monsters-index")
            cached = read_json_cache(cache_path)

            if cached is not None and cache_is_fresh(cache_path):
                return self.send_json(
                    {
                        **cached,
                        "_encounter": {"source": "disk-cache", "stale": False},
                    }
                )

            try:
                payload = fetch_srd_json(SRD_INDEX_PATH)
                if not isinstance(payload, dict) or not isinstance(payload.get("results"), list):
                    raise ValueError("Upstream returned an invalid monster index.")
                write_json_cache(cache_path, payload)
                return self.send_json(
                    {
                        **payload,
                        "_encounter": {"source": "live-api", "stale": False},
                    }
                )
            except urllib.error.HTTPError as exc:
                reason = f"D&D 5e SRD API returned HTTP {exc.code}."
            except urllib.error.URLError as exc:
                reason = f"Could not reach D&D 5e SRD API: {getattr(exc, 'reason', exc)}"
            except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as exc:
                reason = f"SRD index request failed: {exc}"
            except Exception as exc:
                reason = f"SRD index request failed: {exc}"

            if cached is not None:
                return self.send_json(
                    {
                        **cached,
                        "_encounter": {
                            "source": "disk-cache",
                            "stale": True,
                            "warning": reason,
                        },
                    }
                )
            return self.send_json({"error": reason}, 502)

        if path.startswith("/api/compendium/dnd5e/monsters/"):
            key = urllib.parse.unquote(path.rsplit("/", 1)[-1]).strip().lower()
            if not re.fullmatch(r"[a-z0-9-]+", key):
                return self.send_json({"error": "Invalid SRD monster index."}, 400)

            cache_path = compendium_cache_path(f"monster-{key}")
            cached = read_json_cache(cache_path)

            if cached is not None and cache_is_fresh(cache_path):
                return self.send_json(
                    {
                        **cached,
                        "_encounter": {"source": "disk-cache", "stale": False},
                    }
                )

            try:
                payload = fetch_srd_json(
                    f"{SRD_INDEX_PATH}/{urllib.parse.quote(key, safe='')}"
                )
                if not isinstance(payload, dict) or not payload.get("name"):
                    raise ValueError("Upstream returned an invalid monster record.")
                write_json_cache(cache_path, payload)
                return self.send_json(
                    {
                        **payload,
                        "_encounter": {"source": "live-api", "stale": False},
                    }
                )
            except urllib.error.HTTPError as exc:
                reason = f"D&D 5e SRD API returned HTTP {exc.code}."
            except urllib.error.URLError as exc:
                reason = f"Could not reach D&D 5e SRD API: {getattr(exc, 'reason', exc)}"
            except (ValueError, json.JSONDecodeError, UnicodeDecodeError) as exc:
                reason = f"SRD monster request failed: {exc}"
            except Exception as exc:
                reason = f"SRD monster request failed: {exc}"

            if cached is not None:
                return self.send_json(
                    {
                        **cached,
                        "_encounter": {
                            "source": "disk-cache",
                            "stale": True,
                            "warning": reason,
                        },
                    }
                )
            return self.send_json({"error": reason}, 502)

        if path == "/api/assets":
            assets = []
            asset_root = ROOT / "assets"

            for file_path in sorted(asset_root.rglob("*")):
                if not file_path.is_file() or file_path.name.startswith("."):
                    continue

                relative = file_path.relative_to(asset_root).as_posix()

                # Branding files are application resources, not user-selectable assets.
                if relative.startswith("branding/"):
                    continue

                if file_path.suffix.lower() not in PUBLIC_ASSET_EXTENSIONS:
                    continue
                if file_path.suffix.lower() == ".ico":
                    continue

                category = Path(relative).parent.as_posix()
                assets.append(
                    {
                        "name": file_path.name,
                        "category": category,
                        "url": "/assets/" + urllib.parse.quote(relative, safe="/"),
                    }
                )

            return self.send_json({"assets": assets})

        if path == "/api/backup/latest":
            backup_path = BACKUP_DIR / "backup-latest.json"
            if not backup_path.exists():
                return self.send_text("No external backup exists yet.", 404)

            try:
                payload = json.loads(backup_path.read_text(encoding="utf-8"))
                return self.send_json(payload)
            except (OSError, json.JSONDecodeError) as exc:
                console_print(f"Could not read latest backup: {exc}")
                return self.send_text("The latest backup could not be read.", 500)

        if not self._is_allowed_static_path(path):
            self.send_error(404, "File not found")
            return

        return super().do_GET()

    def do_POST(self):
        if self._reject_nonlocal_request():
            return
        if not self._origin_is_local():
            return self.send_text("Cross-origin requests are not allowed.", 403)

        path = self._request_path()

        if path == "/api/shutdown":
            self.send_json({"ok": True, "message": "enCounter is shutting down."})
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return

        if path == "/api/assets/upload":
            params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            category = params.get("category", [""])[0]
            requested_name = params.get("name", ["asset"])[0]

            if category not in ALLOWED_ASSET_CATEGORIES:
                return self.send_text("That asset folder is not allowed.", 400)

            content_length = self._read_content_length(MAX_UPLOAD_BYTES)
            if content_length is None:
                return self.send_text("Asset must be between 1 byte and 50 MB.", 400)

            filename = safe_name(requested_name)
            extension = Path(filename).suffix.lower()
            is_audio = category.startswith("sounds/")
            allowed_extensions = ALLOWED_AUDIO_EXTENSIONS if is_audio else ALLOWED_IMAGE_EXTENSIONS
            if extension not in allowed_extensions:
                return self.send_text(
                    "Only MP3, OGG, WAV, and FLAC audio files are allowed."
                    if is_audio
                    else "Only PNG, JPEG, and WebP images are allowed.",
                    400,
                )

            content_type = self.headers.get("Content-Type", "").split(";", 1)[0].lower()
            if is_audio:
                allowed_mimes = {
                    ".mp3": {"audio/mpeg", "audio/mp3"},
                    ".ogg": {"audio/ogg", "application/ogg"},
                    ".wav": {"audio/wav", "audio/x-wav", "audio/wave"},
                    ".flac": {"audio/flac", "audio/x-flac"},
                }
                if content_type not in allowed_mimes[extension]:
                    return self.send_text("The file extension does not match its audio type.", 400)
                data = self.rfile.read(content_length)
                detected_audio = detect_audio_type(data)
                normalized_expected = {
                    ".mp3": "audio/mpeg",
                    ".ogg": "audio/ogg",
                    ".wav": "audio/wav",
                    ".flac": "audio/flac",
                }[extension]
                if detected_audio != normalized_expected:
                    return self.send_text("The uploaded file is not valid supported audio.", 400)
            else:
                expected_mime = {
                    ".png": "image/png",
                    ".jpg": "image/jpeg",
                    ".jpeg": "image/jpeg",
                    ".webp": "image/webp",
                }[extension]
                if content_type != expected_mime:
                    return self.send_text("The file extension does not match its image type.", 400)
                data = self.rfile.read(content_length)
                detected_mime = detect_image_type(data)
                if detected_mime != expected_mime:
                    return self.send_text("The uploaded file is not a valid supported image.", 400)

            folder = ROOT / "assets" / category
            folder.mkdir(parents=True, exist_ok=True)
            target = unique_path(folder, filename)
            target.write_bytes(data)
            relative = target.relative_to(ROOT / "assets").as_posix()

            return self.send_json(
                {
                    "ok": True,
                    "name": target.name,
                    "category": category,
                    "url": "/assets/" + urllib.parse.quote(relative, safe="/"),
                }
            )

        if path == "/api/backup":
            content_length = self._read_content_length(MAX_BACKUP_BYTES)
            if content_length is None:
                return self.send_text("Backup is empty or too large.", 400)

            raw = self.rfile.read(content_length)
            try:
                payload = json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                return self.send_text("Backup was not valid JSON.", 400)

            if not isinstance(payload, dict) or payload.get("app") != APP_NAME:
                return self.send_text("Backup does not identify itself as enCounter data.", 400)

            BACKUP_DIR.mkdir(parents=True, exist_ok=True)
            latest = BACKUP_DIR / "backup-latest.json"
            temp = BACKUP_DIR / "backup-latest.tmp"

            try:
                temp.write_text(
                    json.dumps(payload, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
                os.replace(temp, latest)
            except OSError as exc:
                console_print(f"Could not write latest backup: {exc}")
                temp.unlink(missing_ok=True)
                return self.send_text("The external backup could not be written.", 500)

            marker = BACKUP_DIR / ".last-hourly"
            create_hourly = True
            if marker.exists():
                try:
                    last = float(marker.read_text(encoding="utf-8"))
                    create_hourly = time.time() - last >= 3600
                except (OSError, ValueError):
                    create_hourly = True

            if create_hourly:
                try:
                    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%SZ")
                    snapshot = BACKUP_DIR / f"backup-{stamp}.json"
                    snapshot.write_text(
                        json.dumps(payload, ensure_ascii=False, indent=2),
                        encoding="utf-8",
                    )
                    marker.write_text(str(time.time()), encoding="utf-8")
                    snapshots = sorted(
                        BACKUP_DIR.glob("backup-20*.json"),
                        key=lambda item: item.stat().st_mtime,
                    )
                    while len(snapshots) > 20:
                        snapshots.pop(0).unlink(missing_ok=True)
                except OSError as exc:
                    # The latest backup already succeeded, so do not fail the request
                    # solely because hourly history rotation failed.
                    console_print(f"Could not update hourly backup history: {exc}")

            return self.send_json({"ok": True, "path": str(latest.relative_to(ROOT))})

        return self.send_text("Unknown API endpoint.", 404)


    def do_DELETE(self):
        if self._reject_nonlocal_request():
            return
        if not self._origin_is_local():
            return self.send_text("Cross-origin requests are not allowed.", 403)

        path = self._request_path()
        if path != "/api/assets/delete":
            return self.send_text("Unknown API endpoint.", 404)

        params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        requested_url = params.get("url", [""])[0]
        if not requested_url.startswith("/assets/"):
            return self.send_text("Only local enCounter assets can be deleted.", 400)

        try:
            relative = urllib.parse.unquote(requested_url[len("/assets/"):]).replace("\\", "/")
            asset_root = (ROOT / "assets").resolve()
            target = (asset_root / Path(relative)).resolve()
        except (OSError, ValueError):
            return self.send_text("That asset path is invalid.", 400)

        if target == asset_root or asset_root not in target.parents:
            return self.send_text("That asset path is outside the Asset Library.", 403)

        try:
            category = target.parent.relative_to(asset_root).as_posix()
        except ValueError:
            return self.send_text("That asset path is outside the Asset Library.", 403)

        if category == "branding" or category.startswith("branding/"):
            return self.send_text("Application branding assets cannot be deleted.", 403)
        if category not in ALLOWED_ASSET_CATEGORIES:
            return self.send_text("That asset folder is not managed by enCounter.", 403)
        if target.suffix.lower() not in PUBLIC_ASSET_EXTENSIONS or target.suffix.lower() == ".ico":
            return self.send_text("That file type cannot be deleted from the Asset Library.", 400)
        if not target.exists() or not target.is_file():
            return self.send_text("The asset file no longer exists.", 404)

        try:
            target.unlink()
        except OSError as exc:
            console_print(f"Asset deletion failed: {exc}")
            return self.send_text("The asset file could not be deleted.", 500)

        return self.send_json({
            "ok": True,
            "name": target.name,
            "category": category,
            "url": requested_url,
        })

    def do_OPTIONS(self):
        # enCounter does not expose a cross-origin API.
        self.send_response(405)
        self.send_header("Allow", "GET, HEAD, POST, DELETE")
        self.end_headers()


class ReusableTCPServer(socketserver.ThreadingTCPServer):
    # On Windows, SO_REUSEADDR can allow multiple processes to bind the same
    # local port. enCounter must have one exclusive owner of port 5500.
    allow_reuse_address = os.name != "nt"
    daemon_threads = True

    def server_bind(self):
        if os.name == "nt" and hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(
                socket.SOL_SOCKET,
                socket.SO_EXCLUSIVEADDRUSE,
                1,
            )
        super().server_bind()


def open_browser():
    if not browser_launch_enabled():
        return
    time.sleep(0.4)
    try:
        webbrowser.open(APP_URL)
    except Exception as exc:
        console_print(f"Could not open the default browser automatically: {exc}")


if __name__ == "__main__":
    console_print("\n==========================================")
    console_print(f"        {APP_NAME} {APP_VERSION} ({APP_STAGE})")
    console_print("==========================================")
    console_print(f"Local app: {APP_URL}")
    console_print("Data stays on this computer.")
    console_print("External backups: data\\backups\\")
    console_print("Close the packaged process when you are finished.\n")

    # A second portable launch should focus/reopen the current app instead of
    # showing a port-collision error. Unknown services on the port are never
    # trusted or terminated.
    if current_server_is_compatible():
        console_print(f"enCounter is already running on port {PORT}; opening the app.")
        open_browser()
        raise SystemExit(0)

    try:
        ensure_runtime_layout()
    except OSError as exc:
        message = (
            f"enCounter cannot write to its portable folder: {ROOT}\n\n"
            f"{exc}\n\n"
            "Extract enCounter to a writable folder in your user profile (for example, "
            "Documents or Downloads) and run it from there. Do not run the portable "
            "build directly from an archive or a read-only/system folder."
        )
        show_startup_error(message)
        raise SystemExit(1)

    try:
        # Bind the server before opening the browser. If the port is unavailable,
        # the user gets a clear error instead of being sent to the wrong service.
        with ReusableTCPServer(("127.0.0.1", PORT), EnCounterHandler) as server:
            threading.Thread(target=open_browser, daemon=True).start()
            server.serve_forever()
    except OSError as exc:
        message = (
            f"Could not start enCounter on port {PORT}: {exc}\n\n"
            "Another enCounter, Python server, Live Server, or other program is already "
            "using this port. Close the older process and start enCounter again.\n\n"
            "The expected Compendium proxy version is "
            f"{COMPENDIUM_PROXY_VERSION}."
        )
        show_startup_error(message)
        raise SystemExit(1)
