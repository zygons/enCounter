# enCounter

enCounter is a local-first TTRPG encounter and initiative manager with separate DM and Player Displays, reusable player/NPC/enemy/creature libraries, encounter controls, asset support, and local backup/export features.

**Current release:** `0.1.0-alpha.1`  
**Status:** Alpha / pre-release  
**License:** MIT

## Alpha notice

This is pre-release software. Features, storage structures, and behavior may change before version 1.0. Export important Library and encounter data before testing a new Alpha build.

## AI assistance disclosure

enCounter has been developed with assistance from generative AI tools for coding, debugging, documentation, project organization, testing suggestions, and release preparation. AI-assisted material is reviewed and maintained by the project maintainer before release.

The current application does **not** include generative-AI functionality and does not intentionally send encounter, Library, or campaign data to an AI service.

See [`AI_ASSISTANCE.md`](AI_ASSISTANCE.md) for the full disclosure.

## Download / run

### Windows portable

1. Download the Windows portable ZIP from the matching GitHub Release.
2. Extract the complete folder.
3. Extract it to a normal writable folder such as Documents or Desktop (not a protected system folder such as `Program Files`).
4. Double-click `enCounter.exe`.
5. enCounter opens in your default browser.
6. Use **Player Display** for a second monitor or TV.
7. When finished, use **Exit enCounter** in the DM Console so the local background server closes cleanly.

Python is **not** required on the target computer when using the packaged Windows build.

The Alpha Windows executable is currently unsigned. Windows SmartScreen may therefore show an “unknown publisher” or reputation warning. Download builds only from the official project release and verify the published SHA-256 checksum when practical.

### Linux portable

1. Download the Linux `tar.gz` from the matching GitHub Release.
2. Extract the complete folder.
3. Extract it to a normal writable user folder.
4. Run `./enCounter` from the extracted folder, or double-click it if your desktop environment permits executable files.
5. enCounter opens in your default browser.
6. When finished, use **Exit enCounter** in the DM Console so the local background server closes cleanly.

Python is **not** required on the target computer when using the packaged Linux build.

If Linux reports that the file is not executable, run:

```bash
chmod +x enCounter
./enCounter
```

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

PyInstaller builds are platform-specific. Build the Windows package on Windows and the Linux package on Linux. The build scripts intentionally exclude previous backups, imports, exports, campaign images, and browser Library data.

### Optional GitHub Actions builds

The repository also includes `.github/workflows/build-portable.yml`. After the repository is uploaded to GitHub, you can run **Actions → Build portable packages → Run workflow** to let GitHub build both Windows and Linux packages on the appropriate operating systems. The workflow also runs automatically when a version tag beginning with `v` is pushed.

## Intended display workflow

Use **one DM Console tab/window at a time** for an encounter. Open the Player Display from that DM Console and keep both windows in the same browser profile. The Player Display now shows a **DM Sync** connection indicator; a different browser, browser profile, or private/incognito session will not share the local synchronization channel.

Opening multiple DM Console windows against the same browser database is not supported in the current Alpha and can result in last-write-wins overwrites.

When a combatant is marked **Hide from Players**, it remains fully visible in the DM Console but is completely omitted from the Player Display, including the initiative track and current/next-turn names. Use **Reveal to Players** to insert it back into the Player Display at its normal initiative position.

## Automated core tests

The repository includes dependency-free Node tests for normalization, initiative sorting, asset sanitization, and turn-transition behavior. Node.js is only needed to run these development tests; packaged enCounter users do not need Node.js.

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

See [`PRIVACY.md`](PRIVACY.md).

## Repository contents

The GitHub repository contains source code and build files. Compiled Windows and Linux packages belong in **GitHub Releases**, not in the source tree. Generated `build/`, `dist/`, and `release/` folders are ignored by Git.

## License

enCounter is released under the **MIT License**. See [`LICENSE`](LICENSE).

The MIT License permits use, modification, redistribution, sublicensing, and commercial use, provided the required copyright and license notice is retained. enCounter is provided without warranty as described in the license.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Third-party names and materials

Names of third-party games, systems, products, companies, and trademarks remain the property of their respective owners. References are for identification or compatibility and do not imply endorsement, sponsorship, or affiliation.

See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
