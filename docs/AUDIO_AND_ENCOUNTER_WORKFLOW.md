# enCounter — Alpha 3 Encounter Presentation, Audio, Timer, and Initiative Workflow

This document describes the encounter presentation and live-session workflow for **enCounter v0.3.0-alpha.1**.

Alpha 3 separates **Run** from **Prepare**. Reusable encounter setup is managed under **Prepare → Encounters**, while live game operation happens under **Run → Active Encounter**.

## Prepare an encounter

1. Open **Prepare → Encounters**.
2. Create a new encounter build or select a **Reusable Encounter Template**.
3. Add Library combatants to the template.
4. Configure the Scene background, Combat background, Scene audio, Combat audio, fade/transition behavior, and Sound Cues.
5. Configure the prepared Timer if the encounter uses one.
6. Click **Save Encounter Setup**.
7. When needed, use **Save Current Run as Template** to intentionally turn a useful live Run encounter into a reusable template.

Reusable templates reset transient live-combat progress when loaded. Use a **Saved Encounter State** when you need to resume live session progress instead.

## Start or resume play

From **Run → Active Encounter**:

- Use **+ Quick Encounter** for a session-only encounter.
- Use **Load / Resume → Reusable Template → Load Template** for a fresh prepared encounter.
- Use **Load / Resume → Saved Encounter State → Resume State** to continue a live saved session.

## Player Display modes

The Run workspace provides **Display Controls**:

- **Open Display** — opens the player-facing window.
- **Show Scene** — shows roleplay/exploration presentation.
- **Show Combat** — shows combat/initiative presentation.
- **Send to Standby** — returns players to the privacy screen without ending the DM's current encounter phase.

Hidden combatants remain omitted from the Player Display until revealed.

## Initiative and Active Turn

During combat, the Active Turn panel provides the current combatant's portrait, HP, defense/stat, initiative, statuses, and Quick Actions.

Use **Previous** / **Next Turn** to move through eligible initiative combatants. DM Auto-Follow brings the active combatant into view only when the active turn changes, so ordinary edits do not pull the DM away from another row.

The Player Display centers the current visible combatant when the turn changes.

## D&D 5E recovery

For D&D 5E Player combatants, reaching 0 HP automatically enters **Downed** recovery and adds **Unconscious**. The Recovery panel provides Death Saves, Stabilize, Mark Dead, Defeated, and Return to Combat controls.

Death Save automation in Alpha 3:

- Natural 20: regain 1 HP and return to Normal.
- Natural 1: two failures.
- 10–19: one success.
- 2–9: one failure.
- Three successes: Stable.
- Three failures: Dead.

Damage at 0 HP records one failure; add an extra failure manually when the hit should count for more than one.

## Soundscape and Sound Cues

Scene and Combat audio remain encounter-bound.

Prepared configuration can include:

- Scene music
- Scene ambience layers
- Combat music
- Combat ambience
- master volume
- fade/transition behavior
- automatic Scene-to-Combat switching
- optional return to Scene audio
- up to three one-shot Sound Cues

Sound Cues appear in the Run workspace after the encounter setup is saved/applied. Audio plays from the DM computer; the Player Display is visual-only.

## Timer behavior

Reusable encounter templates preserve prepared Timer configuration, including name, duration, skin, display mode, visibility, and numeric-countdown preferences.

Loading a template starts with a fresh Ready timer rather than restoring an old running countdown. Alpha 3 also maintains a separate runtime timer checkpoint so a live timer can be recovered after an application restart when appropriate.

## End of session

1. Wait for **SAVED**.
2. Save an encounter state if you need to resume the live session later.
3. Optionally use **Data & Tools → Export Everything** for a milestone backup.
4. Click **Exit enCounter**.
5. Wait for the local server to stop.
6. Close the browser after shutdown completes.
