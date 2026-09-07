# enCounter — Saved Encounters, Scene Display, and Soundscapes

This development update separates a prepared encounter from active combat.

## Encounter workflow

1. Build an encounter in the DM Console: name, system, participants, Scene Image, Combat Background, Soundscape, and timer settings.
2. Use **Save** or **Save As…** in the Saved Encounter bar to store the prepared encounter.
3. Load a saved encounter later. enCounter creates an active working copy; game-night changes do not overwrite the saved template unless the DM explicitly presses **Save**.
4. Use **Show Scene** to display only the encounter's Scene Image on the Player Display. Initiative, combatants, round information, current turn, and next turn remain hidden.
5. Use **Scene Audio** to start the roleplay/exploration soundscape independently of the Player Display.
6. Use **Start Combat** to switch the Player Display to combat mode and, when enabled, transition the soundscape to combat audio.
7. Use **End Combat** to return the Player Display to Scene mode. If Scene audio was playing before combat and return-to-scene is enabled, it resumes automatically.
8. Use **Hide Player Display** at any time to return the players to STAND BY without stopping DM-side audio.

## Player Display modes

- **Stand By** — enCounter logo / STAND BY only. Timers are hidden.
- **Scene** — full-screen Scene Image. No initiative or combat UI. Player-visible timers may still appear.
- **Combat** — existing initiative/combat Player Display using the Combat Background. Player-visible timers may still appear.

## Soundscape

The Soundscape belongs to the loaded encounter and is saved with it.

### Scene audio

- Optional scene music.
- Up to three ambience layers in the current UI.
- Each ambience layer can **Stop**, **Continue**, or **Lower Volume** when combat begins.

### Combat audio

- Optional combat music.
- Up to two additional combat ambience layers in the current UI.

### Prepared cues

Three one-shot cue slots are available in the current Soundscape editor for alarms, explosions, doors, horns, creature sounds, and similar effects. After the Soundscape is applied to the encounter, any configured cue appears automatically as a live **Prepared Cues** button on the Encounter tab. These live cue buttons remain available in both Scene and Combat phases, so the DM does not need to leave the Encounter screen during play.

Soundscapes are not loaded separately. They are part of the Saved Encounter. Loading a Saved Encounter automatically loads its scene audio, combat audio, cue assignments, volumes, transition settings, and other Soundscape configuration into the working encounter.

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

Audio plays from the DM computer. The Player Display remains visual-only, avoiding cross-window audio duplication and browser autoplay/synchronization issues.

## Timers outside combat

Player-visible timers are independent of initiative. A timer may be shown while the Player Display is in Scene mode, making it suitable for puzzles, arrivals, evacuations, security response, environmental events, and other roleplaying sequences.
