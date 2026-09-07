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
  playerDisplayWindow: null,
  playerDisplayWatchTimer: null,
  timerPreviewRenderer: null,
  timerController: null,

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
      encounter: ENC.combat?.encounter ? ENC.deepClone(ENC.combat.encounter) : null,
      timer: this.getTimerSyncState(),
    });
  },

  setPlayerDisplayMode(mode) {
    const next = ENC.PLAYER_DISPLAY_MODES.has(mode) ? mode : "standby";
    this.playerDisplayMode = next;
    this.playerDisplayPaused = next === "standby";
    if (ENC.combat?.encounter) {
      ENC.combat.encounter.playerDisplayMode = next;
      ENC.db.saveActiveEncounter(ENC.combat.encounter).catch((error) => console.warn("Could not persist display mode", error));
    }
    this.broadcastDisplayState();
    this.updatePlayerDisplayButton();
    ENC.encounterUI?.renderPhase?.();
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
    const button = document.getElementById("openDisplayBtn");

    if (!button) return;

    if (!this.playerDisplayConnected) {
      button.textContent = "Start Player Display";

      button.classList.remove("player-display-paused");

      return;
    }

    if (this.playerDisplayMode === "standby") {
      button.textContent = "Show Player Display";
      button.classList.add("player-display-paused");
      return;
    }

    button.textContent = "Hide Player Display";

    button.classList.remove("player-display-paused");
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

        this.updatePlayerDisplayButton();
      }
    }, 1000);
  },

  // ========================================
  // VISUAL TIMER
  // ========================================

  getTimerDurationFromInputs() {
    const minutesInput = document.getElementById("timerMinutes");
    const secondsInput = document.getElementById("timerSeconds");

    if (!minutesInput || !secondsInput) {
      return 0;
    }

    const rawMinutes = Number(minutesInput.value);
    const rawSeconds = Number(secondsInput.value);

    const minutes = Number.isFinite(rawMinutes)
      ? Math.max(0, Math.floor(rawMinutes))
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

  updateTimerUI() {
    if (!this.timerController) {
      return;
    }

    const state = this.timerController.getState();

    if (!state) {
      return;
    }

    const activeName = document.getElementById("timerActiveName");
    const statusText = document.getElementById("timerStatusText");

    if (activeName) {
      activeName.textContent = state.name || "Countdown";
    }

    if (statusText) {
      statusText.textContent = this.formatTimerStatus(state);
    }

    const startButton = document.getElementById("timerStartBtn");
    const pauseButton = document.getElementById("timerPauseBtn");
    const resumeButton = document.getElementById("timerResumeBtn");
    const resetButton = document.getElementById("timerResetBtn");
    const stopButton = document.getElementById("timerStopBtn");

    if (startButton) {
      startButton.disabled =
        state.status === "running" || state.status === "paused";
    }

    if (pauseButton) {
      pauseButton.disabled = state.status !== "running";
    }

    if (resumeButton) {
      resumeButton.disabled = state.status !== "paused";
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

    const initialDuration =
      this.getTimerDurationFromInputs() ||
      ENC.timer.DEFAULT_DURATION_MS ||
      300000;

    this.timerPreviewRenderer = ENC.timerRenderer.create(previewContainer);

    this.timerController = ENC.timer.create({
      renderer: this.timerPreviewRenderer,
      audience: "dm",

      initialState: {
        id: "primary-timer",
        name: document.getElementById("timerName")?.value.trim() || "Countdown",
        mode: "countdown",
        skin: document.getElementById("timerSkin")?.value || "hourglass",
        durationMs: initialDuration,
        remainingMs: initialDuration,
        status: "idle",
        visibleToPlayers:
          document.getElementById("timerShowPlayers")?.checked === true,
        showNumericToDM:
          document.getElementById("timerShowNumericDM")?.checked !== false,
        showNumericToPlayers:
          document.getElementById("timerShowNumericPlayers")?.checked === true,
        displayMode:
          document.getElementById("timerDisplayMode")?.value || "overlay",
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
  },

  bindTimerControls() {
    if (!this.timerController) {
      return;
    }

    const timerName = document.getElementById("timerName");
    const timerSkin = document.getElementById("timerSkin");
    const timerDisplayMode = document.getElementById("timerDisplayMode");

    const showPlayers = document.getElementById("timerShowPlayers");
    const showNumericPlayers = document.getElementById(
      "timerShowNumericPlayers",
    );
    const showNumericDM = document.getElementById("timerShowNumericDM");

    const minutesInput = document.getElementById("timerMinutes");
    const secondsInput = document.getElementById("timerSeconds");

    const startButton = document.getElementById("timerStartBtn");
    const pauseButton = document.getElementById("timerPauseBtn");
    const resumeButton = document.getElementById("timerResumeBtn");
    const resetButton = document.getElementById("timerResetBtn");
    const stopButton = document.getElementById("timerStopBtn");

    const subtractMinuteButton = document.getElementById(
      "timerSubtractMinuteBtn",
    );
    const subtractTenButton = document.getElementById("timerSubtractTenBtn");
    const addTenButton = document.getElementById("timerAddTenBtn");
    const addMinuteButton = document.getElementById("timerAddMinuteBtn");

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

    if (showPlayers) {
      showPlayers.addEventListener("change", () => {
        this.timerController.setVisibleToPlayers(showPlayers.checked);
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

    if (startButton) {
      startButton.addEventListener("click", () => {
        const state = this.timerController.getState();

        if (!state) {
          return;
        }

        if (state.status === "paused") {
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

    if (pauseButton) {
      pauseButton.addEventListener("click", () => {
        this.timerController.pause();
        this.updateTimerUI();
      });
    }

    if (resumeButton) {
      resumeButton.addEventListener("click", () => {
        this.timerController.resume();
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
  },

  bindAppControls() {
    // ========================================
    // PLAYER DISPLAY
    // ========================================

    const playerDisplayButton = document.getElementById("openDisplayBtn");

    if (playerDisplayButton) {
      this.updatePlayerDisplayButton();

      playerDisplayButton.addEventListener("click", () => {
        // ------------------------------------
        // START PLAYER DISPLAY
        // ------------------------------------

        if (!this.playerDisplayConnected) {
          const displayWindow = window.open(
            "/programs/app/display.html",
            "enCounterPlayerDisplay",
          );

          if (!displayWindow) {
            this.toast(
              "The Player Display could not be opened. Check your browser's pop-up settings.",
            );

            return;
          }

          this.playerDisplayWindow = displayWindow;

          this.startPlayerDisplayWatch();

          this.toast("Player Display starting...");

          return;
        }

        // ------------------------------------
        // HIDE / RESTORE EXISTING PLAYER DISPLAY
        // ------------------------------------

        if (this.playerDisplayMode === "standby") {
          const phase = ENC.combat?.encounter?.phase;
          this.setPlayerDisplayMode(phase === "combat" ? "combat" : "scene");
          this.toast("Player Display restored.");
        } else {
          this.setPlayerDisplayMode("standby");
          this.toast("Player Display hidden. DM changes are private.");
        }
      });
    }

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

    if (!ENC.isMeaningfulEncounter(savedEncounter)) {
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

        ENC.combat.encounter = ENC.deepClone(snapshot.encounter);

        ENC.combat.encounter.id = "active";
        ENC.combat.encounter.kind = "active";

        await ENC.combat.save("snapshot restored");

        ENC.combat.render();

        ENC.assets.fillSelect(
          document.getElementById("backgroundSelect"),
          "backgrounds/",
          ENC.combat.encounter.background,
        );

        this.toast("Encounter snapshot restored.");
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

    document.getElementById("assetFilter").addEventListener("change", () => {
      ENC.assets.renderGrid(
        document.getElementById("assetGrid"),
        document.getElementById("assetFilter").value,
      );
    });

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

    this.playerDisplayMode = ENC.PLAYER_DISPLAY_MODES.has(ENC.combat.encounter?.playerDisplayMode)
      ? ENC.combat.encounter.playerDisplayMode
      : "standby";
    this.playerDisplayPaused = this.playerDisplayMode === "standby";
    ENC.audio.setSoundscape(ENC.combat.encounter?.soundscape);

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

    await ENC.settingsUI.load();

    ENC.settingsUI.bind();

    ENC.settingsUI.render();

    await this.prepareStartupEncounter();

    await ENC.assets.refresh();

    await ENC.libraryUI.load();

    await ENC.combat.load();

    this.playerDisplayMode = ENC.PLAYER_DISPLAY_MODES.has(ENC.combat.encounter?.playerDisplayMode)
      ? ENC.combat.encounter.playerDisplayMode
      : "standby";
    this.playerDisplayPaused = this.playerDisplayMode === "standby";
    ENC.audio.setSoundscape(ENC.combat.encounter?.soundscape);

    this.bindNavigation();

    this.initializeTimer();

    this.bindTimerControls();

    this.bindAppControls();

    ENC.libraryUI.bind();

    ENC.combat.bind();

    this.bindDataTools();

    this.bindAssetTools();

    this.bindCustomSystem();

    await ENC.encounterUI.initialize();
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

        this.updatePlayerDisplayButton();

        this.announceDmPresence(true);

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
