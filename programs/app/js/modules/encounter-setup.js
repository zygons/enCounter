/*
 * Copyright (C) 2026 Zygons
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

ENC.encounterSetupUI = {
  templateId: null,

  el(id) {
    return document.getElementById(id);
  },

  setSaveStatus(message, state = "neutral") {
    const status = this.el("encounterSetupSaveStatus");
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
  },

  markDirty() {
    if (!this.templateId) return;
    this.setSaveStatus("Unsaved setup changes", "dirty");
  },

  formatSavedTime(date = new Date()) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  },

  async syncLoadedEncounterPresentation(savedTemplate) {
    const active = ENC.combat?.encounter;
    if (!active || active.sourceEncounterId !== savedTemplate.id) return false;

    active.name = savedTemplate.name;
    active.presentation = ENC.deepClone(savedTemplate.presentation || {
      schemaVersion: 1,
      sceneBackground: savedTemplate.display?.sceneImage || "",
      combatBackground: savedTemplate.display?.combatImage || savedTemplate.background || "",
      soundscape: savedTemplate.soundscape,
    });
    ENC.applyEncounterPresentation(active);

    ENC.audio?.setSoundscape(active.soundscape);
    await ENC.combat.save("loaded template presentation updated");
    ENC.app.refreshEncounterMediaControls?.();
    ENC.soundscapeUI?.render?.();
    ENC.encounterUI?.renderCues?.();
    ENC.app.broadcastDisplayState?.();
    return true;
  },

  percent(value, fallback = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(100, Math.max(0, numeric));
  },

  fillBackgroundSelect(
    select,
    selected = "",
    placeholder = "— Default Scene Screen —",
  ) {
    if (!select) return;

    const current = selected || "";
    select.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = placeholder;
    select.appendChild(empty);

    for (const item of ENC.assets.byPrefix("backgrounds/")) {
      if (!ENC.assets.isImage(item)) continue;
      const option = document.createElement("option");
      option.value = item.url;
      option.textContent = item.name;
      select.appendChild(option);
    }

    if ([...select.options].some((option) => option.value === current)) {
      select.value = current;
    }
  },

  renderBackgroundPreview(preview, url, emptyText) {
    if (!preview) return;

    const safeUrl = ENC.sanitizeAssetUrl(url);
    preview.classList.toggle("has-image", Boolean(safeUrl));
    preview.style.backgroundImage = safeUrl ? `url("${safeUrl}")` : "";
    preview.innerHTML = "";

    if (!safeUrl) {
      const text = document.createElement("span");
      text.textContent = emptyText;
      preview.appendChild(text);
    }
  },

  refreshMediaSelects(template = null) {
    const sceneImage =
      template?.display?.sceneImage || template?.background || "";
    const combatImage =
      template?.display?.combatImage || template?.background || "";

    this.fillBackgroundSelect(
      this.el("encounterSetupSceneBackground"),
      sceneImage,
      "— Default Scene Screen —",
    );
    this.fillBackgroundSelect(
      this.el("encounterSetupCombatBackground"),
      combatImage,
      "— Default Combat Screen —",
    );

    ENC.soundscapeUI?.refreshAudioSelects?.();
  },

  // Phase 3.1.14.1: refresh asset-backed Encounter Setup controls without
  // discarding unsaved selections. This is used after an Asset Library import
  // or delete so newly available media appears immediately in the template
  // editor while the DM keeps the choices already made on screen.
  refreshAssetOptions() {
    const sceneSelect = this.el("encounterSetupSceneBackground");
    const combatSelect = this.el("encounterSetupCombatBackground");
    const sceneImage = sceneSelect?.value || "";
    const combatImage = combatSelect?.value || "";

    this.fillBackgroundSelect(
      sceneSelect,
      sceneImage,
      "— Default Scene Screen —",
    );
    this.fillBackgroundSelect(
      combatSelect,
      combatImage,
      "— Default Combat Screen —",
    );

    // soundscapeUI.refreshAudioSelects() preserves each select's current value
    // when that asset still exists, so unsaved audio choices survive too.
    ENC.soundscapeUI?.refreshAudioSelects?.();
  },

  setTrack(prefix, track = {}, defaults = {}) {
    const asset = this.el(`${prefix}`); // select itself
    const volume = this.el(`${prefix}Volume`);
    const behavior = this.el(`${prefix}Behavior`);
    const combatVolume = this.el(`${prefix}CombatVolume`);

    if (asset) asset.value = track.asset || "";
    if (volume) {
      volume.value = Math.round(
        Number(track.volume ?? defaults.volume ?? 0.4) * 100,
      );
    }
    if (behavior) {
      behavior.value =
        track.combatBehavior || defaults.combatBehavior || "stop";
    }
    if (combatVolume) {
      combatVolume.value = Math.round(
        Number(track.combatVolume ?? defaults.combatVolume ?? 0.15) * 100,
      );
    }
  },

  readTrack(prefix, existing = {}, defaults = {}) {
    const asset = this.el(prefix)?.value || "";
    const volume =
      this.percent(
        this.el(`${prefix}Volume`)?.value,
        Number(defaults.volume ?? 0.4) * 100,
      ) / 100;
    const behavior =
      this.el(`${prefix}Behavior`)?.value ||
      existing.combatBehavior ||
      defaults.combatBehavior ||
      "stop";
    const combatVolume =
      this.percent(
        this.el(`${prefix}CombatVolume`)?.value,
        Number(defaults.combatVolume ?? 0.15) * 100,
      ) / 100;

    return ENC.normalizeAudioTrack(
      {
        ...existing,
        name: defaults.name || existing.name || "Audio Track",
        asset,
        volume,
        loop: defaults.loop !== false,
        combatBehavior: behavior,
        combatVolume,
      },
      defaults,
    );
  },

  setCue(index, cue = {}) {
    const asset = this.el(`encounterSetupCue${index}Asset`);
    const name = this.el(`encounterSetupCue${index}Name`);
    const volume = this.el(`encounterSetupCue${index}Volume`);

    if (asset) asset.value = cue.asset || "";
    if (name) name.value = cue.name || `Cue ${index}`;
    if (volume) {
      volume.value = Math.round(Number(cue.volume ?? 0.8) * 100);
    }
  },

  readCue(index, existing = {}) {
    const asset = this.el(`encounterSetupCue${index}Asset`)?.value || "";
    const name =
      this.el(`encounterSetupCue${index}Name`)?.value.trim() ||
      `Cue ${index}`;
    const volume =
      this.percent(
        this.el(`encounterSetupCue${index}Volume`)?.value,
        80,
      ) / 100;

    return {
      ...ENC.normalizeAudioTrack(
        {
          ...existing,
          name,
          asset,
          volume,
          loop: false,
        },
        { name, volume: 0.8 },
      ),
      loop: false,
    };
  },

  renderCombatantSummary(template) {
    const container = this.el("encounterSetupCombatants");
    if (!container) return;

    container.innerHTML = "";
    const combatants = Array.isArray(template?.combatants)
      ? template.combatants
      : [];

    if (!combatants.length) {
      const empty = document.createElement("span");
      empty.className = "hint";
      empty.textContent = "No combatants saved in this template.";
      container.appendChild(empty);
      return;
    }

    for (const combatant of combatants) {
      const chip = document.createElement("span");
      chip.className = "encounter-setup-combatant-chip";

      const label = document.createElement("span");
      const type = ENC.libraryUI?.typeLabel?.(combatant.type) ||
        combatant.type ||
        "Combatant";
      label.textContent = `${combatant.name || "Unnamed"} · ${type}`;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "encounter-setup-combatant-remove";
      remove.textContent = "×";
      remove.title = `Remove ${combatant.name || "combatant"} from template`;
      remove.setAttribute("aria-label", remove.title);
      remove.addEventListener("click", () =>
        this.removeTemplateCombatant(combatant.id),
      );

      chip.append(label, remove);
      container.appendChild(chip);
    }
  },

  async refreshLibraryCombatantSelect(template = null) {
    const select = this.el("encounterSetupLibraryCombatant");
    if (!select) return;

    let entries = ENC.libraryUI?.entries;
    if (!Array.isArray(entries) || !entries.length) {
      entries = await ENC.db.getAll("library");
    }

    const systemId = template?.systemId || "";
    const eligible = (entries || [])
      .map((entry) => ENC.normalizeLibraryEntry(entry))
      .filter((entry) => !systemId || entry.systemId === systemId)
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    const previous = select.value;
    select.innerHTML = '<option value="">Choose Library character or creature…</option>';

    for (const entry of eligible) {
      const option = document.createElement("option");
      option.value = entry.id;
      const type = ENC.libraryUI?.typeLabel?.(entry.type) || entry.type || "Combatant";
      option.textContent = `${entry.name} — ${type}`;
      select.appendChild(option);
    }

    if ([...select.options].some((option) => option.value === previous)) {
      select.value = previous;
    }
  },

  async addLibraryCombatant() {
    if (!this.templateId) {
      return ENC.app.toast("Create or select a reusable encounter first.");
    }

    const libraryId = this.el("encounterSetupLibraryCombatant")?.value || "";
    if (!libraryId) {
      return ENC.app.toast("Choose a Library character or creature first.");
    }

    const libraryEntry =
      ENC.libraryUI?.entries?.find?.((entry) => String(entry.id) === String(libraryId)) ||
      (await ENC.db.get("library", libraryId));

    if (!libraryEntry) {
      return ENC.app.toast("The selected Library entry could not be found.");
    }

    const template = (ENC.encounterUI?.saved || []).find(
      (item) => item.id === this.templateId && item.saveMode !== "state",
    );
    if (!template) {
      return ENC.app.toast("The reusable encounter template could not be found.");
    }

    if (libraryEntry.systemId !== template.systemId) {
      return ENC.app.toast("Choose a Library entry that uses the same game system as this encounter.");
    }

    const updated = ENC.deepClone(template);
    const combatant = ENC.normalizeCombatant(
      ENC.resetCombatantTransientState({
        ...ENC.deepClone(libraryEntry),
        id: ENC.makeId("cmb"),
        sourceLibraryId: libraryEntry.id,
        initiative: 10,
        hp: libraryEntry.maxHp ?? "",
        hidden: false,
        createdOrder: Date.now() + Math.random(),
      }),
      libraryEntry.systemId,
      libraryEntry.customProfile,
    );

    updated.combatants = Array.isArray(updated.combatants)
      ? [...updated.combatants, combatant]
      : [combatant];

    const saved = await ENC.db.saveEncounterTemplate(
      updated,
      updated.name,
      updated.id,
    );

    await ENC.encounterUI.refreshSaved();
    const select = this.el("savedTemplateSelect");
    if (select) select.value = saved.id;
    this.templateId = saved.id;
    this.renderTemplate(saved);
    this.setSaveStatus(`${libraryEntry.name} added to template ✓`, "saved");
    ENC.app.toast(`${libraryEntry.name} added to ${saved.name}.`);
  },

  async removeTemplateCombatant(combatantId) {
    if (!this.templateId || !combatantId) return;

    const template = (ENC.encounterUI?.saved || []).find(
      (item) => item.id === this.templateId && item.saveMode !== "state",
    );
    if (!template) return;

    const target = (template.combatants || []).find(
      (combatant) => combatant.id === combatantId,
    );
    if (!target) return;

    if (!confirm(`Remove ${target.name || "this combatant"} from the reusable encounter?`)) {
      return;
    }

    const updated = ENC.deepClone(template);
    updated.combatants = (updated.combatants || []).filter(
      (combatant) => combatant.id !== combatantId,
    );

    const saved = await ENC.db.saveEncounterTemplate(
      updated,
      updated.name,
      updated.id,
    );

    await ENC.encounterUI.refreshSaved();
    const select = this.el("savedTemplateSelect");
    if (select) select.value = saved.id;
    this.templateId = saved.id;
    this.renderTemplate(saved);
    this.setSaveStatus(`${target.name || "Combatant"} removed from template ✓`, "saved");
  },

  renderTemplate(template) {
    const editor = this.el("encounterSetupEditor");
    if (!editor || !template) return;

    const soundscape = ENC.normalizeSoundscape(template.soundscape);
    this.refreshMediaSelects(template);
    this.refreshLibraryCombatantSelect(template);

    this.el("encounterSetupName").textContent = template.name || "Template";
    const templateNameInput = this.el("encounterSetupTemplateName");
    if (templateNameInput) templateNameInput.value = template.name || "Template";
    this.el("encounterSetupSystem").textContent = ENC.getSystemLabel(
      template.systemId,
      template.customProfile,
    );
    this.renderCombatantSummary(template);
    this.el("encounterSetupPrompt")?.classList.add("hidden");

    const sceneImage =
      template.display?.sceneImage || template.background || "";
    const combatImage =
      template.display?.combatImage || template.background || "";

    const sceneSelect = this.el("encounterSetupSceneBackground");
    const combatSelect = this.el("encounterSetupCombatBackground");
    if (sceneSelect) sceneSelect.value = sceneImage;
    if (combatSelect) combatSelect.value = combatImage;

    this.renderBackgroundPreview(
      this.el("encounterSetupScenePreview"),
      sceneImage,
      "Default Scene screen will show the encounter title.",
    );
    this.renderBackgroundPreview(
      this.el("encounterSetupCombatPreview"),
      combatImage,
      "No combat background selected.",
    );

    this.el("encounterSetupMasterVolume").value = Math.round(
      soundscape.masterVolume * 100,
    );
    this.el("encounterSetupFadeSeconds").value = soundscape.fadeMs / 1000;
    this.el("encounterSetupAutoCombat").checked =
      soundscape.autoSwitchToCombat;
    this.el("encounterSetupReturnScene").checked =
      soundscape.returnToSceneAfterCombat;

    this.setTrack(
      "encounterSetupSceneMusic",
      soundscape.scene.music,
      {
        name: "Scene Music",
        volume: 0.35,
        combatBehavior: "stop",
      },
    );

    [1, 2, 3].forEach((index) => {
      this.setTrack(
        `encounterSetupSceneAmb${index}`,
        soundscape.scene.ambience[index - 1] || {},
        {
          name: `Scene Ambience ${index}`,
          volume: 0.4,
          combatBehavior: "duck",
          combatVolume: 0.15,
        },
      );
    });

    this.setTrack(
      "encounterSetupCombatMusic",
      soundscape.combat.music,
      {
        name: "Combat Music",
        volume: 0.65,
        combatBehavior: "continue",
      },
    );

    [1, 2].forEach((index) => {
      this.setTrack(
        `encounterSetupCombatAmb${index}`,
        soundscape.combat.ambience[index - 1] || {},
        {
          name: `Combat Ambience ${index}`,
          volume: 0.35,
          combatBehavior: "continue",
        },
      );
    });

    [1, 2, 3].forEach((index) => {
      this.setCue(index, soundscape.cues[index - 1] || {});
    });

    editor.classList.remove("hidden");
    this.setSaveStatus("Saved setup loaded", "saved");
  },

  syncFromSelection() {
    const id = this.el("savedTemplateSelect")?.value || "";
    const editor = this.el("encounterSetupEditor");
    const prompt = this.el("encounterSetupPrompt");

    if (!id) {
      this.templateId = null;
      editor?.classList.add("hidden");
      prompt?.classList.remove("hidden");
      return;
    }

    const template = (ENC.encounterUI?.saved || []).find(
      (item) => item.id === id && item.saveMode !== "state",
    );

    if (!template) {
      this.templateId = null;
      editor?.classList.add("hidden");
      prompt?.classList.remove("hidden");
      return;
    }

    this.templateId = template.id;
    this.renderTemplate(template);
  },

  collectSoundscape(template) {
    const current = ENC.normalizeSoundscape(template.soundscape);

    const sceneAmbience = [1, 2, 3]
      .map((index) =>
        this.readTrack(
          `encounterSetupSceneAmb${index}`,
          current.scene.ambience[index - 1] || {},
          {
            name: `Scene Ambience ${index}`,
            volume: 0.4,
            combatBehavior: "duck",
            combatVolume: 0.15,
          },
        ),
      )
      .filter((track) => track.asset);

    const combatAmbience = [1, 2]
      .map((index) =>
        this.readTrack(
          `encounterSetupCombatAmb${index}`,
          current.combat.ambience[index - 1] || {},
          {
            name: `Combat Ambience ${index}`,
            volume: 0.35,
            combatBehavior: "continue",
          },
        ),
      )
      .filter((track) => track.asset);

    const cues = [1, 2, 3]
      .map((index) => this.readCue(index, current.cues[index - 1] || {}))
      .filter((cue) => cue.asset);

    return ENC.normalizeSoundscape({
      ...current,
      enabled: true,
      masterVolume:
        this.percent(this.el("encounterSetupMasterVolume")?.value, 80) / 100,
      fadeMs:
        Math.max(
          0,
          Number(this.el("encounterSetupFadeSeconds")?.value || 2.5),
        ) * 1000,
      autoSwitchToCombat:
        this.el("encounterSetupAutoCombat")?.checked !== false,
      returnToSceneAfterCombat:
        this.el("encounterSetupReturnScene")?.checked !== false,
      scene: {
        music: this.readTrack(
          "encounterSetupSceneMusic",
          current.scene.music,
          {
            name: "Scene Music",
            volume: 0.35,
            combatBehavior: "stop",
          },
        ),
        ambience: sceneAmbience,
      },
      combat: {
        music: this.readTrack(
          "encounterSetupCombatMusic",
          current.combat.music,
          {
            name: "Combat Music",
            volume: 0.65,
            combatBehavior: "continue",
          },
        ),
        ambience: combatAmbience,
      },
      cues,
    });
  },

  validateSelectedMedia(sceneImage, combatImage, soundscape) {
    const checks = [
      ["Scene background", sceneImage, ENC.sanitizeAssetUrl],
      ["Combat background", combatImage, ENC.sanitizeAssetUrl],
      ["Scene music", this.el("encounterSetupSceneMusic")?.value || "", ENC.sanitizeAudioUrl],
      ["Combat music", this.el("encounterSetupCombatMusic")?.value || "", ENC.sanitizeAudioUrl],
      ["Scene ambience", this.el("encounterSetupSceneAmb1")?.value || "", ENC.sanitizeAudioUrl],
      ["Combat ambience", this.el("encounterSetupCombatAmb1")?.value || "", ENC.sanitizeAudioUrl],
    ];

    for (const [label, raw, sanitizer] of checks) {
      if (raw && !sanitizer(raw)) {
        throw new Error(`${label} is not a valid local enCounter asset. Refresh Assets and select it again.`);
      }
    }

    const expectedSceneMusic = ENC.sanitizeAudioUrl(this.el("encounterSetupSceneMusic")?.value || "");
    const expectedCombatMusic = ENC.sanitizeAudioUrl(this.el("encounterSetupCombatMusic")?.value || "");
    if (expectedSceneMusic && soundscape.scene.music.asset !== expectedSceneMusic) {
      throw new Error("Scene music could not be prepared. Refresh Assets and select the file again.");
    }
    if (expectedCombatMusic && soundscape.combat.music.asset !== expectedCombatMusic) {
      throw new Error("Combat music could not be prepared. Refresh Assets and select the file again.");
    }
  },

  verifyPersistedMedia(verified, expected) {
    const actual = ENC.normalizeEncounter(verified);
    const failures = [];
    if ((actual.display?.sceneImage || "") !== expected.sceneImage) failures.push("Scene background");
    if ((actual.display?.combatImage || "") !== expected.combatImage) failures.push("Combat background");
    if ((actual.soundscape?.scene?.music?.asset || "") !== expected.sceneMusic) failures.push("Scene music");
    if ((actual.soundscape?.combat?.music?.asset || "") !== expected.combatMusic) failures.push("Combat music");
    if (failures.length) {
      throw new Error(`Save verification failed for: ${failures.join(", ")}.`);
    }
    return actual;
  },

  summarizePreparedMedia(encounter) {
    const parts = [];
    if (encounter.display?.sceneImage) parts.push("Scene background ✓");
    if (encounter.soundscape?.scene?.music?.asset) parts.push("Scene music ✓");
    if (encounter.soundscape?.scene?.ambience?.some?.((track) => track.asset)) parts.push("Scene ambience ✓");
    if (encounter.display?.combatImage) parts.push("Combat background ✓");
    if (encounter.soundscape?.combat?.music?.asset) parts.push("Combat music ✓");
    if (encounter.soundscape?.combat?.ambience?.some?.((track) => track.asset)) parts.push("Combat ambience ✓");
    return parts.length ? parts.join(" · ") : "No media configured";
  },

  async save() {
    if (!this.templateId) {
      this.setSaveStatus("Select a reusable encounter template first.", "error");
      return ENC.app.toast("Select a reusable encounter template first.");
    }

    const template = (ENC.encounterUI?.saved || []).find(
      (item) => item.id === this.templateId && item.saveMode !== "state",
    );

    if (!template) {
      this.setSaveStatus("Template could not be found.", "error");
      return ENC.app.toast("The reusable encounter template could not be found.");
    }

    const sceneImage =
      this.el("encounterSetupSceneBackground")?.value || "";
    const combatImage =
      this.el("encounterSetupCombatBackground")?.value || "";

    const requestedName =
      this.el("encounterSetupTemplateName")?.value.trim() || "";
    if (!requestedName) {
      this.setSaveStatus("Enter an encounter name before saving.", "error");
      return ENC.app.toast("Enter an encounter name before saving.");
    }

    const saveButton = this.el("encounterSetupSaveBtn");
    if (saveButton) saveButton.disabled = true;
    this.setSaveStatus("Saving encounter setup…", "saving");

    try {
      const updated = ENC.deepClone(template);
      const preparedSoundscape = this.collectSoundscape(template);
      this.validateSelectedMedia(sceneImage, combatImage, preparedSoundscape);

      const safeSceneImage = ENC.sanitizeAssetUrl(sceneImage);
      const safeCombatImage = ENC.sanitizeAssetUrl(combatImage);
      const expected = {
        sceneImage: safeSceneImage,
        combatImage: safeCombatImage,
        sceneMusic: ENC.sanitizeAudioUrl(this.el("encounterSetupSceneMusic")?.value || ""),
        combatMusic: ENC.sanitizeAudioUrl(this.el("encounterSetupCombatMusic")?.value || ""),
      };

      updated.name = requestedName;
      updated.presentation = {
        schemaVersion: 1,
        sceneBackground: safeSceneImage,
        combatBackground: safeCombatImage,
        soundscape: ENC.deepClone(preparedSoundscape),
      };
      updated.display = {
        ...(updated.display || {}),
        sceneImage: safeSceneImage,
        combatImage: safeCombatImage,
      };
      updated.background = safeCombatImage;
      updated.soundscape = ENC.deepClone(preparedSoundscape);

      const saved = await ENC.db.saveEncounterTemplate(
        updated,
        updated.name,
        updated.id,
      );

      // Read the record back and compare the actual media selections before
      // reporting success. A sanitizer or stale module can no longer silently
      // strip a selected background/audio file while still showing Saved.
      const persisted = await ENC.db.get("encounters", saved.id);
      if (!persisted) {
        throw new Error("The saved encounter could not be verified in storage.");
      }
      const verified = this.verifyPersistedMedia(persisted, expected);

      this.templateId = verified.id;
      await ENC.encounterUI.refreshSaved();

      const select = this.el("savedTemplateSelect");
      if (select) select.value = verified.id;

      this.renderTemplate(verified);
      const syncedActive = await this.syncLoadedEncounterPresentation(verified);
      const savedAt = this.formatSavedTime();
      const summary = this.summarizePreparedMedia(verified);
      this.setSaveStatus(
        syncedActive
          ? `Saved ${savedAt} ✓ · ${summary} · Updated the currently loaded encounter`
          : `Saved ${savedAt} ✓ · ${summary} · Load this template to play`,
        "saved",
      );
      if (saveButton) saveButton.textContent = "Saved ✓";
      window.setTimeout(() => {
        if (saveButton) saveButton.textContent = "Save Encounter Setup";
      }, 1800);
      ENC.app.toast(
        syncedActive
          ? "Encounter setup saved and applied to the currently loaded encounter."
          : "Encounter setup saved and verified. Load this template when you are ready to play it.",
      );
    } catch (error) {
      console.error("Could not save encounter setup", error);
      this.setSaveStatus("Save failed · Your changes were not confirmed", "error");
      ENC.app.toast(error.message || "Encounter setup could not be saved.");
    } finally {
      if (saveButton) saveButton.disabled = false;
    }
  },

  bind() {
    this.el("savedTemplateSelect")?.addEventListener("change", () =>
      this.syncFromSelection(),
    );

    this.el("encounterSetupSaveBtn")?.addEventListener("click", () =>
      this.save(),
    );

    this.el("encounterSetupAddCombatantBtn")?.addEventListener("click", () =>
      this.addLibraryCombatant(),
    );

    this.el("encounterSetupManageAssetsBtn")?.addEventListener("click", () =>
      ENC.dmWorkspace?.open?.("assets"),
    );

    this.el("encounterSetupSceneBackground")?.addEventListener(
      "change",
      (event) => {
        this.renderBackgroundPreview(
          this.el("encounterSetupScenePreview"),
          event.target.value,
          "Default Scene screen will show the encounter title.",
        );
      },
    );

    this.el("encounterSetupCombatBackground")?.addEventListener(
      "change",
      (event) => {
        this.renderBackgroundPreview(
          this.el("encounterSetupCombatPreview"),
          event.target.value,
          "No combat background selected.",
        );
      },
    );

    const editor = this.el("encounterSetupEditor");
    editor?.addEventListener("input", (event) => {
      if (event.target?.id === "encounterSetupSaveBtn") return;
      this.markDirty();
    });
    editor?.addEventListener("change", (event) => {
      if (event.target?.id === "encounterSetupSaveBtn") return;
      this.markDirty();
    });
  },

  initialize() {
    this.bind();
    this.syncFromSelection();
  },
};
