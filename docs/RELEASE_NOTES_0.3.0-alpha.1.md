# enCounter 0.3.0-alpha.1 — Alpha 3 Release Notes

**Release stage:** Alpha / pre-release  
**Release date:** TBD  
**Prepared:** 8 November 2026  
**License:** MIT  
**Platforms:** Windows portable and Linux portable (architecture-specific)  
**Scope:** Changes since `0.2.0-alpha.2`

## Overview

`0.3.0-alpha.1` is the first Alpha 3 release of enCounter. Alpha 3 reorganizes the application around a clearer **Run / Prepare** workflow, substantially expands the D&D 5E live-combat experience, adds a working SRD creature Compendium, improves encounter preparation and persistence, and hardens the local launcher and portable-release process.

The release keeps enCounter local-first: the DM Console and Player Display are served from `127.0.0.1`, working data remains in browser IndexedDB, media assets remain local files, and portable releases are audited to prevent development data, caches, backups, and personal campaign assets from being accidentally distributed.

## Major highlights

- New **Run / Prepare** DM workspace designed around the difference between live game operation and pre-game management.
- New **Quick Encounter** workflow for fast, session-only encounters.
- Reworked **Active Turn** panel with fast HP, Conditions, Recovery, Exhaustion, visibility, Defeated, and Return to Combat controls.
- D&D 5E **Downed / Stable / Dead** recovery states with integrated death saves for player characters.
- Simplified combatant rows with infrequent actions moved to a `...` menu.
- Working **D&D 5E SRD Compendium** search with direct Add to Encounter and Save to Library workflows.
- Reusable **Encounter Templates** separated from **Saved Encounter States**.
- Direct pre-game encounter setup for scene/combat backgrounds, audio, Sound Cues, combatants, and timer configuration.
- Character Library source filtering for custom versus Compendium entries and safer Library/active-encounter synchronization.
- Major responsive-layout and theme consistency pass, including high-zoom browser fixes.
- Hardened Windows/Linux portable build pipeline with pinned PyInstaller versions, release-content audits, checksums, native smoke tests, duplicate-launch checks, and clean-shutdown checks.
- Expanded automated regression coverage. The current Windows development suite passes **145 / 145 tests**.

---

## 1. Alpha 3 DM workspace redesign

### Added: Run and Prepare workspaces

The DM Console now separates live operation from preparation:

- **RUN — Active Encounter** is the live game workspace.
- **PREPARE — Library & Setup** contains:
  - Characters
  - Compendium
  - Encounters
  - Assets
  - Data & Tools
- Audio, Timer, and Settings remain available as tools without replacing the Run/Prepare mental model.

This reduces the need to move between unrelated screens during active play and makes preparation tasks easier to locate.

### Terminology cleanup

Alpha 3 standardizes user-facing labels and removes older development terminology:

- **Quick Encounter** replaces older “Ad Hoc” wording.
- **Active Encounter** replaces redundant Run-screen headings.
- **Display Controls** replaces older Player Display control wording.
- **Send to Standby** replaces Hide/Standby wording.
- **Sound Cues** replaces Prepared Cues in the live workspace.
- **Live Effects** is used for live sound-effect control where applicable.
- **Timer** replaces “Prepared Timer” wording in the live workspace.
- **Active Turn** / Current Turn presentation is simplified so the combatant name is not redundantly repeated in multiple headings.

### Responsive workspace layout

- Replaced the narrow live-control side rail behavior with a more flexible horizontal/responsive control layout.
- Improved reduced-width behavior for Run controls.
- Removed sticky Current Turn overlap behavior that could cover combat content.
- Added a browser high-zoom header safeguard through the 1350px breakpoint.
- Fixed **Exit enCounter** placement at high zoom, including 200% browser zoom.
- Preserved existing element IDs/data bindings so UI cleanup did not break combat behavior.

---

## 2. Run — Active Encounter improvements

### Quick Encounter

- Added a prominent **+ Quick Encounter** action in Run.
- Quick Encounter creates a live encounter without first building a reusable template.
- Run also provides **Load / Resume** controls for:
  - Reusable Encounter Templates
  - Saved Encounter States
- Added direct access to the Encounter Library from the Run command strip.

### Unified Add Combatant workflow

The Run workspace now has one **+ Add Combatant** workflow with source tabs:

- **Library** — add a reusable saved combatant.
- **Compendium** — open D&D 5E SRD creature search.
- **Quick Create** — create a temporary encounter-only combatant.

