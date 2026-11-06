/*
 * Copyright (C) 2026 Zygons
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

ENC.migration = {
  META_KEY: "upgrade-state",

  movedItems: Object.freeze([
    ["Library", "DM > Characters"],
    ["Assets", "DM > Assets"],
    ["Saved Encounters", "DM > Encounters"],
    ["Data / Recovery", "DM > Data & Tools"],
    ["Encounter", "Encounter (unchanged)"],
    ["Soundscape", "Soundscape (unchanged)"],
    ["Timer", "Timer (unchanged)"],
    ["Settings", "Settings (unchanged)"],
  ]),

  async inspectInstallation() {
    const [library, encounters, snapshots] = await Promise.all([
      ENC.db.getAll("library"),
      ENC.db.getAll("encounters"),
      ENC.db.getAll("snapshots"),
    ]);

    const saved = encounters.filter((item) => item?.kind === "saved");
    const presets = encounters.filter((item) => item?.kind === "preset");
    const active = encounters.find((item) => item?.id === "active") || null;
    const meaningfulActive = ENC.isMeaningfulEncounter(active);

    const counts = {
      library: library.length,
      players: library.filter((item) => item?.type === "player").length,
      npcs: library.filter((item) => item?.type === "npc").length,
      enemies: library.filter(
        (item) => item?.type === "enemy" || item?.type === "creature",
      ).length,
      templates: saved.filter((item) => item?.saveMode !== "state").length,
      states: saved.filter((item) => item?.saveMode === "state").length,
      presets: presets.length,
      snapshots: snapshots.length,
      activeEncounter: meaningfulActive ? 1 : 0,
    };

    return {
      counts,
      hasExistingData: Boolean(
        counts.library ||
          counts.templates ||
          counts.states ||
          counts.presets ||
          counts.snapshots ||
          counts.activeEncounter,
      ),
    };
  },

  async getState() {
    return ENC.db.getMetaRecord(this.META_KEY);
  },

  shouldOfferUpgrade(inspection, state) {
    if (!inspection?.hasExistingData) return false;

    const completedGeneration = Number(state?.uiGeneration || 0);
    return completedGeneration < Number(ENC.UI_GENERATION || 1);
  },

  buildState(previous = {}, overrides = {}) {
    const now = new Date().toISOString();

    return {
      ...(previous || {}),
      key: this.META_KEY,
      flowVersion: ENC.UPGRADE_FLOW_VERSION,
      uiGeneration: ENC.UI_GENERATION,
      lastSeenAppVersion: ENC.APP_VERSION,
      acknowledgedAt: previous?.acknowledgedAt || null,
      backupAt: previous?.backupAt || null,
      ...overrides,
      updatedAt: now,
    };
  },

  async saveState(overrides = {}) {
    const previous = (await this.getState()) || {};
    return ENC.db.saveMetaRecord(
      this.META_KEY,
      this.buildState(previous, overrides),
    );
  },

  renderCounts(inspection) {
    const counts = inspection?.counts || {};
    const values = {
      upgradeCountLibrary: counts.library || 0,
      upgradeCountTemplates: counts.templates || 0,
      upgradeCountStates: counts.states || 0,
      upgradeCountPresets: counts.presets || 0,
      upgradeCountSnapshots: counts.snapshots || 0,
    };

    for (const [id, value] of Object.entries(values)) {
      const element = document.getElementById(id);
      if (element) element.textContent = String(value);
    }
  },

  renderMovedItems() {
    const container = document.getElementById("upgradeMovedList");
    if (!container) return;

    container.innerHTML = "";

    for (const [from, to] of this.movedItems) {
      const row = document.createElement("div");
      row.className = "upgrade-moved-row";

      const oldLocation = document.createElement("span");
      oldLocation.textContent = from;

      const arrow = document.createElement("span");
      arrow.className = "upgrade-moved-arrow";
      arrow.textContent = "→";

      const newLocation = document.createElement("strong");
      newLocation.textContent = to;

      row.append(oldLocation, arrow, newLocation);
      container.appendChild(row);
    }
  },

  async showAssistant(inspection, options = {}) {
    const modal = document.getElementById("upgradeAssistantModal");
    const continueButton = document.getElementById("upgradeContinueBtn");
    const backupButton = document.getElementById("upgradeBackupBtn");
    const reviewButton = document.getElementById("upgradeReviewBtn");
    const details = document.getElementById("upgradeMovedDetails");
    const status = document.getElementById("upgradeBackupStatus");
    const previewNotice = document.getElementById("upgradePreviewNotice");

    if (!modal || !continueButton || !backupButton || !reviewButton) {
      return;
    }

    const persist = options.persist !== false;
    this.renderCounts(inspection);
    this.renderMovedItems();

    if (previewNotice) {
      previewNotice.classList.toggle("hidden", persist);
    }

    if (details) details.classList.add("hidden");
    if (status) status.textContent = "";
    reviewButton.textContent = "Review Planned Changes";

    reviewButton.onclick = () => {
      if (!details) return;
      const isHidden = details.classList.toggle("hidden");
      reviewButton.textContent = isHidden
        ? "Review Planned Changes"
        : "Hide Planned Changes";
    };

    backupButton.onclick = async () => {
      backupButton.disabled = true;
      if (status) status.textContent = "Creating backup…";

      try {
        await ENC.backup.exportEverything();
        if (status) status.textContent = "Backup export created.";
        if (persist) {
          await this.saveState({ backupAt: new Date().toISOString() });
        }
      } catch (error) {
        console.error(error);
        if (status) {
          status.textContent = error.message || "Backup could not be created.";
        }
      } finally {
        backupButton.disabled = false;
      }
    };

    modal.classList.remove("hidden");
    continueButton.focus();

    await new Promise((resolve) => {
      continueButton.onclick = async () => {
        if (persist) {
          await this.saveState({
            acknowledgedAt: new Date().toISOString(),
          });
        }
        modal.classList.add("hidden");
        resolve();
      };
    });
  },

  async initialize() {
    const query = new URLSearchParams(window.location.search || "");
    const preview = query.get("upgradePreview") === "1";
    const autoStart = ENC.UPGRADE_ASSISTANT_AUTO_START === true;

    if (!preview && !autoStart) {
      return { shown: false, reason: "disabled" };
    }

    const inspection = await this.inspectInstallation();
    const state = await this.getState();

    if (preview) {
      await this.showAssistant(inspection, { persist: false });
      return { shown: true, preview: true, inspection };
    }

    if (!inspection.hasExistingData) {
      if (!state) {
        await this.saveState({
          acknowledgedAt: new Date().toISOString(),
          newInstall: true,
        });
      }
      return { shown: false, reason: "new-install", inspection };
    }

    if (!this.shouldOfferUpgrade(inspection, state)) {
      return { shown: false, reason: "already-acknowledged", inspection };
    }

    await this.showAssistant(inspection, { persist: true });
    return { shown: true, preview: false, inspection };
  },
};
