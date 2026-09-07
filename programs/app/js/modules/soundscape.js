/*
 * Copyright (C) 2026 Zygons
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

ENC.soundscapeUI = {
  trackFromRow(prefix, defaultName, defaultVolume = 0.4, defaultBehavior = "stop") {
    const asset = document.getElementById(`${prefix}Asset`)?.value || "";
    const volume = Number(document.getElementById(`${prefix}Volume`)?.value ?? defaultVolume * 100) / 100;
    const behavior = document.getElementById(`${prefix}Behavior`)?.value || defaultBehavior;
    const combatVolume = Number(document.getElementById(`${prefix}CombatVolume`)?.value ?? 15) / 100;
    return ENC.normalizeAudioTrack({
      name: defaultName,
      asset,
      volume,
      loop: true,
      combatBehavior: behavior,
      combatVolume,
    }, { name: defaultName, volume: defaultVolume, combatBehavior: defaultBehavior });
  },

  cueFromRow(index) {
    const asset = document.getElementById(`cue${index}Asset`)?.value || "";
    const name = document.getElementById(`cue${index}Name`)?.value.trim() || `Cue ${index}`;
    const volume = Number(document.getElementById(`cue${index}Volume`)?.value ?? 80) / 100;
    return { ...ENC.normalizeAudioTrack({ name, asset, volume, loop: false }, { name, volume: 0.8 }), loop: false };
  },

  collect() {
    const sceneAmbience = [1, 2, 3]
      .map((index) => this.trackFromRow(`sceneAmb${index}`, `Scene Ambience ${index}`, 0.4, "duck"))
      .filter((track) => track.asset);
    const combatAmbience = [1, 2]
      .map((index) => this.trackFromRow(`combatAmb${index}`, `Combat Ambience ${index}`, 0.35, "continue"))
      .filter((track) => track.asset);
    const cues = [1, 2, 3]
      .map((index) => this.cueFromRow(index))
      .filter((track) => track.asset);

    return ENC.normalizeSoundscape({
      enabled: true,
      masterVolume: Number(document.getElementById("soundscapeMasterVolume")?.value ?? 80) / 100,
      fadeMs: Number(document.getElementById("soundscapeFadeSeconds")?.value ?? 2.5) * 1000,
      autoSwitchToCombat: document.getElementById("soundscapeAutoCombat")?.checked !== false,
      returnToSceneAfterCombat: document.getElementById("soundscapeReturnScene")?.checked !== false,
      scene: {
        music: this.trackFromRow("sceneMusic", "Scene Music", 0.35, "stop"),
        ambience: sceneAmbience,
      },
      combat: {
        music: this.trackFromRow("combatMusic", "Combat Music", 0.65, "continue"),
        ambience: combatAmbience,
      },
      cues,
    });
  },

  setTrackRow(prefix, track = {}, behavior = "stop") {
    const asset = document.getElementById(`${prefix}Asset`);
    const volume = document.getElementById(`${prefix}Volume`);
    const behaviorSelect = document.getElementById(`${prefix}Behavior`);
    const combatVolume = document.getElementById(`${prefix}CombatVolume`);
    if (asset) asset.value = track.asset || "";
    if (volume) volume.value = Math.round(Number(track.volume ?? 0.4) * 100);
    if (behaviorSelect) behaviorSelect.value = track.combatBehavior || behavior;
    if (combatVolume) combatVolume.value = Math.round(Number(track.combatVolume ?? 0.15) * 100);
  },

  refreshAudioSelects() {
    const audioItems = ENC.assets.byPrefix("sounds/");
    for (const select of document.querySelectorAll("select[data-audio-select]")) {
      const selected = select.value;
      const prefix = select.dataset.audioPrefix || "sounds/";
      select.innerHTML = '<option value="">— None —</option>';
      for (const item of audioItems.filter((entry) => entry.category.startsWith(prefix))) {
        const option = document.createElement("option");
        option.value = item.url;
        option.textContent = `${item.category.replace("sounds/", "")} / ${item.name}`;
        select.appendChild(option);
      }
      if ([...select.options].some((option) => option.value === selected)) select.value = selected;
    }
  },

  render() {
    const soundscape = ENC.normalizeSoundscape(ENC.combat?.encounter?.soundscape);
    this.refreshAudioSelects();
    const master = document.getElementById("soundscapeMasterVolume");
    const fade = document.getElementById("soundscapeFadeSeconds");
    const auto = document.getElementById("soundscapeAutoCombat");
    const returnScene = document.getElementById("soundscapeReturnScene");
    if (master) master.value = Math.round(soundscape.masterVolume * 100);
    if (fade) fade.value = soundscape.fadeMs / 1000;
    if (auto) auto.checked = soundscape.autoSwitchToCombat;
    if (returnScene) returnScene.checked = soundscape.returnToSceneAfterCombat;

    this.setTrackRow("sceneMusic", soundscape.scene.music, "stop");
    [1, 2, 3].forEach((index) => this.setTrackRow(`sceneAmb${index}`, soundscape.scene.ambience[index - 1] || {}, "duck"));
    this.setTrackRow("combatMusic", soundscape.combat.music, "continue");
    [1, 2].forEach((index) => this.setTrackRow(`combatAmb${index}`, soundscape.combat.ambience[index - 1] || {}, "continue"));

    [1, 2, 3].forEach((index) => {
      const cue = soundscape.cues[index - 1] || {};
      const name = document.getElementById(`cue${index}Name`);
      const asset = document.getElementById(`cue${index}Asset`);
      const volume = document.getElementById(`cue${index}Volume`);
      if (name) name.value = cue.name || `Cue ${index}`;
      if (asset) asset.value = cue.asset || "";
      if (volume) volume.value = Math.round(Number(cue.volume ?? 0.8) * 100);
    });
    this.renderStatus();
    ENC.encounterUI?.renderCues?.();
  },

  renderStatus() {
    const status = document.getElementById("soundscapeStatus");
    const live = document.getElementById("encounterAudioStatus");
    const label = ENC.audio?.mode === "scene" ? "SCENE AUDIO PLAYING" : ENC.audio?.mode === "combat" ? "COMBAT AUDIO PLAYING" : "AUDIO STOPPED";
    if (status) status.textContent = label;
    if (live) live.textContent = label;
  },

  async save() {
    if (!ENC.combat?.encounter) return;
    ENC.combat.encounter.soundscape = this.collect();
    ENC.audio.setSoundscape(ENC.combat.encounter.soundscape);
    await ENC.combat.save("soundscape updated");
    this.renderStatus();
    ENC.encounterUI?.renderCues?.();
    ENC.app.toast("Soundscape applied to the working encounter. Use Encounter → Save to update the Saved Encounter template.");
  },

  async previewScene() {
    ENC.combat.encounter.soundscape = this.collect();
    ENC.audio.setSoundscape(ENC.combat.encounter.soundscape);
    try { await ENC.audio.playScene(); this.renderStatus(); } catch (error) { ENC.app.toast(error.message); }
  },

  async previewCombat() {
    ENC.combat.encounter.soundscape = this.collect();
    ENC.audio.setSoundscape(ENC.combat.encounter.soundscape);
    try { await ENC.audio.playCombat(); this.renderStatus(); } catch (error) { ENC.app.toast(error.message); }
  },

  async playCue(index) {
    const cue = this.cueFromRow(index);
    if (!cue.asset) return ENC.app.toast("Choose a sound for this cue first.");
    try { await ENC.audio.playCue(cue); } catch (error) { ENC.app.toast(error.message); }
  },

  bind() {
    document.getElementById("saveSoundscapeBtn")?.addEventListener("click", () => this.save());
    document.getElementById("previewSceneAudioBtn")?.addEventListener("click", () => this.previewScene());
    document.getElementById("previewCombatAudioBtn")?.addEventListener("click", () => this.previewCombat());
    document.getElementById("stopSoundscapeBtn")?.addEventListener("click", () => { ENC.audio.stopAll(); this.renderStatus(); });
    [1, 2, 3].forEach((index) => document.getElementById(`playCue${index}Btn`)?.addEventListener("click", () => this.playCue(index)));

    document.getElementById("soundscapeMasterVolume")?.addEventListener("input", (event) => ENC.audio.setMasterVolume(Number(event.target.value) / 100));

    document.getElementById("uploadAudioBtn")?.addEventListener("click", async () => {
      const file = document.getElementById("audioUploadFile")?.files[0];
      const category = document.getElementById("audioUploadCategory")?.value || "sounds/custom";
      if (!file) return ENC.app.toast("Choose an audio file first.");
      try {
        await ENC.assets.upload(file, category);
        this.refreshAudioSelects();
        ENC.app.toast("Audio imported.");
      } catch (error) {
        ENC.app.toast(error.message);
      }
    });

    ENC.audio.onStateChange(() => this.renderStatus());
  },

  initialize() {
    ENC.audio.setSoundscape(ENC.combat?.encounter?.soundscape);
    this.bind();
    this.render();
  },
};