The Library picker is organized by Players, NPCs, and Monsters & Enemies and respects the current game system.

### Combatant row simplification

Combatant rows were redesigned to be scan-first rather than action-heavy.

Changes include:

- Removed repeated `-10 / -1 / +1 / +10` buttons from every row.
- Removed the separate Exhaustion button from every D&D combatant row.
- Retained important in-row information such as initiative, HP, key defense/stat, current status, and current-turn indication.
- Retained direct exact HP editing.
- Kept **Set / Current Turn**, Conditions/Status, and Return to Combat where relevant.
- Moved less-frequent actions to an expanded `...` menu, including:
  - Damage / Heal
  - Delay
  - Ready
  - Recovery state actions
  - Hide / Reveal
  - Remove
- HP edits from the expanded row use the same recovery-aware HP logic as the Current Turn panel.

---

## 3. Active Turn / Current Turn control redesign

### New Quick Actions hierarchy

The Current Turn panel now emphasizes the active combatant's identity, portrait, HP, defense/stat, initiative, and active statuses before secondary controls.

A dedicated **Quick Actions** area provides:

- HP damage/healing buttons: `-10`, `-1`, `+1`, `+10`
- **Conditions**
- **Recovery**
- **Exhaustion** when relevant
- **Hide from Players / Reveal to Players** when relevant
- **Defeated**
- **Return to Combat** when applicable

Damage and healing actions are visually distinguished.

### Conditions and status

- D&D 5E supports multiple simultaneous structured conditions.
- Conditions remain editable from the active-combatant panel.
- D&D Exhaustion remains separate from normal conditions and supports levels 0 through 6.
- SWSE continues to surface its Condition Track behavior rather than using D&D condition semantics.
- The Conditions button no longer duplicates the number of active conditions in its label; current conditions remain visible in the status presentation.
- The Conditions editor closes automatically when the active turn changes.

---

## 4. Recovery, death saves, and return to combat

Alpha 3 separates **initiative participation state** from **recovery/life state**.

### Recovery states

New recovery states:

- Normal
- Downed
- Stable
- Dead

These are separate from encounter participation states such as active, delayed, ready, defeated, or inactive.

### D&D 5E player-character automation

For D&D 5E **Player** combatants:

- Dropping from above 0 HP to 0 HP automatically sets the character to **Downed**.
- **Unconscious** is added automatically when entering Downed.
- Death saves are tracked in the Active Turn Recovery panel.
- **Roll Death Save** performs a d20 roll.
- Rolls of 10–19 add one success.
- Rolls of 2–9 add one failure.
- A natural 1 adds two failures.
- A natural 20 restores 1 HP, clears the Downed state, resets death saves, and removes Unconscious.
- Three successes set the combatant to **Stable**.
- Three failures set the combatant to **Dead**.
- Manual `+ Success` and `+ Failure` controls are available when the DM needs to record an external/physical roll.
- Damage taken at 0 HP while Downed/Stable records one death-save failure. If the hit should cause an additional failure, such as a critical hit, the DM can add the extra failure manually.
- Healing a Downed or Stable combatant above 0 HP returns the combatant to Normal, clears death saves, and removes Unconscious.

### NPC and enemy control

D&D NPCs/enemies are **not** automatically forced into death-save bookkeeping at 0 HP. The DM can decide whether an NPC/enemy is Downed, Defeated, Dead, or returned to combat.

### Defeated remains non-lethal encounter removal

**Defeated** is deliberately separate from **Dead**:

- Defeated removes a combatant from normal initiative participation without asserting death.
- It can represent surrender, knockout, fleeing, incapacitation, encounter removal, or a creature the DM no longer needs in initiative.
- Return to Combat can restore defeated/inactive/recovery-state combatants when appropriate.

### SWSE recovery behavior

Alpha 3 provides manual recovery-state support for SWSE:

- Marking an SWSE combatant Downed sets the Condition Track to **Helpless**.
- Returning a Helpless combatant to combat moves the Condition Track to `-10` when applicable.
- Detailed automated SWSE unconscious/recovery-check rules remain deferred pending rulebook-specific implementation.

### Persistence

Recovery state and D&D death-save data are preserved through encounter normalization, saved-state storage, and Library/active-encounter synchronization where appropriate.

---

## 5. D&D 5E SRD Compendium

### New online SRD search

Alpha 3 adds a working D&D 5E creature Compendium under **Prepare → Compendium**.

Current provider:

