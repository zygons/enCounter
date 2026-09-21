# Changelog

All notable changes to enCounter will be documented here.

## Unreleased

No changes recorded yet.

## 0.2.0-alpha.1 - 2026-09-13

### Added

- Saved Encounter Library workflow with **Save**, **Save As**, **Load**, **Duplicate**, and **Delete** while keeping the loaded encounter as a working copy so game-session changes do not automatically overwrite the reusable Saved Encounter.

- Encounter phases for **Prepared**, **Scene / Roleplay**, **Combat**, and **Complete** states.

- Player Display **Scene mode** that shows encounter artwork without initiative or combat information while still allowing visual timers.

- Separate **Scene Image** and **Combat Background** selections for prepared encounters.

- Visual Timer system for Scene and Combat encounters.

- Visual Timer controls for:
  - Start
  - Pause
  - Resume
  - Reset
  - Stop
  - Add 10 seconds
  - Subtract 10 seconds
  - Add 1 minute
  - Subtract 1 minute

- Three visual timer skins:
  - Fantasy Hourglass
  - Candle
  - Sci-Fi Pixel Depletion

- Timer display modes for different presentation needs, including overlay, featured, and focus-style presentation.

- Independent options for showing the timer and numeric countdown on the DM Console and Player Display.

- Synchronized Player Display timer state so the DM and player-facing displays remain aligned during a running countdown.

- Encounter Soundscape system with:
  - Scene music
  - Layered scene ambience
  - Combat music
  - Combat ambience
  - Master volume
  - Fade transitions
  - Scene-to-combat audio switching
  - Optional return to scene audio after combat

- Per-ambience combat transition behavior, allowing scene ambience to continue, lower in volume, or stop when combat begins.

- Audio asset folders and import support for:
  - MP3
  - OGG
  - WAV
  - FLAC

- Prepared one-shot audio cues that can be configured as part of an encounter.

- Live **Prepared Cue** buttons on the Encounter tab, populated automatically from the loaded encounter's Soundscape and usable during both Scene and Combat phases.

- Player Display initiative auto-centering. The active visible combatant is automatically brought into view and centered as initiative advances.

- DM initiative tracking and Auto-Follow.

- The DM Console now follows the current initiative order and clearly identifies the combatant whose turn is currently active.

- The DM Console automatically brings the active combatant into view when:
  - Combat starts.
  - **Next Turn** is selected.
  - **Previous Turn** is selected.
  - **Set Turn** is used.
  - A delayed or readied combatant resumes and takes the current turn.

- Current-turn highlighting on the DM Console remains synchronized with the Player Display so both screens reflect the same active combatant.

### Changed

- Player Display presentation is now modeled as **Stand By**, **Scene**, or **Combat** instead of only visible or hidden.

- **Start Combat** can automatically transition scene audio to combat audio when configured.

- **End Combat** can automatically restore the previous scene Soundscape when configured.

- Encounter data normalization now preserves Soundscape, display, phase, scene/combat image, and Saved Encounter metadata.

- Soundscape configuration is now encounter-bound rather than maintained as a separate Soundscape Library.

- Loading a Saved Encounter restores its Soundscape configuration and Prepared Cue assignments.

- Loading a Saved Encounter does **not** automatically begin audio playback. Scene or Combat audio remains under DM control.

- Soundscape editor wording now makes clear that Soundscapes are stored with and loaded automatically from Saved Encounters.

- Encounter remains the primary live game-control screen and now includes Saved Encounter controls, Scene/Combat phase controls, scene/combat images, audio controls, and Prepared Cue buttons.

- Timer and Soundscape configuration are available as dedicated DM Console navigation sections.

- Improved synchronization between Scene, Combat, timer, Soundscape, initiative, and Player Display state.

- Initiative order on both the DM Console and Player Display now tracks the same current combatant as turns advance.

- Player Display initiative cards automatically reposition so the current combatant remains visible and centered rather than moving off-screen during longer initiative orders.

- DM initiative tracking now moves through the encounter order alongside the Player Display, making it easier for the DM to see:
  - Who is currently acting.
  - Where the current combatant is within the initiative order.
  - Which combatant will act as initiative continues.

- DM Auto-Follow occurs only when the active turn changes. Ordinary combatant edits do not force the DM screen back to the active combatant.

- HP changes, damage/healing, status edits, Condition Track changes, resource changes, Hide/Reveal actions, and other non-turn edits leave the DM's current scroll position unchanged.

- Improved initiative usability for larger encounters where the full combatant list cannot fit on the screen at once.

### Notes

- This is an **Alpha / pre-release** version of enCounter.

- The Timer, Soundscape, Saved Encounter, Scene/Combat presentation, and initiative-follow systems remain Alpha features and may continue to evolve.

- Player Display initiative centering and DM Auto-Follow use the same active encounter turn state, keeping DM and player-facing initiative presentation aligned.

- DM Auto-Follow is intentionally triggered by turn changes rather than every encounter render so the DM can edit another combatant without the screen unexpectedly jumping away.

- Audio configuration and media references are saved with Saved Encounters, but active playback state is not treated as permanent encounter state.

- Imported audio files remain local assets and are not embedded directly into JSON backup/export files.

- Export important Library and encounter data before upgrading between Alpha versions.

## 0.1.0-alpha.2 - 2026-09-05

### Maintenance

- Published the second enCounter Alpha release and updated release-facing documentation for `0.1.0-alpha.2`.

- Standardized documentation for the single-button Player Display workflow:
  - **Start Player Display**
  - **Hide Player Display**
  - **Show Player Display**

- Clarified the **STAND BY** privacy-screen workflow for making private DM changes without exposing them to players.

- Clarified that the Player Display and DM Console must use the same browser profile for local synchronization.

- Expanded Player Display synchronization and troubleshooting documentation, including DM Sync connected/disconnected behavior.

- Updated Alpha documentation while retaining the existing initiative, hidden-combatant, backup, Library, and portable-build functionality established during the initial Alpha hardening cycle.

### Notes

- This release remained part of the original `0.1.0` Alpha development line.

- The subsequent Saved Encounter, Scene/Combat presentation, Timer, Soundscape, and enhanced initiative-follow work was developed after this Alpha milestone and is included in `0.2.0-alpha.1`.

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
