# enCounter

**enCounter** is a free, open-source, local-first TTRPG encounter, initiative, scene-presentation, timer, and soundscape manager with separate DM and Player Displays, a reusable Character Library, Encounter Templates, Saved Encounter States, local media assets, and backup/export features.

**Current release:** `0.3.0-alpha.1`
**Status:** Alpha / pre-release  
**License:** MIT  
**Platforms:** Windows and Linux

## Get enCounter

- **Download:** See the latest GitHub Release
- **Documentation:** See the enCounter User Guide in the `docs/` folder
- **Report a bug:** Open a GitHub Issue
- **Request a feature:** Open a GitHub Issue
- **Questions / setup help:** Use GitHub Discussions

> **Alpha software:** enCounter is currently under active development. Back up important Library and encounter data before upgrading between Alpha versions.

## Features

- Separate **Run** and **Prepare** workspaces for live play and pre-game setup
- Separate **DM Console** and **Player Display**
- Player Display controls for:
  - **Open Display**
  - **Show Scene**
  - **Show Combat**
  - **Send to Standby**
- Private DM editing while the Player Display remains on the **STAND BY** privacy screen
- Initiative and turn management with synchronized DM and Player Display tracking
- **Active Turn** panel with HP Quick Actions, Conditions, Recovery, Exhaustion, visibility, Defeated, and Return to Combat controls
- **DM Initiative Auto-Follow** and Player Display initiative auto-centering
- Automatic round advancement plus Delay, Ready, Trigger / Resume, and Set Turn controls
- Structured D&D 5E Conditions with multi-condition support and separate Exhaustion tracking
- D&D 5E Player recovery states (**Downed / Stable / Dead**) with integrated Death Saves
- Hidden combatants with **Hide from Players / Reveal to Players**
- Reusable Character Library for Players, NPCs, Enemies, and Creatures
- D&D 5E SRD **Compendium** search with Add to Encounter and Save/Refresh Library workflows
- **Reusable Encounter Templates** for repeatable prepared encounters
- **Saved Encounter States** for resuming live-session progress
- **Quick Encounter** for immediate session-only play
- Separate Scene and Combat backgrounds and presentation controls
- Visual countdown timers for Scene and Combat, including prepared Timer configuration
- Encounter Soundscapes with Scene/Combat music, layered ambience, master volume, fade transitions, and automatic Scene-to-Combat switching
- Up to three prepared one-shot **Sound Cues** available from the live Run workspace
- Local audio import support for MP3, OGG, WAV, and FLAC
- Portrait, token/icon, and encounter-background asset support
- Generic TTRPG, SWSE, D&D 5E, and Custom system profiles
- Local autosave, restart recovery, and recovery snapshots
- Backup, export, import, and persistent-browser-storage tools
- Hardened localhost-only launcher and audited Windows/Linux portable builds
- Runs locally without requiring a cloud account

## What's new in 0.3.0-alpha.1

Version `0.3.0-alpha.1` is the first Alpha 3 release and focuses on a clearer Run/Prepare workflow, D&D 5E recovery, SRD Compendium integration, encounter preparation, and portable-release hardening.

Highlights include:

- New **Run / Prepare** DM workspace
- **Quick Encounter** and unified Add Combatant workflow
- D&D 5E SRD **Compendium** search with Add to Encounter / Save to Library
- Reusable Encounter Templates separated from Saved Encounter States
- Reworked **Active Turn** Quick Actions
- D&D 5E Downed / Stable / Dead recovery with Death Saves
- Simplified combatant rows with secondary actions in a `...` menu
- Improved responsive layout, themes, and 200% zoom behavior
- Hardened localhost launcher and browser security headers
- Audited Windows/Linux portable build pipeline with pinned dependencies and native smoke tests

For the full change list, see `docs/RELEASE_NOTES_0.3.0-alpha.1.md`.

## What's new in 0.2.0-alpha.2

Version `0.2.0-alpha.2` is an Alpha 2 maintenance release focused on encounter-state reliability and D&D 5E combat tracking.

Highlights include:

- Structured D&D 5E conditions with multiple simultaneous conditions
- D&D 5E Exhaustion tracking and Player Display badges
- Saved Encounter Timer configuration that reloads in a fresh Ready state
- Correct transient-condition reset behavior for Saved Encounters and presets
- Improved Soundscape playback failure reporting
- Release/build consistency fixes and additional regression tests

## What's new in 0.2.0-alpha.1

Version `0.2.0-alpha.1` is a major Alpha feature milestone focused on encounter presentation and live game management.

Highlights include:

