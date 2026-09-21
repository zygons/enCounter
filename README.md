# enCounter

**enCounter** is a free, open-source, local-first TTRPG encounter, initiative, scene-presentation, timer, and soundscape manager with separate DM and Player Displays, reusable player/NPC/enemy/creature libraries, Saved Encounters, local media assets, and backup/export features.

**Current release:** `0.2.0-alpha.1`  
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

- Separate **DM Console** and **Player Display**
- One-button Player Display control:
  - **Start Player Display**
  - **Hide Player Display**
  - **Show Player Display**
- Player Display presentation modes:
  - **STAND BY**
  - **Scene**
  - **Combat**
- Private DM editing while the Player Display shows **STAND BY**
- Initiative and turn management with synchronized DM and Player Display tracking
- **DM Initiative Auto-Follow**
  - follows the active combatant as turns advance
  - clearly highlights who is currently acting
  - automatically brings the current combatant into view
  - does not interrupt unrelated HP, status, resource, or combatant edits
- **Player Display initiative auto-centering**
  - automatically centers the active visible combatant
  - keeps the current turn visible during larger encounters
- Automatic round advancement
- Delay, Ready, Trigger / Resume, and Set Turn controls
- HP, status, condition, and combatant controls
- Hidden enemies with **Hide from Players / Reveal to Players**
- Reusable Player, NPC, Enemy, and Creature Library
- Saved Encounter Library with:
  - Save
  - Save As
  - Load
  - Duplicate
  - Delete
  - working-copy loading for game-session changes
- Encounter phases for:
  - Prepared
  - Scene / Roleplay
  - Combat
  - Complete
- Separate **Scene Image** and **Combat Background** per encounter
- Scene / roleplay Player Display mode with full-screen encounter artwork
- Visual countdown timers for Scene and Combat
- Timer controls for Start, Pause, Resume, Reset, Stop, and time adjustments
- Visual timer skins including:
  - Fantasy Hourglass
  - Candle
  - Sci-Fi Pixel Depletion
- Optional Player Display numeric countdown
- Encounter Soundscapes with:
  - scene music
  - layered scene ambience
  - combat music
  - combat ambience
  - master volume
  - fade transitions
  - automatic Scene-to-Combat switching
  - optional return to Scene audio after combat
- Prepared one-shot audio cues
- Live Prepared Cue buttons directly on the Encounter screen
- Local audio import support for MP3, OGG, WAV, and FLAC
- Portrait and encounter-background support
- Generic TTRPG, SWSE, D&D 5E, and Custom system profiles
- Local autosave and recovery snapshots
- Backup, export, and import tools
- Windows and Linux portable builds
- Runs locally without requiring a cloud account

## What's new in 0.2.0-alpha.1

Version `0.2.0-alpha.1` is a major Alpha feature milestone focused on encounter presentation and live game management.

Highlights include:

- Visual Scene and Combat timers
- Fantasy Hourglass, Candle, and Sci-Fi Pixel timer presentations
- Encounter-bound Soundscapes
- Scene and Combat music and ambience
- Prepared one-shot audio cues
- Live cue buttons on the Encounter screen
- Saved Encounter audio and presentation configuration
- Stand By, Scene, and Combat Player Display modes
- Separate Scene and Combat artwork
- Player Display initiative auto-centering
- DM initiative Auto-Follow and current-turn tracking

## Screenshots

### DM Console

The DM Console manages Saved Encounters, initiative, combatants, timers, scene/combat presentation, Soundscapes, and Prepared Cues.

![enCounter DM Console](docs/images/enCounter_Library.png)
![enCounter DM Console](docs/images/enCounter_Library2.png)
![enCounter DM Console](docs/images/enCounter_Game.png)
![enCounter DM Console](docs/images/enCounter_Settings.png)

### Player Display — Scene

Scene mode displays encounter artwork and optional visual timers without revealing initiative or combat information.

![enCounter Player Display](docs/images/enCounter_Awaiting.png)
![enCounter Player Display](docs/images/enCounter-Game2.png)

### Player Display — Stand By

![enCounter Player Display Stand By](docs/images/enCounter-Standby.png)

### Encounter Soundscape live cues

Soundscapes are stored as part of Saved Encounters. Loading a Saved Encounter restores its Scene music, Scene ambience, Combat music, Combat ambience, transition settings, and Prepared Cue assignments.