- D&D System Reference Document 5.1
- D&D 5e SRD API / 5e-bits provider
- SRD 2014 monster data

The search supports creature-name queries such as goblin, vampire, skeleton, dragon, and similar SRD entries.

### Compendium workflow

A result can be:

- Previewed in the Compendium workspace.
- Added directly to the active encounter.
- Saved as an editable local Library entry.

### Library integration

- Saved Compendium creatures are tagged with provider/source identity rather than matched only by name.
- Library source filtering distinguishes **Custom** and **Compendium (SRD 5.1)** entries.
- Saving or refreshing an SRD creature can refresh/link matching active encounter combatants using provider + key identity.
- Existing DM-owned customization is preserved where intended, including local portrait, notes, tags, ID, and creation metadata.
- Adding another copy of the same SRD creature to an encounter does not overwrite the saved Library record.
- Duplicate creature names are handled through stable provider identity rather than name-only matching.

### Artwork policy

Remote SRD artwork is **not imported**. This avoids bundling or copying artwork whose reuse rights may differ from the SRD data.

The DM can assign a locally owned/imported portrait to a saved Compendium creature. When SRD mechanics are refreshed, the local portrait remains unless the DM replaces it.

### Caching and launcher integration

- Compendium index/details can use the local Compendium cache when available.
- The local launcher/proxy path was rewritten after earlier 404/fetch failures.
- The standard launcher now starts the required local Compendium proxy behavior automatically.
- Compendium search now works from the normal application launcher rather than a special development start command.

---

## 6. Character Library improvements

### Prepare → Characters

The Alpha 3 Character Library provides:

- Segmented categories for All, Players, NPCs, and Enemies & Creatures.
- Search across characters, tags, and notes.
- Game-system filtering.
- Source filtering for Custom versus Compendium entries.
- A cleaner create/edit panel.

### Active encounter synchronization

Library updates can be synchronized into linked active combatants without forcing the DM to remove and re-add the combatant.

This is particularly useful when:

- Replacing or assigning a portrait.
- Refreshing a Compendium-derived creature.
- Updating permanent Library data before or during a session.

Library/encounter references use stable IDs or Compendium identity rather than relying only on display names.

### Safer asset deletion references

Asset and Library workflows now scan broader references, including reusable templates, saved states, the current Run encounter, and recovery snapshots, before destructive asset operations.

---

## 7. Encounter preparation: templates and saved states

### Reusable Encounter Templates

Prepare → Encounters now separates reusable pre-game encounters from live snapshots.

Templates are intended for repeatable encounter setup and preserve prepared configuration while resetting transient live-combat progress when loaded.

Prepared template data can include:

- Encounter name and game system
- Combatant roster
- Scene background
- Combat background
- Scene music and ambience
- Combat music and ambience
- Sound Cue assignments
- Volume/fade/transition settings
- Prepared Timer configuration

Loading a reusable template resets transient values such as current HP, active D&D conditions, Exhaustion, current turn, round, and live combat progression as appropriate.

### Direct template editing

A reusable template can be selected and edited directly in **Prepare** without loading it into the live Run encounter.

The pre-game editor includes:

- Encounter name
- Template combatants
- Scene presentation
- Combat presentation
- Audio setup
- Sound Cues
- Timer setup
- **Save Encounter Setup** confirmation/status feedback

### Saved Encounter States

Saved Encounter States preserve live session progress for resuming play rather than creating a fresh reusable setup.

Run provides a **Load / Resume** menu with separate selectors for:

- Reusable Template → **Load Template**
- Saved Encounter State → **Resume State**

The separation is intended to prevent reusable templates from being unintentionally replaced by transient game-night state.

### Save Current Run as Template

Prepare → Encounters provides **Save Current Run as Template** so a useful live encounter can intentionally become a reusable template.

---

## 8. Scene, Combat, Player Display, and presentation workflow

### Player Display controls

The Run workspace now presents a dedicated **Display Controls** group:

- Open Display
- Show Scene
- Show Combat
- Send to Standby

Scene/Combat display selection is independent of the encounter phase when the DM needs presentation control without changing initiative state.

### Standby privacy screen

**Send to Standby** returns players to the private standby presentation without ending the DM's current scene/combat state.

### Initiative presentation

- Player Display continues to omit hidden combatants.
- The active visible combatant is automatically centered in Combat presentation.
- DM Auto-Follow keeps the active combatant in view on turn changes.
- Auto-Follow is limited to turn-changing actions so ordinary HP/status edits do not unexpectedly reposition the DM workspace.

