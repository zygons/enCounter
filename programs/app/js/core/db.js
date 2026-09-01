/*
 * Copyright (C) 2026 Zygons
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

ENC.db = {
  connection: null,

  async open() {
    if (this.connection) return this.connection;

    this.connection = await new Promise((resolve, reject) => {
      const request = indexedDB.open(ENC.DB_NAME, ENC.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains("library")) {
          const store = db.createObjectStore("library", { keyPath: "id" });
          store.createIndex("type", "type", { unique: false });
          store.createIndex("systemId", "systemId", { unique: false });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }

        if (!db.objectStoreNames.contains("encounters")) {
          const store = db.createObjectStore("encounters", { keyPath: "id" });
          store.createIndex("kind", "kind", { unique: false });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }

        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }

        if (!db.objectStoreNames.contains("snapshots")) {
          const store = db.createObjectStore("snapshots", {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }

        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          if (this.connection === db) this.connection = null;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error || new Error("Unable to open enCounter storage."));
      request.onblocked = () => reject(new Error("enCounter storage upgrade is blocked by another open window."));
    });

    return this.connection;
  },

  async put(storeName, value) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const request = tx.objectStore(storeName).put(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error(`Unable to save ${storeName}.`));
    });
  },

  async get(storeName, key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error(`Unable to read ${storeName}.`));
    });
  },

  async getAll(storeName) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error(`Unable to read ${storeName}.`));
    });
  },

  async delete(storeName, key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const request = tx.objectStore(storeName).delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error(`Unable to delete from ${storeName}.`));
    });
  },

  async clear(storeName) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const request = tx.objectStore(storeName).clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error(`Unable to clear ${storeName}.`));
    });
  },

  async getSettings() {
    const stored = await this.get("settings", "app-settings");
    return ENC.normalizeSettings(stored || ENC.DEFAULT_SETTINGS);
  },

  async saveSettings(settings) {
    return this.put("settings", ENC.normalizeSettings(settings));
  },

  async getActiveEncounter() {
    const encounter = await this.get("encounters", "active");
    if (!encounter) return ENC.createDefaultEncounter();
    const normalized = ENC.normalizeEncounter(encounter);
    normalized.id = "active";
    normalized.kind = "active";
    return normalized;
  },

  async saveActiveEncounter(encounter) {
    const normalized = ENC.normalizeEncounter(encounter);
    normalized.id = "active";
    normalized.kind = "active";
    normalized.updatedAt = new Date().toISOString();
    return this.put("encounters", ENC.deepClone(normalized));
  },

  async savePreset(encounter, name) {
    const preset = ENC.normalizeEncounter({
      ...ENC.deepClone(encounter),
      id: ENC.makeId("preset"),
      kind: "preset",
      name,
      currentId: null,
      round: 1,
      updatedAt: new Date().toISOString(),
      combatants: (encounter.combatants || []).map((combatant) => ({
        ...combatant,
        id: ENC.makeId("cmb"),
        initiative: 10,
        hp: combatant.maxHp ?? combatant.hp ?? "",
        conditionTrack: "Normal",
        visibleStatus: "",
        combatState: "active",
        hidden: false,
        delayed: false,
        ready: false,
        createdOrder: Date.now() + Math.random(),
      })),
    });
    await this.put("encounters", preset);
    return preset;
  },

  async getPresets() {
    const all = await this.getAll("encounters");
    return all
      .filter((item) => item?.kind === "preset")
      .map((item) => ENC.normalizeEncounter(item))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  },

  async addSnapshot(encounter, reason = "autosave", limit = 20) {
    const db = await this.open();
    const normalizedEncounter = ENC.normalizeEncounter(encounter);
    const safeLimit = Math.min(100, Math.max(1, Math.trunc(ENC.finiteNumber(limit, 20))));

    await new Promise((resolve, reject) => {
      const tx = db.transaction("snapshots", "readwrite");
      const request = tx.objectStore("snapshots").add({
        createdAt: new Date().toISOString(),
        reason: String(reason || "autosave"),
        encounter: ENC.deepClone(normalizedEncounter),
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error("Unable to save recovery snapshot."));
    });

    const snapshots = await this.getAll("snapshots");
    snapshots.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    while (snapshots.length > safeLimit) {
      const oldest = snapshots.shift();
      await this.delete("snapshots", oldest.id);
    }
  },

  async exportDatabase(includeSnapshots = false) {
    const payload = {
      app: ENC.APP_NAME,
      appVersion: ENC.APP_VERSION,
      schemaVersion: ENC.DB_VERSION,
      exportType: "full",
      exportedAt: new Date().toISOString(),
      library: await this.getAll("library"),
      encounters: await this.getAll("encounters"),
      settings: await this.getAll("settings"),
      meta: await this.getAll("meta"),
    };
    if (includeSnapshots) payload.snapshots = await this.getAll("snapshots");
    return payload;
  },

  validateBackupPayload(payload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("This is not a valid enCounter backup.");
    }
    if (payload.app !== ENC.APP_NAME) {
      throw new Error("This backup was not created by enCounter.");
    }

    const schemaVersion = Number(payload.schemaVersion);
    if (Number.isFinite(schemaVersion) && schemaVersion > ENC.DB_VERSION) {
      throw new Error(
        `This backup uses database schema ${schemaVersion}, but this enCounter build supports schema ${ENC.DB_VERSION}. Update enCounter before importing it.`,
      );
    }

    for (const key of ["library", "encounters", "settings", "meta", "snapshots"]) {
      if (payload[key] !== undefined && !Array.isArray(payload[key])) {
        throw new Error(`Backup field “${key}” is invalid.`);
      }
    }

    if (!Array.isArray(payload.library)) {
      throw new Error("This backup does not contain a valid Library collection.");
    }
  },

  async importLibrary(entries, replace = true) {
    if (!Array.isArray(entries)) throw new Error("Library import data is invalid.");
    const normalizedEntries = entries.map((entry) => ENC.normalizeLibraryEntry(entry));
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const tx = db.transaction("library", "readwrite");
      const store = tx.objectStore("library");
      if (replace) store.clear();
      for (const entry of normalizedEntries) store.put(entry);
      tx.oncomplete = () => resolve(normalizedEntries.length);
      tx.onerror = () => reject(tx.error || new Error("Library import failed."));
      tx.onabort = () => reject(tx.error || new Error("Library import was aborted."));
    });
  },

  async importDatabase(payload, replace = true) {
    this.validateBackupPayload(payload);

    const normalizedLibrary = (payload.library || []).map((entry) => ENC.normalizeLibraryEntry(entry));
    const normalizedEncounters = (payload.encounters || []).map((encounter) => ENC.normalizeEncounter(encounter));
    const normalizedSettings = (payload.settings || []).map((settings) => ENC.normalizeSettings(settings));
    const normalizedMeta = (payload.meta || []).filter(
      (item) => item && typeof item === "object" && !Array.isArray(item) && item.key !== undefined,
    );
    const normalizedSnapshots = (payload.snapshots || []).map((snapshot) => ({
      createdAt: String(snapshot?.createdAt || new Date().toISOString()),
      reason: String(snapshot?.reason || "imported snapshot"),
      encounter: ENC.normalizeEncounter(snapshot?.encounter || {}),
    }));

    const db = await this.open();
    const stores = ["library", "encounters", "settings", "meta", "snapshots"];

    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, "readwrite");
      const libraryStore = tx.objectStore("library");
      const encounterStore = tx.objectStore("encounters");
      const settingsStore = tx.objectStore("settings");
      const metaStore = tx.objectStore("meta");
      const snapshotStore = tx.objectStore("snapshots");

      if (replace) {
        libraryStore.clear();
        encounterStore.clear();
        settingsStore.clear();
        metaStore.clear();
        snapshotStore.clear();
      }

      for (const entry of normalizedLibrary) libraryStore.put(entry);
      for (const encounter of normalizedEncounters) encounterStore.put(encounter);
      for (const settings of normalizedSettings) settingsStore.put(settings);
      for (const meta of normalizedMeta) metaStore.put(meta);
      for (const snapshot of normalizedSnapshots) snapshotStore.add(snapshot);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Backup import failed."));
      tx.onabort = () => reject(tx.error || new Error("Backup import was aborted."));
    });
  },
};