- Visual Scene and Combat timers
- Fantasy Hourglass, Candle, and Sci-Fi Pixel timer presentations
- Encounter-bound Soundscapes
- Scene and Combat music and ambience
- Prepared one-shot Sound Cues
- Live cue buttons on the Encounter screen
- Saved Encounter audio and presentation configuration
- Stand By, Scene, and Combat Player Display modes
- Separate Scene and Combat artwork
- Player Display initiative auto-centering
- DM initiative Auto-Follow and current-turn tracking

## Screenshots

Current Alpha 3 screenshots and complete workflows are included in the **enCounter User Guide** under `docs/enCounter User Guide.pdf`.

The `docs/images/` folder may also contain screenshots retained from earlier Alpha documentation and should not be treated as the authoritative Alpha 3 interface reference.

## Alpha notice

This is pre-release software. Features, storage structures, and behavior may change before version 1.0.

Use **Export Everything** before upgrading between Alpha builds when the stored Library or encounter data is important.

## AI assistance disclosure

enCounter has been developed with assistance from generative AI tools for coding, debugging, documentation, project organization, testing suggestions, and release preparation. AI-assisted material is reviewed and maintained by the project maintainer before release.

The current application does **not** include generative-AI functionality and does not intentionally send encounter, library, or campaign data to an AI service.

See [`AI_ASSISTANCE.md`](AI_ASSISTANCE.md) for the full disclosure.

## Download / run

### Windows portable

1. Download the Windows portable ZIP from the matching GitHub Release.
2. Extract the complete ZIP to a normal writable folder such as Documents or Desktop. Do not run enCounter directly from inside the ZIP or from a protected system folder such as `Program Files`.
3. Double-click `enCounter.exe`.
4. enCounter opens in your default browser.
5. Use **Open Display** to open the player-facing window on a second monitor or TV.
6. Use **Show Scene** or **Show Combat** for the appropriate presentation, and **Send to Standby** when you need to make private changes.
7. When finished, use **Exit enCounter** in the DM Console so the local background server closes cleanly.

Python is **not** required on the target computer when using the packaged Windows build.

The Alpha Windows executable is currently unsigned. Windows SmartScreen may therefore show an “unknown publisher” or reputation warning. Download builds only from the official project release and verify the published SHA-256 checksum when practical.

### Linux portable

1. Download the Linux `tar.gz` from the matching GitHub Release.
2. Extract it to a normal writable user folder.
3. Run `./enCounter` from the extracted folder, or double-click it if your desktop environment permits executable files.
4. enCounter opens in your default browser.
5. Use **Open Display** to open the player-facing window.
6. Use **Show Scene**, **Show Combat**, and **Send to Standby** as needed.
7. When finished, use **Exit enCounter** in the DM Console so the local background server closes cleanly.

Python is **not** required on the target computer when using the packaged Linux build.

The official Linux portable package is built on **Ubuntu 22.04 x86_64** to provide a stable, conservative glibc baseline. It is intended for current mainstream x86_64 Linux distributions with the same or a newer compatible glibc. Very old distributions may require building enCounter locally on that distribution or on an equivalently old compatible build system.

If Linux reports that the file is not executable, run:

```bash
chmod +x enCounter
./enCounter
```

## Browser compatibility

enCounter is a local browser application served by its bundled localhost server. For the best Alpha experience, use a current desktop release of **Google Chrome, Microsoft Edge, or Mozilla Firefox**. Keep the DM Console and Player Display in the **same browser profile** so IndexedDB and the local synchronization channel are shared.

Private/incognito windows use separate or temporary browser storage in many browsers. Do not rely on a private/incognito session for persistent Library, encounter, or settings data. Browser storage can also be cleared by browser privacy controls, so use enCounter's export/backup features for data that matters.

## Development and builds

Build-time requirements:

- Python 3
- PyInstaller (see `requirements-build.txt`)

Windows development start:

```text
Start enCounter.bat
```

Linux development start:

```bash
./Start\ enCounter.sh
```

Build a clean Windows portable release on Windows:

```text
Build enCounter Windows.bat
```

Build a clean Linux portable release on Linux (the archive name records the machine architecture):

```bash
./Build\ enCounter\ Linux.sh
```

PyInstaller builds are platform-specific. Build the Windows package on Windows and the Linux package on Linux. The official CI Linux build uses Ubuntu 22.04 x86_64 because PyInstaller Linux executables inherit the build system's glibc compatibility baseline.

The build scripts intentionally exclude previous backups, imports, exports, caches, campaign images, and user-supplied media from portable releases. **Do not publish a ZIP of your working repository folder as a release package.** A development folder can contain ignored local backups, compendium cache files, and custom assets that are not meant for distribution. Use the provided build scripts (or the GitHub Actions workflow); each portable release is checked by `programs/release_audit.py` before it is archived.