---

## 9. Timer improvements

### Prepared timer configuration

Reusable encounter configuration continues to preserve prepared Timer settings such as:

- Timer name
- Duration
- Visual skin
- Player Display mode
- Player visibility
- DM/player numeric countdown preferences

Loading a reusable template creates a fresh Ready timer rather than restoring an old session's running timer.

### Runtime timer checkpoint

Alpha 3 adds runtime timer checkpoint persistence for restart/recovery behavior. The live timer can be restored when appropriate after application restart while remaining distinct from the reusable template's prepared timer configuration.

This prevents a reusable template from accidentally becoming a snapshot of an old running countdown.

### Run-screen timer controls

The active Run workspace shows current timer name, status, countdown/progress, and live controls so the DM can manage a prepared timer without leaving the encounter workflow.

---

## 10. Soundscape and Sound Cue workflow

- Scene and Combat audio remain encounter-bound.
- Scene music, ambience, combat music, combat ambience, master volume, fades, and transition behavior are preserved with prepared encounter configuration.
- Up to three one-shot cues remain available and are surfaced in Run as **Sound Cues**.
- Scene/Combat playback failure handling was hardened so the UI does not claim audio is playing when every configured track failed to start.
- Scene Audio reports when no scene audio is configured.
- Audio remains DM-computer playback; the Player Display remains visual-only to avoid duplicate playback/synchronization problems.

---

## 11. Themes, layout, and visual polish

Alpha 3 includes a substantial visual restructuring without changing the fundamental local-first architecture.

### Workspace visual polish

- Normalized live command-strip action heights and alignment.
- Tightened roster toolbar and combatant-row spacing.
- Improved hierarchy between primary and secondary actions.
- Made current-turn navigation visually secondary to the active-combatant information.
- Normalized live-control heading/button/hint spacing.
- Added consistent `focus-visible` treatment for keyboard navigation.
- Added theme-specific separators and refinements for Fantasy and Sci-Fi themes.

### Theme consistency

- Original, Fantasy, and Sci-Fi themes share the new workspace structure.
- Player Display styling continues to remain distinct from DM-only controls.
- Theme bootstrap was moved to an external script so it complies with the hardened Content Security Policy.

---

## 12. Browser, launcher, and localhost hardening

### Local-only server behavior

The packaged launcher continues to bind to `127.0.0.1` and now includes additional hardening:

- Rejects non-local Host/Origin requests.
- Restricts static resource paths.
- Validates supported upload types.
- Caps upload and backup sizes.
- Applies Content Security Policy and additional browser security headers.
- Adds `Cross-Origin-Resource-Policy` and `Permissions-Policy` headers.
- Restricts the Compendium outbound browser connection fallback to `https://www.dnd5eapi.co`.
- Removes Python runtime version exposure from the HTTP Server header.

### Cache behavior

- HTML is served with `Cache-Control: no-store`.
- Static application files use revalidation-oriented cache behavior.
- This reduces stale-interface problems between Alpha builds without requiring routine deletion of IndexedDB/site data.

### Theme bootstrap CSP fix

Inline theme bootstrap code was moved from `index.html` / `display.html` into `programs/app/js/theme-bootstrap.js`, allowing the browser pages to remain compatible with the stricter `script-src 'self'` policy.

### Runtime folder handling

- Runtime directories are created only when needed.
- The launcher reports a clearer error if the portable folder is not writable.
- Portable builds should therefore be extracted to a normal user-writable folder such as Documents/Desktop rather than Program Files.

### Duplicate launch handling

Starting enCounter again while a compatible local server is already running is handled gracefully rather than creating a second competing listener on port 5500.

### Startup guard improvements

Windows launcher/start scripts were hardened against stale port-5500 processes and multiple `pythonw.exe`/server instances encountered during development.

---

## 13. Portable-build and release hardening

### Pinned build dependencies

Release builds now pin:

- `PyInstaller==6.22.3`
- `pyinstaller-hooks-contrib==2026.9`

This reduces build drift between local and CI release generation.

### Native CI baselines

GitHub Actions uses explicit runners rather than floating “latest” aliases:

- Windows Server 2022
- Ubuntu 22.04

The older Linux baseline improves PyInstaller/glibc portability for Linux releases.

### Release-content audit

A new `programs/release_audit.py` checks staged portable releases before archive publication.

The audit blocks accidental distribution of development/runtime content including:

