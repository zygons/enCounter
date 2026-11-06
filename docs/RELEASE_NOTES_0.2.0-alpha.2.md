# enCounter 0.2.0-alpha.2

Alpha 2 maintenance release — October 1, 2026.

## Highlights

- Adds structured D&D 5E conditions and separate Exhaustion tracking.
- Shows D&D 5E condition and Exhaustion badges on the Player Display.
- Saves prepared Timer configuration with Saved Encounters and restores it in a fresh Ready state.
- Resets transient D&D 5E conditions and Exhaustion when reusable encounters are freshly loaded.
- Improves Soundscape error reporting when configured audio cannot start.
- Corrects release/build consistency issues.

## Upgrade note

Use **Export Everything** before upgrading. Extract the new portable release to a fresh folder rather than overwriting the old application folder. Copy any custom media assets you want to retain, then import/restore your data if required. Browser IndexedDB is profile-local and is not stored inside the portable application folder.

The IndexedDB schema version remains unchanged for this maintenance release.
