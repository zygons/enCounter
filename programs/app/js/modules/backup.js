/*
 * Copyright (C) 2026 enCounter contributors
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

ENC.backup = {
  externalTimer: null,

  safeFilename(value, fallback = "enCounter-export") {
    const cleaned = String(value || "")
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100);
    return cleaned || fallback;
  },

  downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = this.safeFilename(filename, "enCounter-export.json");
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  },

  async exportEverything() {
    // "Everything" includes browser recovery snapshots. Automatic disk backups
    // intentionally remain smaller and omit snapshots.
    const payload = await ENC.db.exportDatabase(true);
    const date = new Date().toISOString().slice(0, 10);
    this.downloadJson(`enCounter-Backup-${date}.json`, payload);
    return payload;
  },

  async exportLibrary() {
    const payload = {
      app: ENC.APP_NAME,
      appVersion: ENC.APP_VERSION,
      schemaVersion: ENC.DB_VERSION,
      exportType: "library",
      exportedAt: new Date().toISOString(),
      library: await ENC.db.getAll("library"),
    };
    const date = new Date().toISOString().slice(0, 10);
    this.downloadJson(`enCounter-Library-${date}.json`, payload);
    return payload;
  },

  validateLibraryPayload(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("This is not a valid enCounter Library backup.");
    }
    if (payload.app !== ENC.APP_NAME) {
      throw new Error("This file was not created by enCounter.");
    }
    const schemaVersion = Number(payload.schemaVersion);
    if (Number.isFinite(schemaVersion) && schemaVersion > ENC.DB_VERSION) {
      throw new Error("This backup was created by a newer enCounter database version.");
    }
    if (!Array.isArray(payload.library)) {
      throw new Error("This file does not contain a valid Library collection.");
    }
  },

  async importFile(file, replace = true) {
    let payload;
    try {
      payload = JSON.parse(await file.text());
    } catch (error) {
      throw new Error("The selected file is not valid JSON.");
    }

    if (payload?.exportType === "library") {
      this.validateLibraryPayload(payload);
      await ENC.db.importLibrary(payload.library, replace);
      return { type: "library", count: payload.library.length };
    }

    if (payload?.exportType === "library-entry") {
      if (payload.app !== ENC.APP_NAME || !payload.entry || typeof payload.entry !== "object") {
        throw new Error("This is not a valid enCounter Library entry export.");
      }
      const schemaVersion = Number(payload.schemaVersion);
      if (Number.isFinite(schemaVersion) && schemaVersion > ENC.DB_VERSION) {
        throw new Error("This Library entry was created by a newer enCounter database version.");
      }
      // A single-entry import never clears the rest of the Library.
      await ENC.db.importLibrary([payload.entry], false);
      return { type: "library entry", count: 1 };
    }

    await ENC.db.importDatabase(payload, replace);
    return { type: "full", count: (payload.library || []).length };
  },

  scheduleExternalBackup() {
    clearTimeout(this.externalTimer);
    this.externalTimer = setTimeout(() => this.writeExternalBackup(), 1200);
  },

  async writeExternalBackup() {
    try {
      const settings = await ENC.db.getSettings();
      if (!settings.externalBackup) return false;
      const payload = await ENC.db.exportDatabase(false);
      const response = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        console.warn("External backup request failed:", await response.text());
      }
      return response.ok;
    } catch (error) {
      console.warn("External backup unavailable", error);
      return false;
    }
  },

  async restoreLatestExternal() {
    const response = await fetch("/api/backup/latest", { cache: "no-store" });
    if (!response.ok) throw new Error("No external backup is available.");
    const payload = await response.json();
    await ENC.db.importDatabase(payload, true);
    return payload;
  },

  async storageStatus() {
    const result = { persisted: false, usage: null, quota: null };
    try {
      if (navigator.storage?.persisted) {
        result.persisted = await navigator.storage.persisted();
      }
      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        result.usage = estimate.usage ?? null;
        result.quota = estimate.quota ?? null;
      }
    } catch (error) {
      console.warn("Storage status unavailable", error);
    }
    return result;
  },

  async requestPersistentStorage() {
    if (!navigator.storage?.persist) return false;
    return navigator.storage.persist();
  },
};
