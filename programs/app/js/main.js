/*
 * Copyright (C) 2026 Zygons
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

ENC.app = {
  toastTimer: null,
  playerDisplayPaused: true,
  playerDisplayMode: "standby",
  playerDisplayConnected: false,
  playerDisplayAcknowledgedMode: null,
  playerDisplayWindow: null,
  playerDisplayWatchTimer: null,
  timerPreviewRenderer: null,
  timerController: null,
  preparedTimerConfig: null,
  timerConfigSaveTimer: null,
  timerRailTicker: null,
  runtimeTimerPersistTicker: null,
  runtimeTimerPersistTimer: null,
  runtimeTimerMetaKey: "active-timer-runtime",

  getActiveUiTheme() {
    const bodyTheme = document.body?.dataset?.uiTheme;
    const storedTheme = localStorage.getItem("encounter-ui-theme");
    const settingsTheme = ENC.settingsUI?.settings?.uiTheme;
    return ENC.normalizeUiTheme(bodyTheme || storedTheme || settingsTheme || "scifi");
  },

  toast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  },

  setSaveIndicator(saving) {
    const indicator = document.getElementById("saveIndicator");
    indicator.textContent = saving ? "● SAVING…" : "✓ SAVED";
    indicator.classList.toggle("saving", saving);
  },

  announceDmPresence(includeEncounter = false) {
    ENC.sync.broadcast("dm-presence", {
      sentAt: Date.now(),

      playerDisplayPaused: this.playerDisplayMode === "standby",
      playerDisplayMode: this.playerDisplayMode,
      uiTheme: this.getActiveUiTheme(),

      encounter:
        includeEncounter && ENC.combat?.encounter
          ? ENC.deepClone(ENC.combat.encounter)
          : null,

      /*
       * Include the current timer state so a
       * Player Display opened after the timer
       * has already started immediately joins
       * at the correct point.
       */
      timer: this.getTimerSyncState(),
    });
  },

  async getRuntimeTimerCheckpointRecord() {
    try {
      return await ENC.db.getMetaRecord(this.runtimeTimerMetaKey);
    } catch (error) {
      console.warn("Could not read runtime timer checkpoint", error);
      return null;
    }
  },

  runtimeTimerCheckpointIsMeaningful(checkpoint) {
    if (!checkpoint) return false;
    const durationMs = Math.max(1, Number(checkpoint.durationMs || 1));
    const remainingMs = Math.max(0, Number(checkpoint.remainingMs ?? durationMs));
    return checkpoint.status !== "idle" || remainingMs < durationMs;
  },

  async hasRuntimeTimerCheckpoint() {
    const record = await this.getRuntimeTimerCheckpointRecord();
    return this.runtimeTimerCheckpointIsMeaningful(record?.checkpoint);
  },

  async clearRuntimeTimerCheckpoint() {
    clearTimeout(this.runtimeTimerPersistTimer);
    this.runtimeTimerPersistTimer = null;
    try {
      await ENC.db.delete("meta", this.runtimeTimerMetaKey);
      return true;
    } catch (error) {
      console.warn("Could not clear runtime timer checkpoint", error);
      return false;
    }
  },

  async persistRuntimeTimerCheckpoint(timerState = null) {
    if (!this.timerController || !ENC.combat?.encounter) return false;

    const state = timerState || this.timerController.getState();
    if (!state) return false;

    const checkpoint = ENC.normalizeTimerCheckpoint(
      state,
      ENC.combat.encounter.timer,
    );

    if (!this.runtimeTimerCheckpointIsMeaningful(checkpoint)) {
      await this.clearRuntimeTimerCheckpoint();
      return false;
    }

    try {
      await ENC.db.saveMetaRecord(this.runtimeTimerMetaKey, {
        checkpoint,
        encounterSourceId: ENC.combat.encounter.sourceEncounterId || null,
        encounterName: ENC.combat.encounter.name || "Encounter",
      });
      return true;
    } catch (error) {
      console.warn("Could not persist runtime timer checkpoint", error);
      return false;
    }
  },

  scheduleRuntimeTimerCheckpointPersist(timerState = null, delay = 120) {
    clearTimeout(this.runtimeTimerPersistTimer);
    this.runtimeTimerPersistTimer = setTimeout(() => {
      this.runtimeTimerPersistTimer = null;
      this.persistRuntimeTimerCheckpoint(timerState).catch((error) =>
        console.warn("Could not persist runtime timer checkpoint", error),
      );
    }, Math.max(0, Number(delay) || 0));
  },

  async restoreRuntimeTimerCheckpoint(options = {}) {
    if (!this.timerController || !ENC.combat?.encounter) return false;

    const record = await this.getRuntimeTimerCheckpointRecord();
    const checkpoint = record?.checkpoint;
    if (!this.runtimeTimerCheckpointIsMeaningful(checkpoint)) return false;

    // A checkpoint belongs only to the current working encounter. Saved-source
    // IDs are stable across restart, so use them when available as a guard
    // against a stale checkpoint after a different Template/State is loaded.
    const activeSourceId = ENC.combat.encounter.sourceEncounterId || null;
    const checkpointSourceId = record?.encounterSourceId || null;
    if (checkpointSourceId && activeSourceId !== checkpointSourceId) {
      await this.clearRuntimeTimerCheckpoint();
      return false;
    }

    const restored = this.applySavedTimerCheckpoint(checkpoint, {
      broadcast: options.broadcast !== false,
      persistRuntime: false,
    });

    if (restored && options.toast === true) {
      this.toast("Timer checkpoint restored paused at the last saved time.");
    }

    return restored;
  },

  bindRuntimeTimerPersistence() {
    clearInterval(this.runtimeTimerPersistTicker);
    this.runtimeTimerPersistTicker = setInterval(() => {
      const state = this.timerController?.getState?.();
      if (state?.status === "running") {
        this.persistRuntimeTimerCheckpoint(state).catch((error) =>
          console.warn("Could not checkpoint running timer", error),
        );
      }
    }, 5000);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.persistRuntimeTimerCheckpoint().catch(() => {});
      }
    });

    window.addEventListener?.("pagehide", () => {
      this.persistRuntimeTimerCheckpoint().catch(() => {});
    });
  },

  getTimerSyncState() {
    if (!this.timerController) {
      return null;
    }

    const state = this.timerController.getState();

    if (!state) {
      return null;
    }

    /*
     * Timer state only contains plain data,
     * but clone it so the synchronization
     * layer never shares a mutable reference
     * with the DM timer controller.
     */
    return ENC.deepClone(state);
  },

  broadcastTimerState(timerState = null) {
    const state = timerState || this.getTimerSyncState();

    if (!state) {
      return;
    }

    ENC.sync.broadcast("timer-state", {
      sentAt: Date.now(),

      timer: ENC.deepClone(state),
    });
  },

  broadcastDisplayState() {
    ENC.sync.broadcast("player-display-mode", {
      sentAt: Date.now(),
      mode: this.playerDisplayMode,
      uiTheme: this.getActiveUiTheme(),
      encounter: ENC.combat?.encounter ? ENC.deepClone(ENC.combat.encounter) : null,
      timer: this.getTimerSyncState(),
    });
  },

  getSafeStartupPlayerDisplayMode(encounter) {
    const savedMode = ENC.PLAYER_DISPLAY_MODES.has(encounter?.playerDisplayMode)
      ? encounter.playerDisplayMode
      : "standby";

    // Privacy-first startup behavior: outside active combat, always return
    // the Player Display to the Stand By screen. This prevents a persisted
    // Scene mode with no scene image from reopening as a black screen.
    if (encounter?.phase !== "combat") return "standby";

    return savedMode === "combat" ? "combat" : "standby";
  },

  setPlayerDisplayMode(mode) {
    const next = ENC.PLAYER_DISPLAY_MODES.has(mode) ? mode : "standby";
    this.playerDisplayMode = next;
    this.playerDisplayPaused = next === "standby";
    this.playerDisplayAcknowledgedMode = null;

    if (ENC.combat?.encounter) {
      ENC.combat.encounter.playerDisplayMode = next;
      ENC.db
        .saveActiveEncounter(ENC.combat.encounter)
        .catch((error) => console.warn("Could not persist display mode", error));
    }

    // Broadcast immediately, then repeat briefly. A newly opened Player Display
    // can still be loading its BroadcastChannel when the DM clicks Show Scene.
    // The retries make the desired presentation deterministic without requiring
    // the DM to click the button multiple times.
    this.broadcastDisplayState();
    window.setTimeout(() => {
      if (this.playerDisplayMode === next) this.broadcastDisplayState();
    }, 120);
    window.setTimeout(() => {
      if (this.playerDisplayMode === next) this.broadcastDisplayState();
    }, 360);

    this.updatePlayerDisplayButton();
    ENC.encounterUI?.renderPhase?.();
  },

  openPlayerDisplayWindow() {
    try {
      if (this.playerDisplayWindow && !this.playerDisplayWindow.closed) {
        this.playerDisplayWindow.focus?.();
        return true;
      }
    } catch (error) {
      // Cross-window access may fail in unusual browser states; reopen by name.
    }

    const displayWindow = window.open(
      "/programs/app/display.html",
      "enCounterPlayerDisplay",
    );

    if (!displayWindow) {
      this.toast(
        "The Player Display could not be opened. Check your browser's pop-up settings.",
      );
      return false;
    }

    this.playerDisplayWindow = displayWindow;
    this.playerDisplayConnected = false;
    this.playerDisplayAcknowledgedMode = null;
    this.startPlayerDisplayWatch();
    this.updatePlayerDisplayButton();
    return true;
  },

  presentPlayerDisplay(mode) {
    const next = ENC.PLAYER_DISPLAY_MODES.has(mode) ? mode : "standby";

    if (next !== "standby") {
      const hasKnownWindow =
        this.playerDisplayWindow && !this.playerDisplayWindow.closed;
      if (!hasKnownWindow && !this.playerDisplayConnected) {
        if (!this.openPlayerDisplayWindow()) return false;
      }
    }

    this.setPlayerDisplayMode(next);

    if (next === "scene") {
      this.toast("Scene shown on Player Display.");
    } else if (next === "combat") {
      this.toast("Combat shown on Player Display.");
    } else {
      this.toast("Player Display hidden. Players see Stand By.");
    }

    return true;
  },

  refreshEncounterMediaControls() {
    if (!ENC.combat?.encounter) return;
    ENC.assets.fillSelect(
      document.getElementById("backgroundSelect"),
      "backgrounds/",
      ENC.combat.encounter.display?.combatImage || ENC.combat.encounter.background || "",
    );
    ENC.assets.fillSelect(
      document.getElementById("sceneImageSelect"),
      "backgrounds/",
      ENC.combat.encounter.display?.sceneImage || ENC.combat.encounter.background || "",
    );
  },

  updatePlayerDisplayButton() {
    const openButton = document.getElementById("openDisplayBtn");
    const sceneButton = document.getElementById("showSceneDisplayBtn");
    const combatButton = document.getElementById("showCombatDisplayBtn");
    const hideButton = document.getElementById("hideEncounterDisplayBtn");
    const status = document.getElementById("playerDisplayStatus");

    const hasWindow = Boolean(
      this.playerDisplayWindow && !this.playerDisplayWindow.closed,
    );
    const phase = ENC.combat?.encounter?.phase || "prepared";
    const mode = this.playerDisplayMode || "standby";
    const acknowledged = this.playerDisplayAcknowledgedMode === mode;

    if (openButton) {
      openButton.textContent =
        this.playerDisplayConnected || hasWindow ? "Focus Display" : "Open Display";
      openButton.classList.toggle("player-display-paused", !this.playerDisplayConnected);
    }

    if (sceneButton) {
      sceneButton.classList.toggle("active", mode === "scene");
      sceneButton.setAttribute("aria-pressed", String(mode === "scene"));
    }

    if (combatButton) {
      combatButton.disabled = phase !== "combat";
      combatButton.classList.toggle("active", mode === "combat");
      combatButton.setAttribute("aria-pressed", String(mode === "combat"));
    }

    if (hideButton) {
      hideButton.disabled = mode === "standby" && this.playerDisplayConnected;
      hideButton.classList.toggle("active", mode === "standby");
      hideButton.setAttribute("aria-pressed", String(mode === "standby"));
    }

    if (status) {
      status.classList.remove(
        "display-status-closed",
        "display-status-starting",
        "display-status-standby",
        "display-status-scene",
        "display-status-combat",
      );

      if (!this.playerDisplayConnected) {
        if (hasWindow) {
          status.textContent = `STARTING · ${mode.toUpperCase()}`;
          status.classList.add("display-status-starting");
        } else {
          status.textContent = "CLOSED";
          status.classList.add("display-status-closed");
        }
      } else if (!acknowledged) {
        status.textContent = `SYNCING · ${mode.toUpperCase()}`;
        status.classList.add("display-status-starting");
      } else {
        status.textContent = mode.toUpperCase();
        status.classList.add(`display-status-${mode}`);
      }
    }
  },

  startPlayerDisplayWatch() {
    if (this.playerDisplayWatchTimer) {
      clearInterval(this.playerDisplayWatchTimer);
    }

    this.playerDisplayWatchTimer = setInterval(() => {
      if (!this.playerDisplayWindow) return;

      if (this.playerDisplayWindow.closed) {
        clearInterval(this.playerDisplayWatchTimer);

        this.playerDisplayWatchTimer = null;
        this.playerDisplayWindow = null;
        this.playerDisplayConnected = false;
        this.playerDisplayAcknowledgedMode = null;

        this.updatePlayerDisplayButton();
      }
    }, 1000);
  },

  // ========================================
  // VISUAL TIMER
  // ========================================

  setTimerConfigInputs(config) {
    const normalized = ENC.normalizeTimerConfig(config);
    const timerName = document.getElementById("timerName");
    const timerSkin = document.getElementById("timerSkin");
    const timerDisplayMode = document.getElementById("timerDisplayMode");
    const showNumericPlayers = document.getElementById(
      "timerShowNumericPlayers",
    );
    const showNumericDM = document.getElementById("timerShowNumericDM");

    if (timerName) timerName.value = normalized.name;
    if (timerSkin) timerSkin.value = normalized.skin;
    if (timerDisplayMode) timerDisplayMode.value = normalized.displayMode;
    if (showNumericPlayers) {
      showNumericPlayers.checked = normalized.showNumericToPlayers;
    }
    if (showNumericDM) showNumericDM.checked = normalized.showNumericToDM;
    this.setTimerDurationInputs(normalized.durationMs);
  },

  getPreparedTimerConfig() {
    if (this.preparedTimerConfig) {
      return ENC.deepClone(this.preparedTimerConfig);
    }

    return ENC.normalizeTimerConfig(ENC.combat?.encounter?.timer);
  },

  queuePreparedTimerConfigSave(timerState) {
    const normalized = ENC.normalizeTimerConfig(timerState);
    this.preparedTimerConfig = ENC.deepClone(normalized);

    if (ENC.combat?.encounter) {
      ENC.combat.encounter.timer = ENC.deepClone(normalized);
    }

    clearTimeout(this.timerConfigSaveTimer);
    this.timerConfigSaveTimer = setTimeout(() => {
      this.timerConfigSaveTimer = null;
      ENC.combat
        ?.save?.()
        .catch((error) => console.warn("Could not persist timer configuration", error));
    }, 250);
  },

  applyPreparedTimerConfig(config, options = {}) {
    const normalized = ENC.normalizeTimerConfig(config);
    const shouldPersist = options.persist === true;
    const shouldBroadcast = options.broadcast !== false;

    clearTimeout(this.timerConfigSaveTimer);
    this.timerConfigSaveTimer = null;
    this.preparedTimerConfig = ENC.deepClone(normalized);

    if (ENC.combat?.encounter) {
      ENC.combat.encounter.timer = ENC.deepClone(normalized);
    }

    this.setTimerConfigInputs(normalized);

    if (this.timerController) {
      this.timerController.setState(
        {
          id: "primary-timer",
          name: normalized.name,
          mode: "countdown",
          skin: normalized.skin,
          durationMs: normalized.durationMs,
          remainingMs: normalized.durationMs,
          endAt: null,
          status: "idle",
          visibleToPlayers: normalized.visibleToPlayers,
          showNumericToDM: normalized.showNumericToDM,
          showNumericToPlayers: normalized.showNumericToPlayers,
          displayMode: normalized.displayMode,
        },
        { notify: false },
      );
      this.updateTimerUI();
      if (shouldBroadcast) this.broadcastTimerState();
    }

    if (shouldPersist) {
      ENC.combat
        ?.save?.()
        .catch((error) => console.warn("Could not persist timer configuration", error));
    }

    return normalized;
  },

  applySavedTimerCheckpoint(checkpoint, options = {}) {
    if (!this.timerController || !checkpoint) return false;

    const state = ENC.normalizeTimerCheckpoint(
      checkpoint,
      ENC.combat?.encounter?.timer,
    );
    if (!state) return false;

    const shouldBroadcast = options.broadcast !== false;
    const shouldPersistRuntime = options.persistRuntime !== false;
    this.preparedTimerConfig = ENC.normalizeTimerConfig(state);
    this.setTimerConfigInputs(this.preparedTimerConfig);
    this.timerController.setState(state, { notify: false });
    this.updateTimerUI();
    if (shouldBroadcast) this.broadcastTimerState();
    if (shouldPersistRuntime) this.scheduleRuntimeTimerCheckpointPersist(state, 0);
    return true;
  },

  getTimerDurationFromInputs() {
    const minutesInput = document.getElementById("timerMinutes");
    const secondsInput = document.getElementById("timerSeconds");

    if (!minutesInput || !secondsInput) {
      return 0;
    }

    const rawMinutes = Number(minutesInput.value);
    const rawSeconds = Number(secondsInput.value);

    const minutes = Number.isFinite(rawMinutes)
      ? Math.min(999, Math.max(0, Math.floor(rawMinutes)))
      : 0;

    const seconds = Number.isFinite(rawSeconds)
      ? Math.min(59, Math.max(0, Math.floor(rawSeconds)))
      : 0;

    minutesInput.value = String(minutes);
    secondsInput.value = String(seconds);

    return (minutes * 60 + seconds) * 1000;
  },

  setTimerDurationInputs(milliseconds) {
    const minutesInput = document.getElementById("timerMinutes");
    const secondsInput = document.getElementById("timerSeconds");

    if (!minutesInput || !secondsInput) {
      return;
    }

    const totalSeconds = Math.max(
      0,
      Math.ceil(Number(milliseconds || 0) / 1000),
    );

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    minutesInput.value = String(minutes);
    secondsInput.value = String(seconds);
  },

  formatTimerStatus(state) {
    if (!state) {
      return "Unavailable";
    }

    if (state.status === "running") {
      return "Running";
    }

    if (state.status === "paused") {
      return "Paused";
    }

    if (state.status === "complete") {
      return "Complete";
    }

    if (state.status === "idle" && state.remainingMs < state.durationMs) {
      return "Stopped";
    }

    return "Ready";
  },

  formatRunTimerCountdown(milliseconds) {
    const totalSeconds = Math.max(
      0,
      Math.ceil(Number(milliseconds || 0) / 1000),
    );

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    const totalMinutes = Math.floor(totalSeconds / 60);
    return `${totalMinutes}:${String(seconds).padStart(2, "0")}`;
  },

  updateRunTimerReadout() {
    if (!this.timerController) return;

    const state = this.timerController.getState();
    if (!state) return;

    const remainingMs =
      typeof this.timerController.getRemainingMs === "function"
        ? this.timerController.getRemainingMs()
        : state.remainingMs;

    const durationMs = Math.max(1, Number(state.durationMs || 1));
    const ratio = Math.max(0, Math.min(1, remainingMs / durationMs));
    const percent = Math.round(ratio * 100);

    const countdown = document.getElementById("encounterTimerCountdown");
    const progress = document.getElementById("encounterTimerProgress");
    const progressFill = document.getElementById("encounterTimerProgressFill");

    if (countdown) {
      countdown.textContent = this.formatRunTimerCountdown(remainingMs);
      countdown.dataset.status = state.status || "idle";
    }

    if (progress) {
      progress.setAttribute("aria-valuenow", String(percent));
    }

    if (progressFill) {
      progressFill.style.width = `${percent}%`;
    }
  },

  updateTimerUI() {
    if (!this.timerController) {
      return;
    }

    const state = this.timerController.getState();

    if (!state) {
      return;
    }

    this.updateRunTimerReadout();

    const activeName = document.getElementById("timerActiveName");
    const statusText = document.getElementById("timerStatusText");

    if (activeName) {
      activeName.textContent = state.name || "Countdown";
    }

    if (statusText) {
      statusText.textContent = this.formatTimerStatus(state);
    }

    // Phase 3.1.13.2: mirror the prepared timer into the Run-screen
    // utility rail so the DM can operate it without leaving the encounter.
    const encounterTimerName = document.getElementById("encounterTimerName");
    const encounterTimerStatus = document.getElementById("encounterTimerStatus");
    const encounterTimerStartButton = document.getElementById("encounterTimerStartBtn");
    const encounterTimerResetButton = document.getElementById("encounterTimerResetBtn");
    const encounterTimerStopButton = document.getElementById("encounterTimerStopBtn");
    const encounterTimerVisibilityButton = document.getElementById(
      "encounterTimerVisibilityBtn",
    );

    if (encounterTimerName) {
      encounterTimerName.textContent = state.name || "Countdown";
    }

    if (encounterTimerStatus) {
      encounterTimerStatus.textContent = this.formatTimerStatus(state).toUpperCase();
    }

    if (encounterTimerStartButton) {
      encounterTimerStartButton.disabled = state.status === "running";
      encounterTimerStartButton.textContent =
        state.status === "running"
          ? "▶ Running"
          : state.status === "paused"
            ? "▶ Resume"
            : "▶ Start";
    }

    if (encounterTimerResetButton) {
      encounterTimerResetButton.disabled = false;
    }

    if (encounterTimerStopButton) {
      encounterTimerStopButton.disabled =
        state.status === "idle" || state.status === "complete";
    }

    if (encounterTimerVisibilityButton) {
      const visibleToPlayers = Boolean(state.visibleToPlayers);
      encounterTimerVisibilityButton.textContent = visibleToPlayers
        ? "Hide from Display"
        : "Show on Display";
      encounterTimerVisibilityButton.setAttribute(
        "aria-pressed",
        String(visibleToPlayers),
      );
    }

    const startButton = document.getElementById("timerStartBtn");
    const resetButton = document.getElementById("timerResetBtn");
    const stopButton = document.getElementById("timerStopBtn");

    // The Timer tool uses one adaptive primary action. Keeping the lifecycle
    // on one button prevents hidden/nonexistent Pause and Resume controls from
    // breaking the workflow after UI cleanup.
    if (startButton) {
      startButton.disabled = false;
      startButton.textContent =
        state.status === "running"
          ? "Pause Timer"
          : state.status === "paused"
            ? "Resume Timer"
            : "Start Timer";
      startButton.dataset.timerState = state.status;
    }

    if (resetButton) {
      resetButton.disabled = false;
    }

    if (stopButton) {
      stopButton.disabled =
        state.status === "idle" || state.status === "complete";
    }

    const durationLocked =
      state.status === "running" || state.status === "paused";

    const minutesInput = document.getElementById("timerMinutes");
    const secondsInput = document.getElementById("timerSeconds");

    if (minutesInput) {
      minutesInput.disabled = durationLocked;
    }

    if (secondsInput) {
      secondsInput.disabled = durationLocked;
    }

    /*
     * Keep the configured duration fields aligned with the timer
     * engine. Adding time can expand durationMs when the new
     * remaining time exceeds the original configured duration.
     */
    if (!durationLocked) {
      this.setTimerDurationInputs(state.durationMs);
    }
  },

  initializeTimer() {
    if (!ENC.timerRenderer || typeof ENC.timerRenderer.create !== "function") {
      throw new Error(
        "Timer renderer did not load. Check js/modules/timer-renderer.js.",
      );
    }

    if (!ENC.timer || typeof ENC.timer.create !== "function") {
      throw new Error("Timer engine did not load. Check js/modules/timer.js.");
    }

    const previewContainer = document.getElementById("timerPreview");

    if (!previewContainer) {
      throw new Error("Timer preview container was not found.");
    }

    const prepared = ENC.normalizeTimerConfig(ENC.combat?.encounter?.timer);
    this.preparedTimerConfig = ENC.deepClone(prepared);
    this.setTimerConfigInputs(prepared);

    this.timerPreviewRenderer = ENC.timerRenderer.create(previewContainer);

    this.timerController = ENC.timer.create({
      renderer: this.timerPreviewRenderer,
      audience: "dm",

      initialState: {
        id: "primary-timer",
        name: prepared.name,
        mode: "countdown",
        skin: prepared.skin,
        durationMs: prepared.durationMs,
        remainingMs: prepared.durationMs,
        status: "idle",
        visibleToPlayers: prepared.visibleToPlayers,
        showNumericToDM: prepared.showNumericToDM,
        showNumericToPlayers: prepared.showNumericToPlayers,
        displayMode: prepared.displayMode,
      },

      onStateChange: (timerState, reason) => {
        /*
         * Keep the DM controls/status synchronized
         * with the timer controller.
         */
        this.updateTimerUI();

        /*
         * Send state changes to the Player Display.
         *
         * We do NOT transmit animation frames.
         * The Player Display animates independently
         * using the shared endAt timestamp.
         */
        this.broadcastTimerState(timerState);

        if (
          [
            "duration",
            "name",
            "skin",
            "visibility",
            "player-numeric",
            "dm-numeric",
            "display-mode",
          ].includes(reason)
        ) {
          this.queuePreparedTimerConfigSave(timerState);
        }

        // Runtime timer state is not part of reusable encounter configuration.
        // Persist a lightweight paused checkpoint separately so a browser/app
        // restart can recover the last remaining time without counting while
        // enCounter is closed.
        this.scheduleRuntimeTimerCheckpointPersist(timerState);

        console.debug("Timer state changed:", reason, timerState);
      },

      onComplete: (timerState) => {
        this.updateTimerUI();

        /*
         * Ensure the Player Display receives the
         * final completed state immediately.
         */
        this.broadcastTimerState(timerState);

        this.toast("Timer complete.");
      },
    });

    this.updateTimerUI();

    clearInterval(this.timerRailTicker);
    this.timerRailTicker = setInterval(() => {
      this.updateRunTimerReadout();
    }, 250);
  },

  bindTimerControls() {
    if (!this.timerController) {
      return;
    }

    const timerName = document.getElementById("timerName");
    const timerSkin = document.getElementById("timerSkin");
    const timerDisplayMode = document.getElementById("timerDisplayMode");

    const showNumericPlayers = document.getElementById(
      "timerShowNumericPlayers",
    );
    const showNumericDM = document.getElementById("timerShowNumericDM");

    const minutesInput = document.getElementById("timerMinutes");
    const secondsInput = document.getElementById("timerSeconds");

    const startButton = document.getElementById("timerStartBtn");
    const resetButton = document.getElementById("timerResetBtn");
    const stopButton = document.getElementById("timerStopBtn");

    const subtractMinuteButton = document.getElementById(
      "timerSubtractMinuteBtn",
    );
    const subtractTenButton = document.getElementById("timerSubtractTenBtn");
    const addTenButton = document.getElementById("timerAddTenBtn");
    const addMinuteButton = document.getElementById("timerAddMinuteBtn");

    const encounterStartButton = document.getElementById("encounterTimerStartBtn");
    const encounterResetButton = document.getElementById("encounterTimerResetBtn");
    const encounterStopButton = document.getElementById("encounterTimerStopBtn");
    const encounterVisibilityButton = document.getElementById(
      "encounterTimerVisibilityBtn",
    );
    const openTimerToolButton = document.getElementById("openTimerToolBtn");
    const presetButtons = document.querySelectorAll("[data-timer-preset-ms]");
    const runTimerAdjustButtons = document.querySelectorAll(
      "[data-run-timer-adjust-ms]",
    );

    const applyDurationIfEditable = () => {
      const state = this.timerController.getState();

      if (!state) {
        return false;
      }

      if (state.status === "running" || state.status === "paused") {
        return false;
      }

      const durationMs = this.getTimerDurationFromInputs();

      if (durationMs <= 0) {
        this.toast("Timer duration must be greater than zero.");
        this.setTimerDurationInputs(state.durationMs);
        return false;
      }

      if (durationMs !== state.durationMs) {
        this.timerController.setDuration(durationMs);
      }

      return true;
    };

    if (timerName) {
      timerName.addEventListener("input", () => {
        this.timerController.setName(timerName.value);
      });
    }

    if (timerSkin) {
      timerSkin.addEventListener("change", () => {
        this.timerController.setSkin(timerSkin.value);
      });
    }

    if (timerDisplayMode) {
      timerDisplayMode.addEventListener("change", () => {
        this.timerController.setDisplayMode(timerDisplayMode.value);
      });
    }

    if (showNumericPlayers) {
      showNumericPlayers.addEventListener("change", () => {
        this.timerController.setShowNumericToPlayers(
          showNumericPlayers.checked,
        );
      });
    }

    if (showNumericDM) {
      showNumericDM.addEventListener("change", () => {
        this.timerController.setShowNumericToDM(showNumericDM.checked);
      });
    }

    if (minutesInput) {
      minutesInput.addEventListener("change", applyDurationIfEditable);
    }

    if (secondsInput) {
      secondsInput.addEventListener("change", applyDurationIfEditable);
    }

    for (const presetButton of presetButtons) {
      presetButton.addEventListener("click", () => {
        const state = this.timerController.getState();
        if (!state) return;
        if (state.status === "running" || state.status === "paused") {
          this.toast("Pause or stop the timer before changing its duration.");
          return;
        }

        const durationMs = Number(presetButton.dataset.timerPresetMs);
        if (!Number.isFinite(durationMs) || durationMs <= 0) return;
        this.timerController.setDuration(durationMs);
        this.setTimerDurationInputs(durationMs);
        this.updateTimerUI();
      });
    }

    if (startButton) {
      startButton.addEventListener("click", () => {
        const state = this.timerController.getState();

        if (!state) return;

        if (state.status === "running") {
          this.timerController.pause();
          this.updateTimerUI();
          return;
        }

        if (state.status === "paused") {
          this.timerController.resume();
          this.updateTimerUI();
          return;
        }

        /*
         * If the configured duration fields changed while the
         * timer was idle/complete, apply them before starting.
         *
         * A stopped timer preserves its remaining time when the
         * duration fields still match the configured duration.
         */
        const requestedDuration = this.getTimerDurationFromInputs();

        if (requestedDuration <= 0) {
          this.toast("Timer duration must be greater than zero.");
          return;
        }

        if (
          state.status === "complete" ||
          requestedDuration !== state.durationMs
        ) {
          this.timerController.setDuration(requestedDuration);
        }

        this.timerController.start();
        this.updateTimerUI();
      });
    }

    if (resetButton) {
      resetButton.addEventListener("click", () => {
        this.timerController.reset();
        this.updateTimerUI();
      });
    }

    if (stopButton) {
      stopButton.addEventListener("click", () => {
        this.timerController.stop();
        this.updateTimerUI();
      });
    }

    if (subtractMinuteButton) {
      subtractMinuteButton.addEventListener("click", () => {
        this.timerController.subtractTime(60_000);
        this.updateTimerUI();
      });
    }

    if (subtractTenButton) {
      subtractTenButton.addEventListener("click", () => {
        this.timerController.subtractTime(10_000);
        this.updateTimerUI();
      });
    }

    if (addTenButton) {
      addTenButton.addEventListener("click", () => {
        this.timerController.addTime(10_000);
        this.updateTimerUI();
      });
    }

    if (addMinuteButton) {
      addMinuteButton.addEventListener("click", () => {
        this.timerController.addTime(60_000);
        this.updateTimerUI();
      });
    }

    // Run-screen prepared timer controls deliberately delegate to the
    // existing Timer tool buttons so duration validation and persistence stay
    // in one place.
    if (encounterStartButton) {
      encounterStartButton.addEventListener("click", () => {
        const state = this.timerController.getState();
        if (state?.status === "paused") {
          this.timerController.resume();
          this.updateTimerUI();
          return;
        }
        startButton?.click();
      });
    }

    if (encounterResetButton) {
      encounterResetButton.addEventListener("click", () => {
        resetButton?.click();
      });
    }

    if (encounterStopButton) {
      encounterStopButton.addEventListener("click", () => {
        stopButton?.click();
      });
    }

    if (encounterVisibilityButton) {
      encounterVisibilityButton.addEventListener("click", () => {
        const state = this.timerController.getState();
        if (!state) return;

        const nextVisible = !Boolean(state.visibleToPlayers);
        this.timerController.setVisibleToPlayers(nextVisible);
        this.updateTimerUI();
        this.toast(
          nextVisible
            ? "Timer shown on Player Display."
            : "Timer hidden from Player Display.",
        );
      });
    }

    for (const adjustButton of runTimerAdjustButtons) {
      adjustButton.addEventListener("click", () => {
        const deltaMs = Number(adjustButton.dataset.runTimerAdjustMs);
        if (!Number.isFinite(deltaMs) || deltaMs === 0) return;

        if (deltaMs < 0) {
          this.timerController.subtractTime(Math.abs(deltaMs));
        } else {
          this.timerController.addTime(deltaMs);
        }

        this.updateTimerUI();
      });
    }

    if (openTimerToolButton) {
      openTimerToolButton.addEventListener("click", () => {
        document.querySelector('[data-section="timerSection"]')?.click();
      });
    }
  },

  bindAppControls() {
    // ========================================
    // PLAYER DISPLAY
    // ========================================

    const playerDisplayButton = document.getElementById("openDisplayBtn");
    const showSceneDisplayButton = document.getElementById("showSceneDisplayBtn");
    const showCombatDisplayButton = document.getElementById("showCombatDisplayBtn");
    const hideDisplayButton = document.getElementById("hideEncounterDisplayBtn");

    this.updatePlayerDisplayButton();

    playerDisplayButton?.addEventListener("click", () => {
      if (this.openPlayerDisplayWindow()) {
        this.toast(
          this.playerDisplayConnected
            ? "Player Display focused."
            : "Player Display starting...",
        );
      }
    });

    showSceneDisplayButton?.addEventListener("click", () => {
      this.presentPlayerDisplay("scene");
    });

    showCombatDisplayButton?.addEventListener("click", () => {
      if (ENC.combat?.encounter?.phase !== "combat") {
        this.toast("Start combat before showing the Combat presentation.");
        return;
      }
      this.presentPlayerDisplay("combat");
    });

    hideDisplayButton?.addEventListener("click", () => {
      this.presentPlayerDisplay("standby");
    });

    // ========================================
    // EXIT enCounter
    // ========================================

    const exitButton = document.getElementById("exitAppBtn");

    if (exitButton) {
      exitButton.addEventListener("click", async () => {
        if (
          !confirm(
            "Exit enCounter? The local server will stop after the latest backup attempt.",
          )
        ) {
          return;
        }

        exitButton.disabled = true;

        try {
          await this.persistRuntimeTimerCheckpoint();
          await ENC.backup.writeExternalBackup();

          const response = await fetch("/api/shutdown", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: "{}",
          });

          if (!response.ok) {
            throw new Error(await response.text());
          }

          this.toast("enCounter stopped. You can close this browser tab.");

          document.body.classList.add("app-stopped");
        } catch (error) {
          console.error(error);

          exitButton.disabled = false;

          this.toast("Unable to stop enCounter from this session.");
        }
      });
    }
  },

  bindNavigation() {
    for (const button of document.querySelectorAll(".nav-button")) {
      button.addEventListener("click", () => {
        for (const nav of document.querySelectorAll(".nav-button")) {
          nav.classList.remove("active");
        }

        for (const section of document.querySelectorAll(".app-section")) {
          section.classList.remove("active-section");
        }

        button.classList.add("active");

        document
          .getElementById(button.dataset.section)
          .classList.add("active-section");
      });
    }
  },

  async chooseStartupEncounter() {
    const savedEncounter = await ENC.db.get("encounters", "active");

    if (!savedEncounter) {
      await this.clearRuntimeTimerCheckpoint();
      return "new";
    }

    const hasRuntimeTimer = await this.hasRuntimeTimerCheckpoint();

    if (!ENC.isMeaningfulEncounter(savedEncounter) && !hasRuntimeTimer) {
      return "new";
    }

    const modal = document.getElementById("startupEncounterModal");
    const summary = document.getElementById("startupEncounterSummary");
    const resumeButton = document.getElementById("resumeEncounterBtn");
    const newButton = document.getElementById("startupNewEncounterBtn");

    if (!modal || !summary || !resumeButton || !newButton) {
      return "resume";
    }

    const combatantCount = (savedEncounter.combatants || []).length;

    const updated = savedEncounter.updatedAt
      ? new Date(savedEncounter.updatedAt).toLocaleString()
      : "Unknown";

    summary.textContent =
      `${savedEncounter.name || "Encounter"} • ` +
      `Round ${savedEncounter.round || 1} • ` +
      `${combatantCount} combatant${combatantCount === 1 ? "" : "s"} • ` +
      `${hasRuntimeTimer ? "Timer checkpoint available • " : ""}` +
      `Last saved ${updated}`;

    modal.classList.remove("hidden");

    return await new Promise((resolve) => {
      const finish = (choice) => {
        modal.classList.add("hidden");

        resumeButton.removeEventListener("click", resume);
        newButton.removeEventListener("click", startNew);

        resolve(choice);
      };

      const resume = () => finish("resume");
      const startNew = () => finish("new");

      resumeButton.addEventListener("click", resume);
      newButton.addEventListener("click", startNew);
    });
  },

  async prepareStartupEncounter() {
    const choice = await this.chooseStartupEncounter();

    if (choice !== "new") {
      return;
    }

    const previousEncounter = await ENC.db.get("encounters", "active");

    if (ENC.isMeaningfulEncounter(previousEncounter)) {
      await ENC.db.addSnapshot(
        previousEncounter,
        "before startup new encounter",
        ENC.settingsUI.settings?.snapshotLimit || 20,
      );
    }

    await this.clearRuntimeTimerCheckpoint();

    const freshEncounter = ENC.createDefaultEncounter();

    freshEncounter.systemId =
      previousEncounter?.systemId ||
      ENC.settingsUI.settings?.systemId ||
      "generic";

    freshEncounter.customProfile = ENC.deepClone(
      previousEncounter?.customProfile ||
        ENC.settingsUI.settings?.customProfile ||
        ENC.DEFAULT_SETTINGS.customProfile,
    );

    await ENC.db.saveActiveEncounter(freshEncounter);
  },

  async refreshStorageStatus() {
    const status = await ENC.backup.storageStatus();

    const mb = (bytes) =>
      bytes == null ? "Unknown" : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

    document.getElementById("storageStatus").innerHTML = `
      <p>
        <strong>Persistent storage:</strong>
        ${status.persisted ? "Enabled" : "Not yet granted"}
      </p>

      <p>
        <strong>Browser storage used:</strong>
        ${mb(status.usage)}
      </p>

      <p>
        <strong>Estimated quota:</strong>
        ${mb(status.quota)}
      </p>
    `;
  },

  async renderSnapshots() {
    const container = document.getElementById("snapshotList");

    const snapshots = await ENC.db.getAll("snapshots");

    snapshots.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    container.innerHTML = "";

    if (!snapshots.length) {
      container.innerHTML =
        '<div class="empty-state">No recovery snapshots yet.</div>';

      return;
    }

    for (const snapshot of snapshots) {
      const row = document.createElement("div");

      row.className = "snapshot-item";

      const text = document.createElement("span");

      const encounter = snapshot.encounter || {};

      text.textContent =
        `${new Date(snapshot.createdAt).toLocaleString()} — ` +
        `${snapshot.reason} — ` +
        `Round ${encounter.round || 1}`;

      const restore = document.createElement("button");

      restore.textContent = "Restore";

      restore.addEventListener("click", async () => {
        if (
          !confirm(
            "Restore this encounter snapshot? Permanent library data is not changed.",
          )
        ) {
          return;
        }

        await this.clearRuntimeTimerCheckpoint();

        ENC.combat.encounter = ENC.normalizeEncounter(
          ENC.deepClone(snapshot.encounter),
        );
        ENC.combat.encounter.id = "active";
        ENC.combat.encounter.kind = "active";
        ENC.combat.encounter.playerDisplayMode = "standby";

        ENC.applyEncounterPresentation(ENC.combat.encounter);
        ENC.audio?.stopAll?.(250);
        ENC.audio?.setSoundscape?.(ENC.combat.encounter.soundscape);
        this.applyPreparedTimerConfig(ENC.combat.encounter.timer, {
          broadcast: false,
        });

        this.playerDisplayMode = "standby";
        this.playerDisplayPaused = true;

        await ENC.combat.save("snapshot restored");

        ENC.combat.render();
        this.refreshEncounterMediaControls();
        ENC.soundscapeUI?.render?.();
        ENC.encounterUI?.renderPhase?.();
        this.broadcastDisplayState();
        this.broadcastTimerState();

        this.toast("Encounter snapshot restored. Player Display returned to Stand By.");
      });

      row.append(text, restore);

      container.appendChild(row);
    }
  },

  bindDataTools() {
    document
      .getElementById("exportLibraryBtn")
      .addEventListener("click", async () => {
        await ENC.backup.exportLibrary();

        this.toast("Library export created.");
      });

    document
      .getElementById("exportEverythingBtn")
      .addEventListener("click", async () => {
        await this.persistRuntimeTimerCheckpoint();
        await ENC.backup.exportEverything();

        this.toast("Full backup export created.");
      });

    document
      .getElementById("importBackupBtn")
      .addEventListener("click", async () => {
        const file = document.getElementById("importFile").files[0];

        if (!file) {
          return this.toast("Choose a JSON backup first.");
        }

        if (
          !confirm(
            "Import this enCounter backup? Full backups replace current app data, Library backups replace the Library, and single-entry imports add or update one Library entry.",
          )
        ) {
          return;
        }

        try {
          const result = await ENC.backup.importFile(file, true);

          this.toast(`Imported ${result.type} backup.`);

          await this.reloadData();
        } catch (error) {
          console.error(error);

          this.toast(error.message || "Import failed.");
        }
      });

    document
      .getElementById("restoreLatestBackupBtn")
      .addEventListener("click", async () => {
        if (
          !confirm(
            "Restore the latest external backup from data/backups/? Current browser data will be replaced.",
          )
        ) {
          return;
        }

        try {
          await ENC.backup.restoreLatestExternal();

          await this.reloadData();

          this.toast("Latest external backup restored.");
        } catch (error) {
          this.toast(error.message);
        }
      });

    document
      .getElementById("requestPersistenceBtn")
      .addEventListener("click", async () => {
        const granted = await ENC.backup.requestPersistentStorage();

        await this.refreshStorageStatus();

        this.toast(
          granted
            ? "Persistent browser storage enabled."
            : "The browser did not grant persistent storage. Export and external backups still work.",
        );
      });
  },

  bindAssetTools() {
    document
      .getElementById("refreshAssetsBtn")
      .addEventListener("click", async () => {
        await ENC.assets.refresh();

        this.refreshAssetUI();

        this.toast("Asset folders refreshed.");
      });

    const preferredAssetUploadCategory = (filter = "") => {
      const normalized = String(filter || "");
      const mapping = {
        "backgrounds/": "backgrounds/custom",
        "portraits/": "portraits/custom",
        tokens: "tokens",
        "sounds/music": "sounds/music",
        "sounds/ambience": "sounds/ambience",
        "sounds/sfx": "sounds/sfx",
        "icons/": "icons/conditions",
      };
      return mapping[normalized] || "";
    };

    const syncAssetUploadCategoryToFilter = () => {
      const filter = document.getElementById("assetFilter")?.value || "";
      const preferred = preferredAssetUploadCategory(filter);
      const categorySelect = document.getElementById("assetUploadCategory");
      if (!preferred || !categorySelect) return;
      if ([...categorySelect.options].some((option) => option.value === preferred)) {
        categorySelect.value = preferred;
      }
    };

    document.getElementById("assetFilter").addEventListener("change", () => {
      ENC.assets.renderGrid(
        document.getElementById("assetGrid"),
        document.getElementById("assetFilter").value,
      );
      syncAssetUploadCategoryToFilter();
    });

    document.getElementById("assetSearch")?.addEventListener("input", () => {
      ENC.assets.renderGrid(
        document.getElementById("assetGrid"),
        document.getElementById("assetFilter").value,
      );
    });

    const toggleAssetImport = (show) => {
      const panel = document.getElementById("assetImportPanel");
      if (!panel) return;
      panel.classList.toggle("hidden", !show);
      if (show) document.getElementById("assetUploadCategory")?.focus();
    };

    document
      .getElementById("toggleAssetImportBtn")
      ?.addEventListener("click", () => {
        syncAssetUploadCategoryToFilter();
        toggleAssetImport(true);
      });

    document
      .getElementById("closeAssetImportBtn")
      ?.addEventListener("click", () => toggleAssetImport(false));

    document
      .getElementById("uploadAssetBtn")
      .addEventListener("click", async () => {
        const file = document.getElementById("assetUploadFile").files[0];

        const category = document.getElementById("assetUploadCategory").value;

        if (!file) {
          return this.toast("Choose an asset first.");
        }

        try {
          await ENC.assets.upload(file, category);

          this.refreshAssetUI();
          document.getElementById("assetUploadFile").value = "";

          this.toast("Asset imported.");
        } catch (error) {
          this.toast(error.message);
        }
      });
  },

  refreshAssetUI() {
    this.refreshEncounterMediaControls();

    ENC.libraryUI.fillPortraitSelect(
      document.getElementById("libraryPortraitSelect").value,
    );

    ENC.assets.renderGrid(
      document.getElementById("assetGrid"),
      document.getElementById("assetFilter").value,
    );
    ENC.soundscapeUI?.refreshAudioSelects?.();
    ENC.encounterSetupUI?.refreshAssetOptions?.();
  },

  bindCustomSystem() {
    const settings = ENC.settingsUI.settings;

    document.getElementById("customSystemName").value =
      settings.customProfile.name;

    for (let i = 0; i < 4; i++) {
      document.getElementById(`customStat${i + 1}`).value =
        settings.customProfile.labels[i] || `Stat ${i + 1}`;
    }

    document
      .getElementById("saveCustomSystemBtn")
      .addEventListener("click", async () => {
        settings.customProfile = {
          name:
            document.getElementById("customSystemName").value.trim() ||
            "Custom System",

          labels: [1, 2, 3, 4].map(
            (i) =>
              document.getElementById(`customStat${i}`).value.trim() ||
              `Stat ${i}`,
          ),
        };

        await ENC.settingsUI.save();

        ENC.libraryUI.renderStatFields();

        this.toast("Custom system saved.");
      });
  },

  async reloadData() {
    await ENC.settingsUI.load();

    ENC.settingsUI.render();

    await ENC.libraryUI.load();

    ENC.libraryUI.render();

    await ENC.combat.load();
    ENC.applyEncounterPresentation(ENC.combat.encounter);

    this.playerDisplayMode = this.getSafeStartupPlayerDisplayMode(ENC.combat.encounter);
    this.playerDisplayPaused = this.playerDisplayMode === "standby";
    if (ENC.combat.encounter) {
      ENC.combat.encounter.playerDisplayMode = this.playerDisplayMode;
    }
    ENC.audio.setSoundscape(ENC.combat.encounter?.soundscape);
    this.applyPreparedTimerConfig(ENC.combat.encounter?.timer);
    await this.restoreRuntimeTimerCheckpoint({ broadcast: false });

    ENC.combat.render();

    await ENC.assets.refresh();

    this.refreshAssetUI();
    await ENC.encounterUI?.refreshSaved?.();
    ENC.encounterUI?.renderPhase?.();
    ENC.soundscapeUI.render();

    await this.renderSnapshots();

    await this.refreshStorageStatus();
  },

  async start() {
    // ========================================
    // Display enCounter version
    // ========================================

    const versionElement = document.getElementById("appVersion");

    if (versionElement) {
      versionElement.textContent =
        `${ENC.APP_STAGE.toUpperCase()} · ` + `v${ENC.APP_VERSION}`;
    }

    // ========================================
    // Start application
    // ========================================

    await ENC.db.open();

    // Upgrade compatibility assistant. Existing Alpha 2 users are shown the
    // new DM Workspace locations once; new installs continue without a prompt.
    await ENC.migration?.initialize?.();

    await ENC.settingsUI.load();

    ENC.settingsUI.bind();

    ENC.settingsUI.render();

    await this.prepareStartupEncounter();

    await ENC.assets.refresh();

    await ENC.libraryUI.load();

    await ENC.combat.load();

    this.playerDisplayMode = this.getSafeStartupPlayerDisplayMode(ENC.combat.encounter);
    this.playerDisplayPaused = this.playerDisplayMode === "standby";
    if (ENC.combat.encounter) {
      ENC.combat.encounter.playerDisplayMode = this.playerDisplayMode;
    }
    ENC.audio.setSoundscape(ENC.combat.encounter?.soundscape);

    this.bindNavigation();
    ENC.dmWorkspace?.initialize?.();
    ENC.compendiumUI?.initialize?.();

    this.initializeTimer();
    await this.restoreRuntimeTimerCheckpoint({ broadcast: false });
    this.bindRuntimeTimerPersistence();

    this.bindTimerControls();

    this.bindAppControls();

    ENC.libraryUI.bind();

    ENC.combat.bind();

    this.bindDataTools();

    this.bindAssetTools();

    this.bindCustomSystem();

    await ENC.encounterUI.initialize();
    ENC.encounterSetupUI?.initialize?.();
    ENC.soundscapeUI.initialize();

    ENC.libraryUI.resetForm();

    ENC.libraryUI.render();

    ENC.combat.render();

    this.refreshAssetUI();

    await this.renderSnapshots();

    await this.refreshStorageStatus();

    // ========================================
    // Cross-window synchronization
    // ========================================

    ENC.sync.onMessage(async (message) => {
      if (message.type === "display-hello") {
        this.playerDisplayConnected = true;
        this.playerDisplayAcknowledgedMode = null;

        this.updatePlayerDisplayButton();
        this.announceDmPresence(true);

        // Send the authoritative presentation once more after the Player Display
        // has announced that its synchronization listener is ready.
        window.setTimeout(() => this.broadcastDisplayState(), 60);

        return;
      }

      if (message.type === "display-mode-applied") {
        this.playerDisplayConnected = true;
        this.playerDisplayAcknowledgedMode = ENC.PLAYER_DISPLAY_MODES.has(
          message.mode,
        )
          ? message.mode
          : "standby";
        this.updatePlayerDisplayButton();
        return;
      }

      if (message.type === "settings-updated") {
        ENC.settingsUI.settings = ENC.normalizeSettings(message.settings);

        ENC.settingsUI.render();

        ENC.combat.render();
      }
    });
  },
};

document.addEventListener("DOMContentLoaded", () => {
  ENC.app.start().catch((error) => {
    console.error(error);

    alert(`enCounter could not start: ${error.message}`);
  });
});
