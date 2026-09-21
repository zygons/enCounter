# enCounter — Saved Encounters, Scene Display, Soundscapes, and Initiative Tracking

This document describes the encounter presentation and live-session workflow for **enCounter v0.2.0-alpha.1**.

A prepared encounter can move through Scene and Combat presentation while retaining its Saved Encounter configuration, visual timers, Soundscape, and initiative state.

## Encounter workflow

1. Build an encounter in the DM Console: name, system, participants, Scene Image, Combat Background, Soundscape, and timer settings.

2. Use **Save** or **Save As…** in the Saved Encounter bar to store the prepared encounter.

3. Load a Saved Encounter later. enCounter creates an active working copy; game-night changes do not overwrite the saved encounter unless the DM explicitly presses **Save**.

4. Use **Show Scene** to display only the encounter's Scene Image on the Player Display. Initiative, combatants, round information, current turn, and next turn remain hidden.

5. Use **Scene Audio** to start the roleplay/exploration Soundscape independently of Player Display visibility.

6. Use **Start Combat** to:
   - Change the encounter to Combat phase.
   - Switch the Player Display to Combat mode.
   - Establish the current combatant from the initiative order.
   - Bring the current combatant into view on the DM Console.
   - Center the current visible combatant on the Player Display.
   - Transition the Soundscape to Combat audio when automatic Combat audio switching is enabled.

7. During combat, use **Next Turn**, **Previous Turn**, **Set Turn**, and **Trigger / Resume** to manage the active combatant. The DM Console and Player Display use the same current-turn state and remain synchronized as initiative changes.

8. Use **End Combat** to return the Player Display to Scene mode. If Scene audio was playing before combat and return-to-scene audio is enabled, the Scene Soundscape resumes automatically.

9. Use **Hide Player Display** at any time to return the players to STAND BY without stopping DM-side audio.

## Player Display modes

- **Stand By** — enCounter logo / STAND BY only. Encounter information and Player-visible timers are hidden.
- **Scene** — full-screen Scene Image. No initiative or combat UI is displayed. Player-visible timers may still appear.
- **Combat** — initiative and combat information is displayed using the Combat Background. Player-visible timers may still appear.

### Combat initiative presentation

During Combat mode, the Player Display follows the active initiative state maintained by the DM Console.

The current visible combatant is highlighted and automatically centered within the initiative display as turns advance. This keeps the active character or creature visible during encounters with initiative orders that are wider than the available Player Display area.

Hidden combatants remain omitted from the Player Display until the DM uses **Reveal to Players**.

## Initiative Tracking and DM Auto-Follow

The DM Console and Player Display share the same active-turn state. When initiative changes, both displays identify the same current combatant.

### DM Console behavior

The current combatant is highlighted on the DM Console.

The DM Console automatically follows and brings the active combatant into view when:

- **Start Combat** establishes the first current combatant.
- **Next Turn** advances initiative.
- **Previous Turn** moves backward through initiative.
- **Set Turn** manually selects a combatant as the current turn.
- **Trigger / Resume** causes a Delayed or Readied combatant to resume and take the current turn.

This makes it easier for the DM to follow the initiative order during encounters containing more combatants than can fit on the screen at once.

### Player Display behavior

When the active turn changes, the Player Display:

- Updates the current-turn highlight.
- Keeps the visible initiative order synchronized with the DM Console.
- Automatically centers the current visible combatant.
- Continues to omit combatants that are hidden from players.

### Auto-Follow only occurs on turn changes

DM Auto-Follow is intentionally limited to actions that change the active turn.

The DM Console does **not** automatically move back to the current combatant when the DM performs ordinary encounter edits such as:

- Damage or healing.
- Direct HP changes.
- Status changes.
- Condition Track changes.
- Resource adjustments.
- Notes or other combatant edits.
- Hide or Reveal actions.
- Restoring a combatant without making that combatant the current turn.

This allows the DM to work on another combatant's card without the screen unexpectedly jumping back to the active character.

## Soundscape

The Soundscape belongs to the loaded encounter and its configuration is saved with the Saved Encounter.

### Scene audio

- Optional Scene music.
- Up to three ambience layers in the current UI.
- Each Scene ambience layer can **Stop**, **Continue**, or **Lower Volume** when Combat begins.

### Combat audio

- Optional Combat music.
- Up to two additional Combat ambience layers in the current UI.
- Combat audio can begin automatically when **Start Combat** is selected.
- Scene audio can optionally return when Combat ends.

### Prepared cues

Three one-shot cue slots are available in the current Soundscape editor for alarms, explosions, doors, horns, creature sounds, transmissions, weapon effects, and similar events.

After the Soundscape is applied to the encounter, any configured cue appears automatically as a live **Prepared Cues** button on the Encounter tab.

These live cue buttons remain available during both Scene and Combat phases so the DM does not need to leave the Encounter screen during play.

### Saving and loading Soundscapes

Soundscapes are not stored or loaded separately. They are part of the Saved Encounter.

Loading a Saved Encounter restores its:

- Scene music configuration.
- Scene ambience configuration.
- Combat music configuration.
- Combat ambience configuration.
- Prepared Cue assignments.
- Volume settings.
- Fade settings.
- Scene-to-Combat transition behavior.
- Return-to-Scene behavior.

Loading an encounter does **not** automatically start audio playback.

The DM chooses when to start Scene Audio, Combat Audio, or a Prepared Cue.

### Audio library

Supported import formats:

- MP3
- OGG
- WAV
- FLAC

Folders:

```text
assets/sounds/music/
assets/sounds/ambience/
assets/sounds/sfx/
assets/sounds/custom/
```

Audio plays from the DM computer. The Player Display remains visual-only, avoiding duplicate playback and browser audio synchronization issues.

Saved Encounters store references to local audio assets rather than embedding the audio files themselves. When moving enCounter to another computer, copy the complete `assets/` folder if Saved Encounters depend on imported audio or images.

## Timers outside combat

Player-visible timers are independent of initiative.

A timer may be shown while the Player Display is in Scene mode, making it suitable for:

- Puzzles.
- Arrivals.
- Evacuations.
- Security responses.
- Environmental hazards.
- Reinforcements.
- Countdown events.
- Other roleplaying sequences.

Player-visible timers can also remain active during Combat mode.

While the Player Display is on **STAND BY**, Player-visible timers remain hidden.
