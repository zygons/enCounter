/*
 * Copyright (C) 2026 Zygons
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

ENC.compendiumProviders = ENC.compendiumProviders || {};

ENC.compendiumProviders.dnd5eApiSrd2014 = {
  id: "dnd5eapi-srd-2014",
  label: "D&D 5E SRD 5.1 (2014)",
  baseUrl: "https://www.dnd5eapi.co",
  indexPath: "/api/2014/monsters",
  proxyIndexPath: "/api/compendium/dnd5e/monsters",
  documentKey: "srd-2014",
  license: "CC BY 4.0",
  sourceLabel: "System Reference Document 5.1",
  _indexCache: null,
  _detailCache: new Map(),
  indexStorageKey: "encounter-dnd5e-srd-monster-index-v2",
  detailStoragePrefix: "encounter-dnd5e-srd-monster-v2:",

  text(value, fallback = "") {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string" || typeof value === "number") return String(value);
    return fallback;
  },

  objectName(value, fallback = "") {
    if (!value) return fallback;
    if (typeof value === "string") return value;
    if (typeof value === "object") return this.text(value.name || value.index || value.key, fallback);
    return fallback;
  },

  formatCr(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return this.text(value, "—");
    const fractions = new Map([
      [0.125, "1/8"],
      [0.25, "1/4"],
      [0.5, "1/2"],
    ]);
    return fractions.get(number) || String(number);
  },

  armorClass(raw = {}) {
    const value = raw.armor_class;
    if (Number.isFinite(Number(value))) return Number(value);
    if (!Array.isArray(value)) return "";
    const values = value
      .map((item) => Number(item?.value ?? item))
      .filter(Number.isFinite);
    return values.length ? Math.max(...values) : "";
  },

  formatSpeed(speed) {
    if (!speed) return "";
    if (typeof speed === "string") return speed;
    if (typeof speed !== "object") return "";
    const ordered = ["walk", "fly", "swim", "climb", "burrow"];
    const parts = [];
    for (const key of ordered) {
      const value = speed[key];
      if (value === null || value === undefined || value === "") continue;
      const label = key === "walk" ? "" : `${key} `;
      parts.push(`${label}${value}`.trim());
    }
    return parts.join(", ");
  },

  formatSenses(senses) {
    if (!senses) return "";
    if (typeof senses === "string") return senses;
    if (typeof senses !== "object") return "";
    return Object.entries(senses)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([key, value]) => {
        if (key === "passive_perception") return `Passive Perception ${value}`;
        const label = key.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
        return `${label} ${value}`;
      })
      .join(", ");
  },

  passivePerception(raw = {}) {
    const direct = Number(raw.senses?.passive_perception);
    if (Number.isFinite(direct)) return direct;
    const perception = (Array.isArray(raw.proficiencies) ? raw.proficiencies : []).find((item) =>
      String(item?.proficiency?.index || "").toLowerCase() === "skill-perception",
    );
    const bonus = Number(perception?.value);
    return Number.isFinite(bonus) ? 10 + bonus : "";
  },

  spellSaveDc(raw = {}) {
    const abilities = Array.isArray(raw.special_abilities) ? raw.special_abilities : [];
    for (const ability of abilities) {
      const direct = Number(ability?.spellcasting?.dc);
      if (Number.isFinite(direct)) return direct;
      const match = String(ability?.desc || "").match(/spell save DC\s*(\d+)/i);
      if (match) return Number(match[1]);
    }
    return "";
  },

  initiativeBonus(raw = {}) {
    const dexterity = Number(raw.dexterity);
    return Number.isFinite(dexterity) ? Math.floor((dexterity - 10) / 2) : 0;
  },

  normalizeFeature(feature, prefix = "") {
    if (!feature || typeof feature !== "object") return null;
    const name = this.text(feature.name, "Ability");
    const description = Array.isArray(feature.desc)
      ? feature.desc.join("\n")
      : this.text(feature.desc || feature.description, "");
    return ENC.normalizeAbility({
      id: ENC.makeId("ability"),
      name: prefix ? `${prefix}: ${name}` : name,
      usesMax: "",
      usesRemaining: "",
      description,
    });
  },

  normalizeCreature(raw = {}) {
    const creatureType = this.text(raw.type, "Creature");
    const size = this.text(raw.size, "");
    const cr = this.formatCr(raw.challenge_rating);
    const speed = this.formatSpeed(raw.speed);
    const languages = this.text(raw.languages, "");
    const senses = this.formatSenses(raw.senses);
    const hitDice = this.text(raw.hit_dice, "");
    const alignment = this.text(raw.alignment, "");

    const traits = Array.isArray(raw.special_abilities) ? raw.special_abilities : [];
    const actions = Array.isArray(raw.actions) ? raw.actions : [];
    const reactions = Array.isArray(raw.reactions) ? raw.reactions : [];
    const legendary = Array.isArray(raw.legendary_actions) ? raw.legendary_actions : [];
    const abilities = [
      ...traits.map((item) => this.normalizeFeature(item, "Trait")),
      ...actions.map((item) => this.normalizeFeature(item, "Action")),
      ...reactions.map((item) => this.normalizeFeature(item, "Reaction")),
      ...legendary.map((item) => this.normalizeFeature(item, "Legendary")),
    ].filter(Boolean);

    const notes = [
      [size, creatureType].filter(Boolean).join(" "),
      alignment,
      `Challenge Rating: ${cr}`,
      hitDice ? `Hit Dice: ${hitDice}` : "",
      senses ? `Senses: ${senses}` : "",
      languages ? `Languages: ${languages}` : "",
      ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"].some((key) => raw[key] !== undefined)
        ? `Abilities: STR ${raw.strength ?? "—"}, DEX ${raw.dexterity ?? "—"}, CON ${raw.constitution ?? "—"}, INT ${raw.intelligence ?? "—"}, WIS ${raw.wisdom ?? "—"}, CHA ${raw.charisma ?? "—"}`
        : "",
      `Source: ${this.sourceLabel}`,
    ].filter(Boolean).join("\n");

    const key = this.text(raw.index || raw.key, "");
    const sourceUrl = key ? `${this.baseUrl}/api/2014/monsters/${encodeURIComponent(key)}` : this.baseUrl;
    const tags = ["Compendium", "SRD 5.1", `CR ${cr}`, creatureType, size].filter(Boolean);

    return ENC.normalizeLibraryEntry({
      id: ENC.makeId("cmp"),
      type: "creature",
      systemId: "dnd5e",
      name: this.text(raw.name, "Unnamed Creature"),
      portrait: "",
      maxHp: raw.hit_points ?? "",
      stats: {
        armorClass: this.armorClass(raw),
        passivePerception: this.passivePerception(raw),
        speed,
        spellSaveDC: this.spellSaveDc(raw),
      },
      abilities,
      resources: [],
      notes,
      tags,
      compendiumSource: {
        provider: this.id,
        key,
        documentKey: this.documentKey,
        documentName: this.sourceLabel,
        sourceUrl,
        license: this.license,
      },
    });
  },

  traits(raw = {}) {
    return Array.isArray(raw.special_abilities) ? raw.special_abilities : [];
  },

  async requestJson(url, signal) {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (_) {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(payload?.error || `Request failed (${response.status}).`);
    }
    return payload;
  },

  async fetchJson(url, signal) {
    // Phase 3.1.5 strategy:
    // 1) enCounter local proxy (best path; no browser CORS dependency)
    // 2) documented D&D 5e API URL directly (works where CORS/network permits)
    // The caller can then fall back to browser cache if both network paths fail.
    let proxyUrl = null;
    if (url === `${this.baseUrl}${this.indexPath}`) {
      proxyUrl = this.proxyIndexPath;
    } else if (url.startsWith(`${this.baseUrl}${this.indexPath}/`)) {
      const key = url.slice(`${this.baseUrl}${this.indexPath}/`.length);
      proxyUrl = `${this.proxyIndexPath}/${key}`;
    }

    const failures = [];
    if (proxyUrl) {
      try {
        return await this.requestJson(proxyUrl, signal);
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        failures.push(`local proxy: ${error?.message || error}`);
      }
    }

    try {
      return await this.requestJson(url, signal);
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      failures.push(`direct API: ${error?.message || error}`);
    }

    throw new Error(failures.join("; ") || "D&D 5e SRD request failed.");
  },

  readCachedIndex() {
    if (Array.isArray(this._indexCache) && this._indexCache.length) return this._indexCache;
    try {
      const cached = localStorage.getItem(this.indexStorageKey);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      const results = Array.isArray(parsed) ? parsed : parsed?.results;
      if (Array.isArray(results) && results.length) {
        this._indexCache = results;
        return results;
      }
    } catch (_) {
      // Browser storage can be disabled without breaking the provider.
    }
    return null;
  },

  cacheIndex(index) {
    this._indexCache = index;
    try {
      localStorage.setItem(this.indexStorageKey, JSON.stringify({
        cachedAt: new Date().toISOString(),
        results: index,
      }));
    } catch (_) {
      // Memory cache is enough when localStorage is unavailable.
    }
  },

  readCachedDetail(key) {
    if (!key) return null;
    if (this._detailCache.has(key)) return this._detailCache.get(key);
    try {
      const cached = localStorage.getItem(`${this.detailStoragePrefix}${key}`);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      const value = parsed?.record || parsed;
      if (value?.name) {
        this._detailCache.set(key, value);
        return value;
      }
    } catch (_) {
      // Ignore a corrupt/disabled browser cache.
    }
    return null;
  },

  cacheDetail(key, record) {
    if (!key || !record) return;
    this._detailCache.set(key, record);
    try {
      localStorage.setItem(`${this.detailStoragePrefix}${key}`, JSON.stringify({
        cachedAt: new Date().toISOString(),
        record,
      }));
    } catch (_) {
      // Memory cache is enough when localStorage is unavailable.
    }
  },

  async loadIndex(signal) {
    try {
      const payload = await this.fetchJson(`${this.baseUrl}${this.indexPath}`, signal);
      const index = Array.isArray(payload?.results) ? payload.results : [];
      if (!index.length) throw new Error("The D&D 5e SRD API returned an empty monster index.");
      this.cacheIndex(index);
      const proxyMeta = payload?._encounter || {};
      return {
        results: index,
        source: proxyMeta.source || "network",
        warning: proxyMeta.stale ? (proxyMeta.warning || "Live API unavailable; stale local cache used.") : "",
        stale: Boolean(proxyMeta.stale),
      };
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      const cached = this.readCachedIndex();
      if (cached?.length) return { results: cached, source: "browser-cache", warning: error.message };
      throw error;
    }
  },

  async getDetail(candidate, signal) {
    if (candidate?.hit_points !== undefined && Array.isArray(candidate?.actions)) return candidate;
    const key = this.text(candidate?.index || candidate?.key, "");
    if (!key) throw new Error("The selected SRD creature has no API index.");

    const cached = this.readCachedDetail(key);
    try {
      const record = await this.fetchJson(`${this.baseUrl}${this.indexPath}/${encodeURIComponent(key)}`, signal);
      if (!record?.name) throw new Error("The D&D 5e SRD API returned an invalid monster record.");
      this.cacheDetail(key, record);
      const proxyMeta = record?._encounter || {};
      if (proxyMeta.stale) {
        return {
          ...record,
          __cacheSource: proxyMeta.source || "disk-cache",
          __cacheWarning: proxyMeta.warning || "Live API unavailable; stale local cache used.",
        };
      }
      return {
        ...record,
        __cacheSource: proxyMeta.source || "live-api",
      };
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      if (cached) return { ...cached, __cacheSource: "browser-cache", __cacheWarning: error.message };
      throw error;
    }
  },

  scoreMatch(item, query) {
    const name = String(item?.name || "").toLowerCase();
    const index = String(item?.index || "").toLowerCase();
    if (name === query || index === query) return 0;
    if (name.startsWith(query) || index.startsWith(query)) return 1;
    return 2;
  },

  async search(query, options = {}) {
    const text = String(query || "").trim();
    if (text.length < 2) throw new Error("Enter at least 2 characters to search.");
    const normalized = text.toLowerCase();
    const limit = Math.max(1, Math.min(50, Number(options.limit) || 25));
    const loaded = await this.loadIndex(options.signal);
    const matches = loaded.results
      .filter((item) => {
        const name = String(item?.name || "").toLowerCase();
        const key = String(item?.index || "").toLowerCase();
        return name.includes(normalized) || key.includes(normalized);
      })
      .sort((a, b) => {
        const score = this.scoreMatch(a, normalized) - this.scoreMatch(b, normalized);
        return score || String(a?.name || "").localeCompare(String(b?.name || ""));
      });

    // Search deliberately returns index records only. Full creature data is
    // fetched when the user selects Preview/Save/Add, matching the API's
    // documented discovery -> detail workflow.
    const results = matches.slice(0, limit).map((item) => ({ ...item, __summaryOnly: true }));
    return {
      count: matches.length,
      results,
      strategy: "dnd5eapi-index-then-detail",
      source: loaded.source,
      warning: loaded.warning || "",
    };
  },

};

ENC.compendiumUI = {
  providerId: "dnd5eapi-srd-2014",
  results: [],
  selectedRaw: null,
  abortController: null,
  actionInProgress: false,

  provider() {
    return Object.values(ENC.compendiumProviders || {}).find(
      (provider) => provider?.id === this.providerId,
    ) || null;
  },

  elements() {
    return {
      search: document.getElementById("compendiumSearch"),
      button: document.getElementById("compendiumSearchBtn"),
      status: document.getElementById("compendiumStatus"),
      results: document.getElementById("compendiumResults"),
      count: document.getElementById("compendiumResultCount"),
      empty: document.getElementById("compendiumEmpty"),
      preview: document.getElementById("compendiumPreview"),
    };
  },

  setStatus(message = "", kind = "") {
    const status = this.elements().status;
    if (!status) return;
    status.textContent = message;
    status.dataset.status = kind;
  },

  isSaved(entry) {
    const source = entry?.compendiumSource;
    if (!source?.key || !source?.provider) return null;
    return ENC.libraryUI?.entries?.find((item) =>
      item.compendiumSource?.provider === source.provider &&
      item.compendiumSource?.key === source.key,
    ) || null;
  },

  typeName(raw) {
    return this.provider().objectName(raw.type, raw.category || "Creature");
  },

  resultMeta(raw) {
    const provider = this.provider();
    return {
      cr: provider.formatCr(raw.challenge_rating ?? raw.challenge_rating_decimal),
      type: this.typeName(raw),
      hp: raw.hit_points ?? "—",
      ac: provider.armorClass(raw) || "—",
      source: provider.sourceLabel,
    };
  },

  renderResults() {
    const { results, count, empty } = this.elements();
    if (!results) return;
    results.innerHTML = "";
    if (count) count.textContent = this.results.length ? `${this.results.length} shown` : "0 results";
    empty?.classList.toggle("hidden", this.results.length > 0);

    for (const raw of this.results) {
      const meta = this.resultMeta(raw);
      const normalized = this.provider().normalizeCreature(raw);
      const saved = this.isSaved(normalized);
      const row = document.createElement("article");
      row.className = "compendium-result-row";
      const rawKey = raw.index || raw.key;
      const selectedKey = this.selectedRaw?.index || this.selectedRaw?.key;
      if (selectedKey && rawKey === selectedKey) row.classList.add("selected");

      const identity = document.createElement("button");
      identity.type = "button";
      identity.className = "compendium-result-identity";
      identity.addEventListener("click", () => this.select(raw));
      const name = document.createElement("strong");
      name.textContent = raw.name || "Unnamed Creature";
      const sub = document.createElement("span");
      sub.textContent = raw.__summaryOnly ? "SRD creature" : `${meta.type} · CR ${meta.cr}`;
      identity.append(name, sub);

      const hp = document.createElement("span");
      hp.textContent = String(meta.hp);
      const ac = document.createElement("span");
      ac.textContent = String(meta.ac);
      const source = document.createElement("span");
      source.className = "compendium-source-cell";
      source.textContent = saved ? "In Library" : meta.source;

      const preview = document.createElement("button");
      preview.type = "button";
      preview.className = "compact-action";
      preview.textContent = "Preview";
      preview.addEventListener("click", () => this.select(raw));

      row.append(identity, hp, ac, source, preview);
      results.appendChild(row);
    }
  },

  setActionButtonsDisabled(disabled) {
    const preview = this.elements().preview;
    if (!preview) return;
    preview.querySelectorAll(".compendium-preview-actions button").forEach((button) => {
      button.disabled = Boolean(disabled);
    });
  },

  async withActionLock(label, action) {
    if (this.actionInProgress) {
      ENC.app.toast("A Compendium action is already in progress.");
      return null;
    }

    this.actionInProgress = true;
    this.setActionButtonsDisabled(true);
    if (label) this.setStatus(label, "loading");
    try {
      return await action();
    } finally {
      this.actionInProgress = false;
      this.setActionButtonsDisabled(false);
    }
  },

  async verifyLibraryEntry(entryId, expectedSource = null) {
    const persisted = await ENC.db.get("library", entryId);
    if (!persisted?.id) return null;
    if (expectedSource?.provider && persisted.compendiumSource?.provider !== expectedSource.provider) return null;
    if (expectedSource?.key && persisted.compendiumSource?.key !== expectedSource.key) return null;
    return persisted;
  },

  featureList(parent, titleText, features = []) {
    if (!features.length) return;
    const section = document.createElement("section");
    section.className = "compendium-preview-section";
    const title = document.createElement("h4");
    title.textContent = titleText;
    section.appendChild(title);
    for (const feature of features.slice(0, 12)) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = feature.name || "Feature";
      const body = document.createElement("p");
      body.textContent = feature.desc || feature.description || "";
      details.append(summary, body);
      section.appendChild(details);
    }
    parent.appendChild(section);
  },

  renderPreview() {
    const preview = this.elements().preview;
    if (!preview) return;
    preview.innerHTML = "";
    if (!this.selectedRaw) {
      preview.classList.add("compendium-preview-empty");
      preview.textContent = "Select a creature to preview its SRD details.";
      return;
    }
    preview.classList.remove("compendium-preview-empty");
    const raw = this.selectedRaw;
    const entry = this.provider().normalizeCreature(raw);
    const meta = this.resultMeta(raw);
    const saved = this.isSaved(entry);

    const header = document.createElement("div");
    header.className = "compendium-preview-header";
    const text = document.createElement("div");
    const eyebrow = document.createElement("div");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = `CR ${meta.cr} · ${meta.type}`;
    const title = document.createElement("h3");
    title.textContent = entry.name;
    const source = document.createElement("p");
    source.className = "hint";
    source.textContent = `${meta.source} · ${entry.compendiumSource?.license || "CC BY 4.0"}`;
    text.append(eyebrow, title, source);

    const actions = document.createElement("div");
    actions.className = "compendium-preview-actions";
    const add = document.createElement("button");
    add.type = "button";
    add.className = "primary";
    add.textContent = "Add to Encounter";
    add.addEventListener("click", () => this.addToEncounter(raw));
    const save = document.createElement("button");
    save.type = "button";
    save.textContent = saved ? "Update Library Copy" : "Save to Library";
    save.disabled = false;
    save.addEventListener("click", () => this.saveToLibrary(raw));
    actions.append(add, save);
    header.append(text, actions);

    const stats = document.createElement("div");
    stats.className = "compendium-stat-grid";
    const statItems = [
      ["HP", entry.maxHp || "—"],
      ["AC", entry.stats?.armorClass || "—"],
      ["Speed", entry.stats?.speed || "—"],
      ["Passive Perception", entry.stats?.passivePerception || "—"],
    ];
    for (const [label, value] of statItems) {
      const cell = document.createElement("div");
      const strong = document.createElement("strong");
      strong.textContent = String(value);
      const span = document.createElement("span");
      span.textContent = label;
      cell.append(strong, span);
      stats.appendChild(cell);
    }

    const notes = document.createElement("pre");
    notes.className = "compendium-preview-notes";
    notes.textContent = entry.notes || "";

    preview.append(header, stats, notes);
    this.featureList(preview, "Traits", this.provider().traits(raw));
    this.featureList(preview, "Actions", Array.isArray(raw.actions) ? raw.actions : []);
    this.featureList(preview, "Reactions", Array.isArray(raw.reactions) ? raw.reactions : []);
    this.featureList(preview, "Legendary Actions", Array.isArray(raw.legendary_actions) ? raw.legendary_actions : []);
  },

  async select(raw) {
    const key = raw?.index || raw?.key;
    if (!key) return;

    this.setStatus(`Loading ${raw.name || "creature"} details…`, "loading");
    try {
      const detail = await this.provider().getDetail(raw);
      this.results = this.results.map((item) =>
        (item.index || item.key) === key ? detail : item,
      );
      this.selectedRaw = detail;
      this.renderResults();
      this.renderPreview();
      if (detail.__cacheWarning) {
        const cacheLabel = detail.__cacheSource === "browser-cache" ? "browser cache" : "local disk cache";
        this.setStatus(`Creature details loaded from ${cacheLabel} because the live API was unavailable.`, "warning");
      } else if (detail.__cacheSource === "disk-cache") {
        this.setStatus("Creature details loaded from the local cache.", "success");
      } else {
        this.setStatus("Creature details loaded from the live SRD API.", "success");
      }
    } catch (error) {
      this.setStatus(`Could not load creature details: ${error?.message || "Unknown error"}`, "error");
    }
  },

  async search() {
    const { search, button } = this.elements();
    const query = search?.value?.trim() || "";
    if (query.length < 2) {
      this.setStatus("Enter at least 2 characters to search.", "error");
      search?.focus();
      return;
    }

    this.abortController?.abort?.();
    this.abortController = new AbortController();
    button.disabled = true;
    button.textContent = "Searching…";
    this.setStatus("Searching the D&D 5E SRD…", "loading");
    try {
      const response = await this.provider().search(query, {
        limit: 25,
        signal: this.abortController.signal,
      });
      this.results = response.results;
      this.selectedRaw = null;
      this.renderResults();
      this.renderPreview();
      const suffix = response.count > this.results.length ? ` Showing the first ${this.results.length}.` : "";
      let sourceLabel = " Live API.";
      if (response.source === "disk-cache") sourceLabel = response.warning ? " Offline local cache." : " Local cache.";
      if (response.source === "browser-cache") sourceLabel = " Offline browser cache.";
      const warning = response.warning ? " Live API unavailable; cached index used." : "";
      this.setStatus(`${response.count} SRD creature${response.count === 1 ? "" : "s"} found.${suffix}${sourceLabel}${warning}`, response.warning ? "warning" : "success");
    } catch (error) {
      if (error?.name === "AbortError") return;
      this.results = [];
      this.selectedRaw = null;
      this.renderResults();
      this.renderPreview();
      this.setStatus(`SRD provider error: ${error?.message || "Unknown error"}`, "error");
      console.warn("Compendium search failed", error);
    } finally {
      button.disabled = false;
      button.textContent = "Search";
    }
  },

  async saveToLibrary(raw) {
    return this.withActionLock("Saving creature to the Library…", async () => {
      try {
        raw = await this.provider().getDetail(raw);
        const entry = this.provider().normalizeCreature(raw);
        const existing = this.isSaved(entry);
        const now = new Date().toISOString();

        let persisted = null;
        let message = "";

        if (existing) {
          const updated = ENC.normalizeLibraryEntry({
            ...ENC.deepClone(existing),
            ...ENC.deepClone(entry),
            // DM-managed customization must survive an SRD refresh.
            portrait: existing.portrait || "",
            notes: existing.notes || entry.notes || "",
            tags: [...new Set([...(entry.tags || []), ...(existing.tags || [])])],
            customProfile: ENC.deepClone(existing.customProfile || entry.customProfile),
            id: existing.id,
            createdAt: existing.createdAt || now,
            updatedAt: now,
          });
          await ENC.db.put("library", updated);
          persisted = await this.verifyLibraryEntry(updated.id, updated.compendiumSource);
          if (!persisted) throw new Error(`Could not verify that ${updated.name} was updated in the Library.`);
          message = `${updated.name} updated in the Library.`;
        } else {
          entry.id = ENC.makeId("lib");
          entry.createdAt = now;
          entry.updatedAt = now;
          await ENC.db.put("library", entry);
          persisted = await this.verifyLibraryEntry(entry.id, entry.compendiumSource);
          if (!persisted) throw new Error(`Could not verify that ${entry.name} was saved to the Library.`);
          message = `${entry.name} saved to the Library.`;
        }

        ENC.backup.scheduleExternalBackup();
        await ENC.libraryUI.load();
        ENC.libraryUI.render();
        ENC.combat.renderLibrarySelect();

        // Saving or refreshing an SRD creature should immediately update any
        // matching active combatant. This also links encounter-only Compendium
        // creatures to the exact Library record by provider + key, never name.
        const syncedCombatants = persisted
          ? await ENC.combat.syncLinkedLibraryEntry(persisted, { full: true })
          : 0;
        if (syncedCombatants) {
          message += ` ${syncedCombatants} active combatant${syncedCombatants === 1 ? "" : "s"} refreshed/linked.`;
        }

        this.renderResults();
        this.renderPreview();
        this.setStatus(message, "success");
        ENC.app.toast(message);
        return persisted;
      } catch (error) {
        const message = `Library save failed: ${error?.message || "Unknown error"}`;
        this.setStatus(message, "error");
        ENC.app.toast(message);
        console.warn("Compendium Library save failed", error);
        return null;
      }
    });
  },

  async addToEncounter(raw) {
    return this.withActionLock("Adding creature to the encounter…", async () => {
      try {
        if (!ENC.combat?.encounter) {
          await ENC.combat.load();
        }

        raw = await this.provider().getDetail(raw);
        const entry = this.provider().normalizeCreature(raw);
        const saved = this.isSaved(entry);
        const bonus = Number(this.provider().initiativeBonus(raw));
        const suggested = Number.isFinite(bonus) ? 10 + bonus : 10;
        const initiativeInput = prompt(`Initiative for ${entry.name}:`, String(suggested));
        if (initiativeInput === null) {
          this.setStatus("Add to Encounter cancelled.", "");
          return null;
        }
        const initiative = Number(initiativeInput);
        if (!Number.isFinite(initiative)) {
          throw new Error("Initiative must be a number.");
        }

        let combatant = null;
        let sourceLabel = "Compendium";
        if (saved) {
          // Use current SRD details while preserving the user's saved Library identity.
          // Adding another copy never overwrites the Library record.
          const encounterEntry = ENC.normalizeLibraryEntry({
            ...ENC.deepClone(saved),
            ...ENC.deepClone(entry),
            // Use current SRD mechanics but preserve DM-owned Library customization.
            portrait: saved.portrait || "",
            notes: saved.notes || entry.notes || "",
            tags: [...new Set([...(entry.tags || []), ...(saved.tags || [])])],
            customProfile: ENC.deepClone(saved.customProfile || entry.customProfile),
            id: saved.id,
            createdAt: saved.createdAt,
            updatedAt: saved.updatedAt,
          });
          combatant = await ENC.combat.addLibraryEntry(encounterEntry, initiative);
          sourceLabel = "Library";
        } else {
          combatant = await ENC.combat.addCompendiumEntry(entry, initiative);
        }

        if (!combatant?.id) {
          throw new Error(`Could not confirm that ${entry.name} was added to the encounter.`);
        }

        const persistedEncounter = await ENC.db.getActiveEncounter();
        const persistedCombatant = persistedEncounter?.combatants?.find((item) => item.id === combatant.id);
        if (!persistedCombatant) {
          throw new Error(`The encounter was saved, but ${entry.name} could not be verified afterward.`);
        }

        ENC.combat.encounter = persistedEncounter;
        document.querySelector('[data-section="encounterSection"]')?.click();
        ENC.combat.render();
        const count = persistedEncounter.combatants.length;
        const duplicateCount = persistedEncounter.combatants.filter((item) =>
          item.compendiumSource?.provider === entry.compendiumSource?.provider &&
          item.compendiumSource?.key === entry.compendiumSource?.key
        ).length;
        const duplicateNote = duplicateCount > 1 ? ` · ${duplicateCount} copies of this creature in encounter` : "";
        const message = `${entry.name} added from ${sourceLabel} at initiative ${initiative}.`;
        this.setStatus(message, "success");
        ENC.app.toast(`${entry.name} added to the encounter · ${count} combatant${count === 1 ? "" : "s"} total${duplicateNote}.`);
        return persistedCombatant;
      } catch (error) {
        const message = `Add to Encounter failed: ${error?.message || "Unknown error"}`;
        this.setStatus(message, "error");
        ENC.app.toast(message);
        console.warn("Compendium Add to Encounter failed", error);
        return null;
      }
    });
  },

  bind() {
    const { search, button } = this.elements();
    button?.addEventListener("click", () => this.search());
    search?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.search();
      }
    });
    document.getElementById("compendiumManageLibraryBtn")?.addEventListener("click", () =>
      ENC.dmWorkspace?.open?.("characters", { characterType: "enemy-creature" }),
    );
  },

  initialize() {
    this.bind();
    this.renderResults();
    this.renderPreview();
  },
};
