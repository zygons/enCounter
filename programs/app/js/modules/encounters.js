/*
 * Copyright (C) 2026 Zygons
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

ENC.encounterUI = {
  saved: [],

  getSaveModeLabel(mode) {
    return mode === "state" ? "Encounter State" : "Reusable Template";
  },

  getPreparedCues() {
    const soundscape = ENC.normalizeSoundscape(
      ENC.combat?.encounter?.soundscape,
    );
    return (soundscape.cues || []).filter((cue) => cue?.asset);
  },

  hasSceneAudio(soundscape) {
    const configured = ENC.normalizeSoundscape(soundscape);
    return Boolean(
      configured.scene.music?.asset ||
        configured.scene.ambience?.some?.((track) => track?.asset),
    );
  },

  hasCombatAudio(soundscape) {
    const configured = ENC.normalizeSoundscape(soundscape);
    return Boolean(
      configured.combat.music?.asset ||
        configured.combat.ambience?.some?.((track) => track?.asset) ||
        configured.scene.ambience?.some?.(
          (track) => track?.asset && track.combatBehavior !== "stop",
        ),
    );
  },

  renderCues() {
    const container = document.getElementById("encounterCueButtons");
    if (!container) return;

    container.innerHTML = "";
    const cues = this.getPreparedCues();

    if (!cues.length) {
      const empty = document.createElement("span");
      empty.className = "hint";
      empty.textContent = "No sound cues are configured for this encounter.";
      container.appendChild(empty);
      return;
    }

    cues.forEach((cue, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "encounter-cue-button";
      button.textContent = cue.name || `Cue ${index + 1}`;
      button.title = `Play ${cue.name || `Cue ${index + 1}`}`;

      button.addEventListener("click", async () => {
        const encounter = ENC.combat?.encounter;
        if (!encounter) return;

        // Use the soundscape belonging to the loaded working encounter.
        ENC.audio?.setSoundscape(encounter.soundscape);
        button.classList.add("is-playing");

        try {
          await ENC.audio?.playCue(cue);
        } catch (error) {
          ENC.app.toast(error.message || "Sound cue could not start.");
        } finally {
          window.setTimeout(() => button.classList.remove("is-playing"), 220);
        }
      });

      container.appendChild(button);
    });
  },

  fillSavedSelect(select, items, placeholder, selected = "") {
    if (!select) return;

    select.innerHTML = `<option value="">${placeholder}</option>`;

    for (const encounter of items) {
      const option = document.createElement("option");
      option.value = encounter.id;
      option.textContent =
        `${encounter.name} — ` +
        ENC.getSystemLabel(encounter.systemId, encounter.customProfile);
      select.appendChild(option);
    }

    if (items.some((item) => item.id === selected)) {
      select.value = selected;
    }
  },

  async refreshSaved() {
    this.saved = await ENC.db.getSavedEncounters();

    const templates = this.saved.filter(
      (encounter) => encounter.saveMode !== "state",
    );
    const states = this.saved.filter(
      (encounter) => encounter.saveMode === "state",
    );

    const templateSelect = document.getElementById("savedTemplateSelect");
    const stateSelect = document.getElementById("savedStateSelect");
    const quickTemplateSelect = document.getElementById("quickTemplateSelect");
    const quickStateSelect = document.getElementById("quickStateSelect");

    const selectedTemplate = templateSelect?.value || "";
    const selectedState = stateSelect?.value || "";
    const selectedQuickTemplate = quickTemplateSelect?.value || "";
    const selectedQuickState = quickStateSelect?.value || "";

    this.fillSavedSelect(
      templateSelect,
      templates,
      "Choose template…",
      selectedTemplate,
    );
    this.fillSavedSelect(
      quickTemplateSelect,
      templates,
      "Choose template…",
      selectedQuickTemplate || selectedTemplate,
    );
    this.fillSavedSelect(
      stateSelect,
      states,
      "Choose saved state…",
      selectedState,
    );
    this.fillSavedSelect(
      quickStateSelect,
      states,
      "Choose saved state…",
      selectedQuickState || selectedState,
    );
  },

  renderPhase() {
    const encounter = ENC.combat?.encounter;
    if (!encounter) return;

    const phase = encounter.phase || "prepared";
    const badge = document.getElementById("encounterPhaseStatus");
    if (badge) badge.textContent = phase.toUpperCase();

    const sceneButton = document.getElementById("showSceneBtn");
    const combatButton = document.getElementById("startCombatBtn");
    const endButton = document.getElementById("endCombatBtn");

    if (sceneButton) {
      sceneButton.disabled =
        phase === "scene" && encounter.playerDisplayMode === "scene";
    }
    if (combatButton) combatButton.disabled = phase === "combat";
    if (endButton) endButton.disabled = phase !== "combat";

    const sourceText = document.getElementById("loadedEncounterSource");
    if (sourceText) {
      const source = this.saved.find(
        (item) => item.id === encounter.sourceEncounterId,
      );

      sourceText.textContent = source
        ? `Loaded from ${this.getSaveModeLabel(source.saveMode)}: ${source.name}`
        : "Unsaved working encounter";
    }

    this.renderCues();
  },

  captureEncounterConfiguration() {
    const encounter = ENC.combat?.encounter;
    if (!encounter) return null;

    if (ENC.soundscapeUI?.collect) {
      encounter.soundscape = ENC.soundscapeUI.collect();
      ENC.audio?.setSoundscape(encounter.soundscape);
    }

    if (ENC.app?.getPreparedTimerConfig) {
      encounter.timer = ENC.app.getPreparedTimerConfig();
    }

    return encounter;
  },

  async createNewTemplate() {
    const requested = prompt("New encounter build name:", "New Encounter");
    if (!requested?.trim()) return;

    const current = ENC.combat?.encounter;
    if (
      ENC.isMeaningfulEncounter(current) &&
      !confirm(
        "Create a new encounter build? The current Run encounter will be cleared after a recovery snapshot is created. Saved encounters and Library data will not be deleted.",
      )
    ) {
      return;
    }

    const systemId =
      document.getElementById("encounterSystem")?.value ||
      current?.systemId ||
      ENC.settingsUI?.settings?.systemId ||
      "generic";
    const customProfile = ENC.deepClone(
      current?.customProfile ||
        ENC.settingsUI?.settings?.customProfile ||
        ENC.DEFAULT_SETTINGS.customProfile,
    );

    const blank = ENC.createDefaultEncounter();
    blank.name = requested.trim();
    blank.systemId = systemId;
    blank.customProfile = customProfile;
    blank.sourceEncounterId = null;
    blank.phase = "prepared";
    blank.playerDisplayMode = "standby";
    blank.combatants = [];

    const saved = await ENC.db.saveEncounterTemplate(
      blank,
      blank.name,
      null,
    );

    // A new Prepare build intentionally clears any currently loaded/quick
    // Run encounter so the old session cannot remain ghost-loaded.
    await ENC.combat?.resetActiveEncounter?.({
      name: "Quick Encounter",
      confirmReset: false,
      snapshotReason: "before prepare encounter build",
      toastMessage: null,
    });

    await this.refreshSaved();

    const select = document.getElementById("savedTemplateSelect");
    if (select) select.value = saved.id;

    ENC.encounterSetupUI?.syncFromSelection?.();
    this.renderPhase();
    ENC.app.toast(
      `New encounter build “${saved.name}” created in Prepare. Add combatants and configure the setup here, then load it from Run when ready.`,
    );
  },

  async saveTemplate(updateExisting = false) {
    const encounter = this.captureEncounterConfiguration();
    if (!encounter) return;

    let existingId = null;
    let name = encounter.name || "Encounter";

    if (updateExisting) {
      existingId = document.getElementById("savedTemplateSelect")?.value;

      if (!existingId) {
        return ENC.app.toast("Choose a reusable template to update.");
      }

      const existing = this.saved.find(
        (item) => item.id === existingId && item.saveMode !== "state",
      );

      if (!existing) {
        return ENC.app.toast("The selected reusable template could not be found.");
      }

      name = existing.name;
    } else {
      const requested = prompt(
        "Reusable encounter template name:",
        encounter.name || "Encounter",
      );

      if (!requested?.trim()) return;
      name = requested.trim();
    }

    /*
     * For a new record, clear the source pointer on the copy passed to the
     * database. This prevents an older database implementation from reusing
     * the ID of a loaded State or Template.
     */
    const saveSource = ENC.deepClone(encounter);
    if (!updateExisting) {
      saveSource.sourceEncounterId = null;
    }

    const saved = await ENC.db.saveEncounterTemplate(
      saveSource,
      name,
      existingId,
    );

    await ENC.combat.save(
      updateExisting ? "encounter template updated" : "encounter template saved",
    );

    await this.refreshSaved();

    const select = document.getElementById("savedTemplateSelect");
    if (select) select.value = saved.id;
    ENC.encounterSetupUI?.syncFromSelection?.();

    this.renderPhase();

    ENC.app.toast(
      updateExisting
        ? "Reusable encounter template updated."
        : "Reusable encounter template saved.",
    );
  },

  async saveState(updateExisting = false) {
    const encounter = this.captureEncounterConfiguration();
    if (!encounter) return;

    let existingId = null;
    let name = encounter.name || "Encounter";

    if (updateExisting) {
      existingId = document.getElementById("savedStateSelect")?.value;

      if (!existingId) {
        return ENC.app.toast("Choose a saved encounter state to update.");
      }

      const existing = this.saved.find(
        (item) => item.id === existingId && item.saveMode === "state",
      );

      if (!existing) {
        return ENC.app.toast("The selected encounter state could not be found.");
      }

      name = existing.name;
    } else {
      const requested = prompt(
        "Saved encounter state name:",
        encounter.name || "Encounter",
      );

      if (!requested?.trim()) return;
      name = requested.trim();
    }

    /*
     * New States must always receive their own record ID. Clearing the source
     * pointer on this copy prevents a loaded Template from being overwritten.
     */
    const saveSource = ENC.deepClone(encounter);
    if (!updateExisting) {
      saveSource.sourceEncounterId = null;
    }

    const saved = await ENC.db.saveEncounterState(
      saveSource,
      name,
      existingId,
      {
        timerState: ENC.app?.getTimerSyncState?.(),
      },
    );

    await ENC.combat.save(
      updateExisting ? "encounter state updated" : "encounter state saved",
    );

    await this.refreshSaved();

    const select = document.getElementById("savedStateSelect");
    if (select) select.value = saved.id;

    this.renderPhase();

    ENC.app.toast(
      updateExisting
        ? "Encounter state updated."
        : "Current encounter state saved.",
    );
  },

  async loadEncounterById(id, expectedMode) {
    if (!id) return false;

    const item = this.saved.find((entry) => entry.id === id);
    if (!item) {
      ENC.app.toast("Saved encounter could not be found.");
      return false;
    }

    const actualMode = item.saveMode === "state" ? "state" : "template";
    if (actualMode !== expectedMode) {
      ENC.app.toast(
        expectedMode === "state"
          ? "Choose a saved encounter state."
          : "Choose a reusable encounter template.",
      );
      return false;
    }

    const description =
      actualMode === "state" ? "encounter state" : "reusable template";

    if (
      !confirm(
        `Load ${description} “${item.name}”? Your current working encounter will be replaced.`,
      )
    ) {
      return false;
    }

    ENC.audio?.stopAll(250);
    await ENC.app?.clearRuntimeTimerCheckpoint?.();

    const loaded = await ENC.db.loadSavedEncounter(id);
    if (!loaded) {
      ENC.app.toast("Saved encounter could not be loaded.");
      return false;
    }

    ENC.applyEncounterPresentation(loaded);
    ENC.combat.encounter = loaded;

    // Reusable templates are linked preparation material, so refresh their
    // durable Library-backed data at load time. Saved States are historical
    // checkpoints and intentionally retain the exact character data saved.
    if (actualMode === "template") {
      await ENC.combat.syncLinkedIdentities({
        full: true,
        persist: true,
        broadcast: false,
      });
    }

    ENC.audio?.setSoundscape(ENC.combat.encounter.soundscape);

    if (actualMode === "state" && item.timerCheckpoint) {
      ENC.app.applySavedTimerCheckpoint?.(item.timerCheckpoint, {
        broadcast: false,
      });
    } else {
      ENC.app.applyPreparedTimerConfig?.(loaded.timer, {
        broadcast: false,
      });
    }

    /*
     * Loading saved material never exposes it to the Player Display
     * automatically. The GM must deliberately show the display again.
     */
    ENC.app.playerDisplayPaused = true;
    ENC.app.playerDisplayMode = "standby";
    ENC.app.broadcastDisplayState?.();
    ENC.app.updatePlayerDisplayButton?.();

    ENC.combat.render();
    ENC.app.refreshEncounterMediaControls?.();
    ENC.soundscapeUI?.render?.();

    await this.refreshSaved();

    if (actualMode === "state") {
      const stateSelect = document.getElementById("savedStateSelect");
      const quickStateSelect = document.getElementById("quickStateSelect");
      if (stateSelect) stateSelect.value = id;
      if (quickStateSelect) quickStateSelect.value = id;
    } else {
      const templateSelect = document.getElementById("savedTemplateSelect");
      const quickTemplateSelect = document.getElementById("quickTemplateSelect");
      if (templateSelect) templateSelect.value = id;
      if (quickTemplateSelect) quickTemplateSelect.value = id;
    }

    this.renderPhase();

    if (actualMode === "state") {
      ENC.app.toast(`Resumed ${loaded.name}.`);
    } else {
      const sceneReady = Boolean(loaded.display?.sceneImage) || this.hasSceneAudio(loaded.soundscape);
      const combatReady = Boolean(loaded.display?.combatImage) || this.hasCombatAudio(loaded.soundscape);
      const presentation = [
        sceneReady ? "Scene setup ready" : null,
        combatReady ? "Combat setup ready" : null,
      ].filter(Boolean).join(" · ");
      ENC.app.toast(
        presentation
          ? `Loaded template ${loaded.name}. ${presentation}.`
          : `Loaded template ${loaded.name}.`,
      );
    }

    return true;
  },

  resetQuickLoadMenu() {
    const templateSelect = document.getElementById("quickTemplateSelect");
    const stateSelect = document.getElementById("quickStateSelect");
    const menu = document.querySelector(".encounter-load-menu");

    if (templateSelect) templateSelect.value = "";
    if (stateSelect) stateSelect.value = "";
    if (menu) menu.open = false;
  },

  async loadTemplate() {
    const id = document.getElementById("savedTemplateSelect")?.value;
    if (!id) {
      return ENC.app.toast("Choose a reusable template first.");
    }

    await this.loadEncounterById(id, "template");
  },

  async loadState() {
    const id = document.getElementById("savedStateSelect")?.value;
    if (!id) {
      return ENC.app.toast("Choose a saved encounter state first.");
    }

    await this.loadEncounterById(id, "state");
  },

  async quickLoadTemplate() {
    const id = document.getElementById("quickTemplateSelect")?.value;
    if (!id) return ENC.app.toast("Choose a reusable template first.");

    const loaded = await this.loadEncounterById(id, "template");
    if (loaded) this.resetQuickLoadMenu();
  },

  async quickLoadState() {
    const id = document.getElementById("quickStateSelect")?.value;
    if (!id) return ENC.app.toast("Choose a saved encounter state first.");

    const loaded = await this.loadEncounterById(id, "state");
    if (loaded) this.resetQuickLoadMenu();
  },

  async deleteSavedById(id, expectedMode) {
    if (!id) return;

    const item = this.saved.find((entry) => entry.id === id);
    if (!item) {
      return ENC.app.toast("Saved encounter could not be found.");
    }

    const actualMode = item.saveMode === "state" ? "state" : "template";
    if (actualMode !== expectedMode) return;

    const label =
      actualMode === "state"
        ? "saved encounter state"
        : "reusable encounter template";

    if (
      !confirm(
        `Delete ${label} “${item.name}”? This does not delete the currently loaded working copy.`,
      )
    ) {
      return;
    }

    await ENC.db.delete("encounters", id);

    if (ENC.combat.encounter?.sourceEncounterId === id) {
      ENC.combat.encounter.sourceEncounterId = null;
      await ENC.combat.save();
    }

    await this.refreshSaved();
    if (actualMode === "template") {
      ENC.encounterSetupUI?.syncFromSelection?.();
    }
    this.renderPhase();

    ENC.app.toast(
      actualMode === "state"
        ? "Saved encounter state deleted."
        : "Reusable encounter template deleted.",
    );
  },

  async deleteTemplate() {
    const id = document.getElementById("savedTemplateSelect")?.value;
    if (!id) {
      return ENC.app.toast("Choose a reusable template to delete.");
    }

    await this.deleteSavedById(id, "template");
  },

  async deleteState() {
    const id = document.getElementById("savedStateSelect")?.value;
    if (!id) {
      return ENC.app.toast("Choose a saved encounter state to delete.");
    }

    await this.deleteSavedById(id, "state");
  },

  async setPhase(phase, displayMode, options = {}) {
    const encounter = ENC.combat?.encounter;
    if (!encounter) return;

    const previousPhase = encounter.phase || "prepared";
    const transition = String(options.transition || "");

    // Re-apply the prepared template presentation at the moment it is used.
    // This prevents a stale live-control field from dropping saved media.
    ENC.applyEncounterPresentation(encounter);
    encounter.phase = phase;
    encounter.playerDisplayMode = displayMode;

    // Apply the Player Display presentation immediately so Scene/Combat
    // changes do not wait on persistence or audio transitions.
    ENC.app.setPlayerDisplayMode?.(displayMode);
    ENC.audio?.setSoundscape(encounter.soundscape);

    if (phase === "combat") {
      encounter.round = Math.max(1, Number(encounter.round || 1));

      if (!encounter.currentId) {
        ENC.sortCombatants(encounter.combatants);
        encounter.currentId =
          encounter.combatants.find(ENC.isTurnEligibleCombatant)?.id || null;
      }

      /*
       * Starting Combat should feel like one action. When automatic combat
       * audio is enabled, start/switch to the configured combat soundscape.
       * If no combat audio is configured, combat still starts normally.
       */
      if (
        encounter.soundscape?.autoSwitchToCombat !== false &&
        (this.hasCombatAudio(encounter.soundscape) || ENC.audio?.mode === "scene")
      ) {
        try {
          /*
           * playCombat() also owns the Scene -> Combat transition. Calling it
           * when Scene audio is already playing ensures Scene music stops and
           * Scene ambience applies its continue / duck / stop behavior even
           * when no dedicated Combat track is configured.
           */
          await ENC.audio?.playCombat();
        } catch (error) {
          ENC.app.toast(error.message);
        }
      }
    } else if (phase === "scene" && displayMode === "scene") {
      const endingCombat =
        previousPhase === "combat" && transition === "end-combat";
      const returnToScene =
        encounter.soundscape?.returnToSceneAfterCombat !== false;

      if (endingCombat && !returnToScene) {
        /*
         * End Combat must never leave Combat audio playing when automatic
         * return-to-scene audio is disabled. Explicit Show Scene remains a
         * separate DM action and can still start Scene audio on demand.
         */
        if (ENC.audio?.mode !== "stopped") ENC.audio?.stopAll();
      } else if (
        this.hasSceneAudio(encounter.soundscape) &&
        ENC.audio?.mode !== "scene"
      ) {
        try {
          await ENC.audio?.playScene();
        } catch (error) {
          ENC.app.toast(error.message);
        }
      }
    } else if (
      phase === "scene" &&
      displayMode === "standby" &&
      encounter.soundscape?.returnToSceneAfterCombat &&
      ENC.audio?.mode === "combat"
    ) {
      try {
        await ENC.audio?.returnToScene();
      } catch (error) {
        ENC.app.toast(error.message);
      }
    }

    await ENC.combat.save(`phase changed: ${phase}`);

    ENC.combat.render();

    if (phase === "combat") {
      ENC.combat.followCurrentTurn();
    }

    ENC.soundscapeUI?.renderStatus?.();
    this.renderPhase();
  },

  async startSceneAudio() {
    const encounter = ENC.combat?.encounter;
    if (!encounter) return;

    ENC.audio.setSoundscape(encounter.soundscape);

    try {
      await ENC.audio.playScene();
      ENC.soundscapeUI?.renderStatus?.();
      ENC.app.toast("Scene soundscape started.");
    } catch (error) {
      ENC.app.toast(error.message);
    }
  },

  stopAudio() {
    ENC.audio?.stopAll();
    ENC.soundscapeUI?.renderStatus?.();
    ENC.app.toast("Audio stopped.");
  },

  bind() {
    document
      .getElementById("quickLoadTemplateBtn")
      ?.addEventListener("click", () => this.quickLoadTemplate());

    document
      .getElementById("quickResumeStateBtn")
      ?.addEventListener("click", () => this.quickLoadState());

    document
      .getElementById("loadTemplateBtn")
      ?.addEventListener("click", () => this.loadTemplate());

    document
      .getElementById("dmNewEncounterBtn")
      ?.addEventListener("click", () => this.createNewTemplate());

    document
      .getElementById("saveNewTemplateBtn")
      ?.addEventListener("click", () => this.saveTemplate(false));

    document
      .getElementById("updateTemplateBtn")
      ?.addEventListener("click", () => this.saveTemplate(true));

    document
      .getElementById("deleteTemplateBtn")
      ?.addEventListener("click", () => this.deleteTemplate());

    document
      .getElementById("loadStateBtn")
      ?.addEventListener("click", () => this.loadState());

    document
      .getElementById("saveNewStateBtn")
      ?.addEventListener("click", () => this.saveState(false));

    document
      .getElementById("updateStateBtn")
      ?.addEventListener("click", () => this.saveState(true));

    document
      .getElementById("deleteStateBtn")
      ?.addEventListener("click", () => this.deleteState());

    document
      .getElementById("showSceneBtn")
      ?.addEventListener("click", () =>
        this.setPhase("scene", "scene", { transition: "show-scene" }),
      );

    document
      .getElementById("startCombatBtn")
      ?.addEventListener("click", () =>
        this.setPhase("combat", "combat", { transition: "start-combat" }),
      );

    document
      .getElementById("endCombatBtn")
      ?.addEventListener("click", () =>
        this.setPhase("scene", "scene", { transition: "end-combat" }),
      );

    document
      .getElementById("startSceneAudioBtn")
      ?.addEventListener("click", () => this.startSceneAudio());

    document
      .getElementById("stopEncounterAudioBtn")
      ?.addEventListener("click", () => this.stopAudio());
  },

  async initialize() {
    await this.refreshSaved();
    this.bind();
    this.renderPhase();
  },
};
