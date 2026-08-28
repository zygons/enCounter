/*
 * Copyright (C) 2026 enCounter contributors
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

ENC.app = {
  toastTimer: null,

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
      encounter:
        includeEncounter && ENC.combat?.encounter
          ? ENC.deepClone(ENC.combat.encounter)
          : null,
    });
  },


  bindAppControls() {
    const exitButton = document.getElementById("exitAppBtn");
    if (!exitButton) return;

    exitButton.addEventListener("click", async () => {
      if (!confirm("Exit enCounter? The local server will stop after the latest backup attempt.")) return;
      exitButton.disabled = true;
      try {
        await ENC.backup.writeExternalBackup();
        const response = await fetch("/api/shutdown", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (!response.ok) throw new Error(await response.text());
        this.toast("enCounter stopped. You can close this browser tab.");
        document.body.classList.add("app-stopped");
      } catch (error) {
        console.error(error);
        exitButton.disabled = false;
        this.toast("Unable to stop enCounter from this session.");
      }
    });
  },

  bindNavigation() {
    for (const button of document.querySelectorAll(".nav-button")) {
      button.addEventListener("click", () => {
        for (const nav of document.querySelectorAll(".nav-button"))
          nav.classList.remove("active");
        for (const section of document.querySelectorAll(".app-section"))
          section.classList.remove("active-section");
        button.classList.add("active");
        document
          .getElementById(button.dataset.section)
          .classList.add("active-section");
      });
    }
  },

  async chooseStartupEncounter() {
    const savedEncounter = await ENC.db.get("encounters", "active");
    if (!ENC.isMeaningfulEncounter(savedEncounter)) return "new";

    const modal = document.getElementById("startupEncounterModal");
    const summary = document.getElementById("startupEncounterSummary");
    const resumeButton = document.getElementById("resumeEncounterBtn");
    const newButton = document.getElementById("startupNewEncounterBtn");

    if (!modal || !summary || !resumeButton || !newButton) return "resume";

    const combatantCount = (savedEncounter.combatants || []).length;
    const updated = savedEncounter.updatedAt
      ? new Date(savedEncounter.updatedAt).toLocaleString()
      : "Unknown";

    summary.textContent = `${savedEncounter.name || "Encounter"} • Round ${savedEncounter.round || 1} • ${combatantCount} combatant${combatantCount === 1 ? "" : "s"} • Last saved ${updated}`;
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
    if (choice !== "new") return;

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
            <p><strong>Persistent storage:</strong> ${status.persisted ? "Enabled" : "Not yet granted"}</p>
            <p><strong>Browser storage used:</strong> ${mb(status.usage)}</p>
            <p><strong>Estimated quota:</strong> ${mb(status.quota)}</p>
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
      text.textContent = `${new Date(snapshot.createdAt).toLocaleString()} — ${snapshot.reason} — Round ${encounter.round || 1}`;
      const restore = document.createElement("button");
      restore.textContent = "Restore";
      restore.addEventListener("click", async () => {
        if (
          !confirm(
            "Restore this encounter snapshot? Permanent library data is not changed.",
          )
        )
          return;
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
        if (!file) return this.toast("Choose a JSON backup first.");
        if (
          !confirm(
            "Import this enCounter backup? Full backups replace current app data, Library backups replace the Library, and single-entry imports add or update one Library entry.",
          )
        )
          return;
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
        )
          return;
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
        if (!file) return this.toast("Choose an image first.");
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
    ENC.assets.fillSelect(
      document.getElementById("backgroundSelect"),
      "backgrounds/",
      ENC.combat.encounter?.background || "",
    );
    ENC.libraryUI.fillPortraitSelect(
      document.getElementById("libraryPortraitSelect").value,
    );
    ENC.assets.renderGrid(
      document.getElementById("assetGrid"),
      document.getElementById("assetFilter").value,
    );
  },

  bindCustomSystem() {
    const settings = ENC.settingsUI.settings;
    document.getElementById("customSystemName").value =
      settings.customProfile.name;
    for (let i = 0; i < 4; i++)
      document.getElementById(`customStat${i + 1}`).value =
        settings.customProfile.labels[i] || `Stat ${i + 1}`;
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
    ENC.combat.render();
    await ENC.assets.refresh();
    this.refreshAssetUI();
    await this.renderSnapshots();
    await this.refreshStorageStatus();
  },

  async start() {
    // ========================================
    // Display enCounter version
    // ========================================

    const versionElement = document.getElementById("appVersion");

    if (versionElement) {
      versionElement.textContent = `${ENC.APP_STAGE.toUpperCase()} · v${ENC.APP_VERSION}`;
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

    this.bindNavigation();
    this.bindAppControls();
    ENC.libraryUI.bind();
    ENC.combat.bind();
    this.bindDataTools();
    this.bindAssetTools();
    this.bindCustomSystem();

    ENC.libraryUI.resetForm();
    ENC.libraryUI.render();
    ENC.combat.render();
    this.refreshAssetUI();
    await this.renderSnapshots();
    await this.refreshStorageStatus();

    ENC.sync.onMessage(async (message) => {
      if (message.type === "display-hello") {
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