Configured one-shot cues appear as live buttons on the Encounter screen and can be triggered during either Scene or Combat play.

Audio playback itself does not automatically begin when an encounter is loaded. The DM remains in control of when Scene or Combat audio starts.

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
5. Click **Start Player Display** to open the player-facing display on a second monitor or TV.
6. Use **Hide Player Display** when you need to make private encounter or initiative changes.
7. Click **Show Player Display** when you are ready for players to see the updated encounter.
8. When finished, use **Exit enCounter** in the DM Console so the local background server closes cleanly.

Python is **not** required on the target computer when using the packaged Windows build.

The Alpha Windows executable is currently unsigned. Windows SmartScreen may therefore show an “unknown publisher” or reputation warning. Download builds only from the official project release and verify the published SHA-256 checksum when practical.

### Linux portable

1. Download the Linux `tar.gz` from the matching GitHub Release.
2. Extract it to a normal writable user folder.
3. Run `./enCounter` from the extracted folder, or double-click it if your desktop environment permits executable files.
4. enCounter opens in your default browser.
5. Click **Start Player Display** to open the player-facing display.
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

PyInstaller builds are platform-specific. Build the Windows package on Windows and the Linux package on Linux. The build scripts intentionally exclude previous backups, imports, exports, campaign images, and browser library data.

### Optional GitHub Actions builds

The repository also includes `.github/workflows/build-portable.yml`. After the repository is uploaded to GitHub, you can run **Actions → Build portable packages → Run workflow** to let GitHub build both Windows and Linux packages on the appropriate operating systems. The workflow also runs automatically when a version tag beginning with `v` is pushed.

## DM and Player Display workflow

Use **one DM Console tab/window at a time** for an encounter.

The Player Display should normally be opened from the DM Console using the same browser profile.

The Player Display button changes automatically depending on its current state:

| Button                   | Meaning                                                      |
| ------------------------ | ------------------------------------------------------------ |
| **Start Player Display** | Opens the Player Display                                     |
| **Hide Player Display**  | Replaces encounter information with a STAND BY screen        |
| **Show Player Display**  | Restores the Player Display using the latest encounter state |

Player Display content is also controlled by the current encounter phase:

| Encounter state | Player Display                                                         |
| --------------- | ---------------------------------------------------------------------- |
| **Stand By**    | Privacy screen; encounter information is hidden                        |
| **Scene**       | Scene artwork and optional timers without initiative                   |
| **Combat**      | Combat artwork, initiative order, current turn, and combat information |

### Making private DM changes

When **Hide Player Display** is selected, the player-facing screen displays a **STAND BY** screen.

The DM Console remains fully functional. The DM can privately:

- change initiative values
- add or remove combatants
- advance or correct turns
- use Set Turn or Trigger / Resume
- adjust initiative order
- change HP or status information
- add reinforcements
- hide or reveal enemies
- make other encounter adjustments

The Player Display continues receiving the latest encounter information internally but does not display those changes while hidden.

When the DM selects **Show Player Display**, the current encounter state is displayed immediately.

If the Player Display window is closed, the DM control returns to **Start Player Display**.

### Hidden combatants

When a combatant is marked **Hide from Players**, it remains fully visible in the DM Console but is completely omitted from the Player Display, including the initiative track and current/next-turn names.

Use **Reveal to Players** to return that combatant to the Player Display at its normal initiative position.

### Initiative tracking

The DM Console and Player Display use the same active-turn state so both screens remain synchronized as initiative advances.

On the **Player Display**, the current visible combatant is highlighted and automatically centered in the initiative track.

On the **DM Console**, the current combatant is highlighted and the initiative list automatically follows that combatant when:

- Combat starts
- **Next Turn** is selected
- **Previous Turn** is selected
- **Set Turn** is used
- A delayed or readied combatant resumes and takes the current turn

DM Auto-Follow occurs only when the active turn changes.

Editing HP, applying damage or healing, changing a status or condition, adjusting resources, hiding or revealing combatants, or making other non-turn changes does not force the DM screen back to the current combatant.

### Display synchronization

The Player Display includes a **DM Sync** connection indicator.

DM Console and Player Display windows must currently use the same browser profile. A different browser, different browser profile, or private/incognito session will not share the local synchronization channel.

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
