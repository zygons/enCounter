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

  renderCues() {
    const container = document.getElementById("encounterCueButtons");
    if (!container) return;

    container.innerHTML = "";
    const cues = this.getPreparedCues();

    if (!cues.length) {
      const empty = document.createElement("span");
      empty.className = "hint";
      empty.textContent = "No prepared sound cues for this encounter.";
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

  async refreshSaved() {
    this.saved = await ENC.db.getSavedEncounters();

    const templateSelect = document.getElementById("savedTemplateSelect");
    const stateSelect = document.getElementById("savedStateSelect");

    const selectedTemplate = templateSelect?.value || "";
    const selectedState = stateSelect?.value || "";

    const templates = this.saved.filter(
      (encounter) => encounter.saveMode !== "state",
    );
    const states = this.saved.filter(
      (encounter) => encounter.saveMode === "state",
    );

    if (templateSelect) {
      templateSelect.innerHTML =
        '<option value="">Choose template…</option>';

      for (const encounter of templates) {
        const option = document.createElement("option");
        option.value = encounter.id;
        option.textContent =
          `${encounter.name} — ` +
          ENC.getSystemLabel(encounter.systemId, encounter.customProfile);
        templateSelect.appendChild(option);
      }

      if (templates.some((item) => item.id === selectedTemplate)) {
        templateSelect.value = selectedTemplate;
      }
    }

    if (stateSelect) {
      stateSelect.innerHTML =
        '<option value="">Choose saved state…</option>';

      for (const encounter of states) {
        const option = document.createElement("option");
        option.value = encounter.id;
        option.textContent =
          `${encounter.name} — ` +
          ENC.getSystemLabel(encounter.systemId, encounter.customProfile);
        stateSelect.appendChild(option);
      }

      if (states.some((item) => item.id === selectedState)) {
        stateSelect.value = selectedState;
      }
    }
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
    if (!id) return;

    const item = this.saved.find((entry) => entry.id === id);
    if (!item) {
      return ENC.app.toast("Saved encounter could not be found.");
    }

    const actualMode = item.saveMode === "state" ? "state" : "template";
    if (actualMode !== expectedMode) {
      return ENC.app.toast(
        expectedMode === "state"
          ? "Choose a saved encounter state."
          : "Choose a reusable encounter template.",
      );
    }

    const description =
      actualMode === "state" ? "encounter state" : "reusable template";

    if (
      !confirm(
        `Load ${description} “${item.name}”? Your current working encounter will be replaced.`,
      )
    ) {
      return;
    }

    ENC.audio?.stopAll(250);

    const loaded = await ENC.db.loadSavedEncounter(id);
    if (!loaded) {
      return ENC.app.toast("Saved encounter could not be loaded.");
    }

    ENC.combat.encounter = loaded;
    ENC.audio?.setSoundscape(loaded.soundscape);

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
      if (stateSelect) stateSelect.value = id;
    } else {
      const templateSelect = document.getElementById("savedTemplateSelect");
      if (templateSelect) templateSelect.value = id;
    }

    this.renderPhase();

    ENC.app.toast(
      actualMode === "state"
        ? `Resumed ${loaded.name}.`
        : `Loaded template ${loaded.name}.`,
    );
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

  async setPhase(phase, displayMode) {
    const encounter = ENC.combat?.encounter;
    if (!encounter) return;

    encounter.phase = phase;
    encounter.playerDisplayMode = displayMode;

    if (phase === "combat") {
      encounter.round = Math.max(1, Number(encounter.round || 1));

      if (!encounter.currentId) {
        ENC.sortCombatants(encounter.combatants);
        encounter.currentId =
          encounter.combatants.find(ENC.isTurnEligibleCombatant)?.id || null;
      }

      if (encounter.soundscape?.autoSwitchToCombat) {
        ENC.audio?.setSoundscape(encounter.soundscape);

        try {
          await ENC.audio?.playCombat();
        } catch (error) {
          ENC.app.toast(error.message);
        }
      }
    } else if (
      phase === "scene" &&
      encounter.soundscape?.returnToSceneAfterCombat &&
      ENC.audio?.mode === "combat"
    ) {
      ENC.audio?.setSoundscape(encounter.soundscape);

      try {
        await ENC.audio?.returnToScene();
      } catch (error) {
        ENC.app.toast(error.message);
      }
    }

    await ENC.combat.save(`phase changed: ${phase}`);
    ENC.app.setPlayerDisplayMode?.(displayMode);

    ENC.combat.render();

    if (phase === "combat") {
      ENC.combat.followCurrentTurn();
    }

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
      .getElementById("loadTemplateBtn")
      ?.addEventListener("click", () => this.loadTemplate());

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
      ?.addEventListener("click", () => this.setPhase("scene", "scene"));

    document
      .getElementById("startCombatBtn")
      ?.addEventListener("click", () => this.setPhase("combat", "combat"));

    document
      .getElementById("endCombatBtn")
      ?.addEventListener("click", () => this.setPhase("scene", "scene"));

    document
      .getElementById("hideEncounterDisplayBtn")
      ?.addEventListener("click", () =>
        ENC.app.setPlayerDisplayMode?.("standby"),
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