- browser/runtime backups
- exports/imports
- Compendium cache data
- personal/user media assets
- development-only folders/files
- missing required release files

### Build output validation

Windows and Linux build workflows now include:

- release audit before archive creation
- SHA-256 checksum generation
- packaged executable smoke tests
- duplicate-launch behavior checks
- shutdown checks
- downloaded-artifact checksum verification in CI

### Windows portable verification completed

The local Windows portable package was built successfully with PyInstaller 6.22.3 and Python 3.14.7. The release audit reported:

- Runtime data files: `0`
- Non-branding packaged assets: `0`

The packaged `enCounter.exe` opened the browser and DM Console successfully, and clean shutdown left no `LISTENING` socket on port 5500.

### Linux verification status

A physical/manual Linux desktop is not currently available for local testing. Native Linux build and packaged-executable verification are intended to run through the Ubuntu GitHub Actions job. Manual desktop integration testing is therefore deferred until a Linux environment is available.

---

## 14. Automated testing and regression coverage

The automated Node test suite has expanded significantly across Alpha 3.

Current verified result on the development branch:

- **145 tests**
- **145 passed**
- **0 failed**
- **0 skipped**

Coverage now includes, among other areas:

- upgrade/migration compatibility
- DM workspace routing
- Character Library behavior
- Compendium provider/search behavior
- Compendium-to-Library and Compendium-to-Encounter workflows
- Library/active-encounter synchronization
- encounter preparation and media persistence
- template/state lifecycle behavior
- runtime restart persistence
- Timer preparation/runtime separation
- Player Display Scene and Standby behavior
- initiative/current-turn regressions
- D&D 5E recovery/death saves
- theme consistency
- high-zoom UI behavior
- release-facing version consistency
- CSP-compatible theme bootstrap
- launcher/browser hardening
- portable build/audit requirements
- terminology regressions such as Quick Encounter and Sound Cues

---

## 15. Upgrade notes from 0.2.0-alpha.2

1. In the old build, wait for the DM Console to show **SAVED**.
2. Use **Data & Tools → Export Everything** and save the JSON outside the enCounter installation folder.
3. Keep a separate copy of custom `assets/` files used by portraits, backgrounds, or audio.
4. Use **Exit enCounter**; do not replace files while the local server is still running.
5. Download/extract `0.3.0-alpha.1` into a **new writable folder** rather than overwriting the old portable folder.
6. Start the new build using the same browser profile normally used for enCounter.
7. Verify the header reports `0.3.0-alpha.1`.
8. Verify Library entries, saved encounters/templates/states, Player Display, and custom assets.
9. If browser data is missing, import the Export Everything backup; do not clear IndexedDB as a first troubleshooting step.
10. Keep the previous portable folder until the new build has been verified.

### Database compatibility

Alpha 3 includes normalization/migration support intended to preserve existing Alpha data structures while introducing the new workspace, Compendium metadata, recovery fields, template/state semantics, and related runtime behavior. An Export Everything backup remains strongly recommended before every Alpha upgrade.

---

## 16. Known limitations / deferred items

- This remains Alpha / pre-release software.
- Manual Linux desktop testing is not yet complete; native CI verification is the release gate currently available.
- SWSE detailed unconscious/recovery-check automation is not implemented in this release; the new recovery UI provides manual state support.
- The current online Compendium provider is D&D 5E SRD. A local/SWSE Compendium provider is not part of this release.
- Remote Compendium artwork is intentionally not imported.
- Player Display and DM Console should use the same browser profile for local synchronization.
- Browser IndexedDB is stored outside the portable application folder and does not automatically travel when the folder is copied to another computer.
- User-imported images/audio are local files and are not embedded in JSON exports. Copy the relevant `assets/` files when moving an installation.
- The application server is designed for local use on `127.0.0.1`; enCounter is not intended to be exposed as a public network server.

---

## 17. Licensing, data source, and privacy notes

- enCounter is distributed under the **MIT License**.
- The D&D 5E Compendium uses SRD 5.1 creature data exposed through the 5e-bits D&D 5e SRD API. The application displays attribution in the Compendium workspace.
- enCounter does not import remote creature artwork from the Compendium provider.
- enCounter remains local-first and does not require a cloud account for normal use.
- The current application does not contain generative-AI functionality and does not intentionally send campaign data to an AI service.
- See `THIRD_PARTY_NOTICES.md`, `PRIVACY.md`, `SECURITY.md`, and `AI_ASSISTANCE.md` for project notices and policies.

---