### Optional GitHub Actions builds

The repository also includes `.github/workflows/build-portable.yml`. After the repository is uploaded to GitHub, you can run **Actions → Build portable packages → Run workflow** to let GitHub build both Windows and Linux packages on the appropriate operating systems. The workflow also runs automatically when a version tag beginning with `v` is pushed.

## DM and Player Display workflow

Use **one DM Console tab/window at a time** for an encounter. Open the Player Display from the DM Console using the same browser profile.

The Alpha 3 Run workspace provides separate **Display Controls**:

| Control | Meaning |
| --- | --- |
| **Open Display** | Opens or focuses the Player Display window |
| **Show Scene** | Shows the configured Scene presentation without initiative |
| **Show Combat** | Shows the Combat presentation and initiative |
| **Send to Standby** | Shows the STAND BY privacy screen while the DM continues working |

### Making private DM changes

Use **Send to Standby** whenever encounter information should be hidden from players. The DM Console remains fully functional, and the Player Display continues receiving synchronized state without revealing it until **Show Scene** or **Show Combat** is selected.

While players are on Standby, the DM can privately change initiative, add/remove combatants, advance or correct turns, edit HP/Conditions/Recovery, add reinforcements, or hide/reveal enemies.

### Hidden combatants

When a combatant is marked **Hide from Players**, it remains visible in the DM Console but is omitted from the Player Display, including initiative and current/next-turn presentation. Use **Reveal to Players** to restore it.

### Initiative tracking

The DM Console and Player Display use the same active-turn state. The Player Display automatically centers the current visible combatant, while DM Auto-Follow brings the active combatant into view when the turn actually changes. Ordinary HP, status, resource, visibility, and note edits do not force the DM screen away from the combatant being edited.

### Display synchronization

The Player Display includes a **DM Sync** connection indicator. DM Console and Player Display windows must use the same browser profile. A different browser, different browser profile, or private/incognito session does not share the same local synchronization/storage context.

Opening multiple DM Console windows against the same browser database is not supported in the current Alpha and may result in last-write-wins overwrites.

## Automated core tests

The repository includes dependency-free Node tests for normalization, initiative sorting, asset sanitization, Player Display visibility, and turn-transition behavior. Node.js is only needed to run these development tests; packaged enCounter users do not need Node.js.

Run them from the repository root with:

```bash
node --test tests/*.test.js
```

## Data and privacy

- Browser application data is stored locally in IndexedDB using `enCounterAlphaDB`.
- Optional disk backups are stored under `data/backups/`.
- Exports/imports and user-supplied assets remain local unless the user moves or shares them.
- The current Alpha binds its local web server to `127.0.0.1` and does not intentionally send encounter or Library data to an enCounter-operated cloud service.
- The local server exposes only the application files, public notices, and supported asset files needed by enCounter; runtime `data/` files and source/build files are not served through the browser.
- Imported audio files remain local under the enCounter `assets/sounds/` folders.
- Soundscape configuration stores references to those local audio assets; audio files are not embedded directly into JSON encounter backups or exports.

See [`PRIVACY.md`](PRIVACY.md).

## Repository contents

The GitHub repository contains source code and build files. Compiled Windows and Linux packages belong in **GitHub Releases**, not in the source tree. Generated `build/`, `dist/`, and `release/` folders are ignored by Git.

## License

enCounter is released under the **MIT License**. See [`LICENSE`](LICENSE).

The MIT License permits use, modification, redistribution, sublicensing, and commercial use, provided the required copyright and license notice is retained. enCounter is provided without warranty as described in the license.

Copyright © 2026 **Zygons**.

## Bugs, feature requests, and support

enCounter is currently in Alpha and user feedback is welcome.

### Report a bug

Use **GitHub Issues → Bug Report** for reproducible problems with enCounter.

Please include, when possible:

- enCounter version
- operating system
- browser
- steps to reproduce the problem
- what you expected to happen
- what actually happened
- screenshots or error messages

### Request a feature

Use **GitHub Issues → Feature Request** for proposed improvements or new functionality.

### Questions and setup help

Use **GitHub Discussions** for:

- installation questions
- setup help
- usage questions
- general ideas
- workflows you want to discuss before requesting a feature

Please do not publish suspected security vulnerabilities as normal public Issues. See [`SECURITY.md`](SECURITY.md) for security reporting guidance.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Third-party names and materials

Names of third-party games, systems, products, companies, and trademarks remain the property of their respective owners. References are for identification or compatibility and do not imply endorsement, sponsorship, or affiliation.

See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
