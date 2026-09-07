/*
 * Copyright (C) 2026 Zygons
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

ENC.encounterUI = {
  saved: [],

  getPreparedCues() {
    const soundscape = ENC.normalizeSoundscape(ENC.combat?.encounter?.soundscape);
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
    const select = document.getElementById("savedEncounterSelect");
    if (!select) return;
    const selected = select.value;
    select.innerHTML = '<option value="">Load saved encounter…</option>';
    for (const encounter of this.saved) {
      const option = document.createElement("option");
      option.value = encounter.id;
      option.textContent = `${encounter.name} — ${ENC.getSystemLabel(encounter.systemId, encounter.customProfile)}`;
      select.appendChild(option);
    }
    if (this.saved.some((item) => item.id === selected)) select.value = selected;
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
    if (sceneButton) sceneButton.disabled = phase === "scene" && encounter.playerDisplayMode === "scene";
    if (combatButton) combatButton.disabled = phase === "combat";
    if (endButton) endButton.disabled = phase !== "combat";

    const sourceText = document.getElementById("loadedEncounterSource");
    if (sourceText) {
      const source = this.saved.find((item) => item.id === encounter.sourceEncounterId);
      sourceText.textContent = source ? `Loaded from: ${source.name}` : "Unsaved working encounter";
    }

    this.renderCues();
  },

  async saveCurrent(saveAs = false) {
    const encounter = ENC.combat?.encounter;
    if (!encounter) return;
    let existingId = saveAs ? null : encounter.sourceEncounterId;
    let name = encounter.name;
    if (ENC.soundscapeUI?.collect) {
      encounter.soundscape = ENC.soundscapeUI.collect();
      ENC.audio?.setSoundscape(encounter.soundscape);
    }
    if (saveAs || !existingId) {
      const requested = prompt("Saved encounter name:", encounter.name || "Encounter");
      if (!requested?.trim()) return;
      name = requested.trim();
    }

    const saved = await ENC.db.saveEncounterTemplate(encounter, name, existingId);
    encounter.sourceEncounterId = saved.id;
    encounter.name = saved.name;
    await ENC.combat.save(saveAs ? "encounter saved as" : "encounter template saved");
    await this.refreshSaved();
    this.renderPhase();
    ENC.app.toast(saveAs || !existingId ? "Encounter saved to Library." : "Saved encounter updated.");
  },

  async loadSelected() {
    const select = document.getElementById("savedEncounterSelect");
    const id = select?.value;
    if (!id) return ENC.app.toast("Choose a saved encounter first.");
    const item = this.saved.find((entry) => entry.id === id);
    if (!item) return;
    if (!confirm(`Load “${item.name}”? Your current working encounter will be replaced.`)) return;

    ENC.audio?.stopAll(250);
    const loaded = await ENC.db.loadSavedEncounter(id);
    if (!loaded) return ENC.app.toast("Saved encounter could not be loaded.");
    ENC.combat.encounter = loaded;
    ENC.audio?.setSoundscape(loaded.soundscape);
    ENC.app.playerDisplayPaused = true;
    ENC.app.playerDisplayMode = "standby";
    ENC.app.broadcastDisplayState?.();
    ENC.app.updatePlayerDisplayButton?.();
    ENC.combat.render();
    ENC.app.refreshEncounterMediaControls?.();
    ENC.soundscapeUI?.render?.();
    this.renderPhase();
    ENC.app.toast(`Loaded ${loaded.name}.`);
  },

  async duplicateSelected() {
    const id = document.getElementById("savedEncounterSelect")?.value;
    if (!id) return ENC.app.toast("Choose a saved encounter first.");
    const copy = await ENC.db.duplicateSavedEncounter(id);
    if (!copy) return;
    await this.refreshSaved();
    document.getElementById("savedEncounterSelect").value = copy.id;
    ENC.app.toast(`Created ${copy.name}.`);
  },

  async deleteSelected() {
    const id = document.getElementById("savedEncounterSelect")?.value;
    if (!id) return ENC.app.toast("Choose a saved encounter first.");
    const item = this.saved.find((entry) => entry.id === id);
    if (!item) return;
    if (!confirm(`Delete saved encounter “${item.name}”? This does not delete the currently loaded working copy.`)) return;
    await ENC.db.delete("encounters", id);
    if (ENC.combat.encounter?.sourceEncounterId === id) {
      ENC.combat.encounter.sourceEncounterId = null;
      await ENC.combat.save();
    }
    await this.refreshSaved();
    this.renderPhase();
    ENC.app.toast("Saved encounter deleted.");
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
        encounter.currentId = encounter.combatants.find(ENC.isTurnEligibleCombatant)?.id || null;
      }
      if (encounter.soundscape?.autoSwitchToCombat) {
        ENC.audio?.setSoundscape(encounter.soundscape);
        try { await ENC.audio?.playCombat(); } catch (error) { ENC.app.toast(error.message); }
      }
    } else if (phase === "scene" && encounter.soundscape?.returnToSceneAfterCombat && ENC.audio?.mode === "combat") {
      ENC.audio?.setSoundscape(encounter.soundscape);
      try { await ENC.audio?.returnToScene(); } catch (error) { ENC.app.toast(error.message); }
    }

    await ENC.combat.save(`phase changed: ${phase}`);
    ENC.app.setPlayerDisplayMode?.(displayMode);
    ENC.combat.render();
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
    document.getElementById("saveEncounterLibraryBtn")?.addEventListener("click", () => this.saveCurrent(false));
    document.getElementById("saveEncounterAsBtn")?.addEventListener("click", () => this.saveCurrent(true));
    document.getElementById("loadSavedEncounterBtn")?.addEventListener("click", () => this.loadSelected());
    document.getElementById("duplicateSavedEncounterBtn")?.addEventListener("click", () => this.duplicateSelected());
    document.getElementById("deleteSavedEncounterBtn")?.addEventListener("click", () => this.deleteSelected());

    document.getElementById("showSceneBtn")?.addEventListener("click", () => this.setPhase("scene", "scene"));
    document.getElementById("startCombatBtn")?.addEventListener("click", () => this.setPhase("combat", "combat"));
    document.getElementById("endCombatBtn")?.addEventListener("click", () => this.setPhase("scene", "scene"));
    document.getElementById("hideEncounterDisplayBtn")?.addEventListener("click", () => ENC.app.setPlayerDisplayMode?.("standby"));
    document.getElementById("startSceneAudioBtn")?.addEventListener("click", () => this.startSceneAudio());
    document.getElementById("stopEncounterAudioBtn")?.addEventListener("click", () => this.stopAudio());
  },

  async initialize() {
    await this.refreshSaved();
    this.bind();
    this.renderPhase();
  },
};
