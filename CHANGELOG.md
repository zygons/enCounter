# Changelog

All notable changes to enCounter will be documented here.

## 0.1.0-alpha.1 - 2026-08-20

### Added
- Initial enCounter Alpha release baseline.
- DM encounter console and separate Player Display.
- Reusable Library for players, NPCs, enemies, and creatures.
- Generic, SWSE, 5E, and custom system profiles.
- Local asset handling, backup/export/import, and recovery features.
- Clean Windows portable build workflow using PyInstaller.
- Clean Linux x86_64 portable build workflow using PyInstaller.
- AI Assistance Disclosure for development transparency.

### Distribution
- Standardized Alpha version identifiers.
- Isolated Alpha IndexedDB name (`enCounterAlphaDB`).
- Build scripts exclude prior user data and personal campaign assets.
- Licensed the project under the MIT License.
- Added Windows/Linux release SHA-256 checksum generation.
- Hardened GitHub Actions permissions and cross-platform Python invocation.

### Pre-publication hardening
- Restricted the local HTTP server to required public application resources instead of serving the entire project root.
- Added local Host/Origin checks, response security headers, and image signature validation for uploads.
- Added graceful application shutdown from the DM Console.
- Added BroadcastChannel fallback synchronization for browsers where BroadcastChannel is unavailable.
- Added stricter backup/import validation and atomic full-database imports.
- Fixed single Library-entry imports and made **Export Everything** include recovery snapshots.
- Fixed Settings module changes so the encounter UI rerenders immediately.
- Normalized imported settings, encounters, combatants, and local asset references before use.
- Removed duplicate encounter broadcasts from UI-only renders; encounter changes now broadcast from save operations.
- Added Player Display DM Sync connected/disconnected status and DM-presence heartbeats.
- Added a documented single-DM-window workflow warning for the current Alpha.
- Applied the same local Origin policy to GET/HEAD requests as POST requests when an Origin header is present.
- Added dependency-free Node unit tests for normalization, initiative sorting, asset sanitization, and turn-transition behavior.
- Changed hidden combatants so they remain fully visible to the DM but are completely omitted from the Player Display until **Reveal to Players** is clicked.
- Added Player Display visibility tests for hidden combatants and next-turn selection.
