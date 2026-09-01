/*
 * Copyright (C) 2026 Zygons
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

window.ENC = window.ENC || {};
const ENC = window.ENC;

/* ========================================
   enCounter Application Information
======================================== */

ENC.APP_NAME = "enCounter";
ENC.APP_VERSION = "0.1.0-alpha.1";
ENC.APP_STAGE = "Alpha";

/*
   Database version is NOT the application version.
   Keep this as an integer unless the IndexedDB schema changes.
*/
ENC.DB_NAME = "enCounterAlphaDB";
ENC.DB_VERSION = 3;

ENC.CHANNEL_NAME = "enCounter-sync-alpha";
ENC.SYNC_FALLBACK_KEY = "enCounter-sync-alpha-fallback";
ENC.DISPLAY_PRESENCE_PING_MS = 3000;
ENC.DM_PRESENCE_TIMEOUT_MS = 8000;

ENC.SYSTEM_PROFILES = {
  generic: {
    id: "generic",
    label: "Generic TTRPG",
    stats: [
      { key: "defense", label: "Defense", type: "number" },
      { key: "perception", label: "Perception", type: "number" },
      { key: "speed", label: "Speed", type: "text" },
    ],
    usesConditionTrack: false,
    statusPlaceholder: "Prone, stunned, poisoned",
  },
  swse: {
    id: "swse",
    label: "Star Wars Saga Edition",
    stats: [
      { key: "refDefense", label: "REF", type: "number" },
      { key: "fortDefense", label: "FORT", type: "number" },
      { key: "willDefense", label: "WILL", type: "number" },
      { key: "damageThreshold", label: "DT", type: "number" },
    ],
    usesConditionTrack: true,
    statusPlaceholder: "Prone, stunned, grabbed",
  },
  dnd5e: {
    id: "dnd5e",
    label: "D&D 5E",
    stats: [
      { key: "armorClass", label: "AC", type: "number" },
      { key: "passivePerception", label: "Passive Perception", type: "number" },
      { key: "speed", label: "Speed", type: "text" },
      { key: "spellSaveDC", label: "Spell Save DC", type: "number" },
    ],
    usesConditionTrack: false,
    statusPlaceholder: "Prone, grappled, concentrating",
  },
};

ENC.MODE_PRESETS = {
  simple: {
    hp: false,
    status: false,
    conditions: false,
    systemStats: false,
    abilities: false,
    resources: false,
    notes: false,
    hiddenCombatants: false,
    combatControls: false,
    backgrounds: true,
    encounterPresets: false,
  },
  standard: {
    hp: true,
    status: true,
    conditions: false,
    systemStats: true,
    abilities: false,
    resources: false,
    notes: true,
    hiddenCombatants: true,
    combatControls: true,
    backgrounds: true,
    encounterPresets: true,
  },
  advanced: {
    hp: true,
    status: true,
    conditions: true,
    systemStats: true,
    abilities: true,
    resources: true,
    notes: true,
    hiddenCombatants: true,
    combatControls: true,
    backgrounds: true,
    encounterPresets: true,
  },
};

ENC.DEFAULT_SETTINGS = {
  key: "app-settings",
  mode: "standard",
  modules: { ...ENC.MODE_PRESETS.standard },
  systemId: "generic",
  customProfile: {
    name: "Custom System",
    labels: ["Stat 1", "Stat 2", "Stat 3", "Stat 4"],
  },
  externalBackup: true,
  snapshotLimit: 20,
};

ENC.LIBRARY_TYPES = new Set(["player", "npc", "enemy", "creature"]);
ENC.COMBAT_STATES = new Set(["active", "delayed", "ready", "defeated", "inactive"]);
ENC.CONDITION_TRACK_VALUES = new Set(["Normal", "-1", "-2", "-5", "-10", "Helpless"]);

ENC.makeId = function (prefix = "id") {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

ENC.deepClone = function (value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

ENC.escapeHtml = function (value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

ENC.finiteNumber = function (value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

ENC.numericOrBlank = function (value) {
  if (value === "" || value === null || value === undefined) return "";
  const number = Number(value);
  return Number.isFinite(number) ? number : "";
};

ENC.normalizeSystemId = function (systemId) {
  if (systemId === "custom") return "custom";
  return Object.prototype.hasOwnProperty.call(ENC.SYSTEM_PROFILES, systemId)
    ? systemId
    : "generic";
};

ENC.normalizeCustomProfile = function (profile = null) {
  const source = profile && typeof profile === "object" ? profile : {};
  const labels = Array.isArray(source.labels) ? source.labels : [];
  return {
    name: String(source.name || "Custom System").trim() || "Custom System",
    labels: [0, 1, 2, 3].map(
      (index) => String(labels[index] || `Stat ${index + 1}`).trim() || `Stat ${index + 1}`,
    ),
  };
};

ENC.sanitizeAssetUrl = function (value) {
  const text = String(value || "").trim();
  if (!text) return "";

  try {
    const url = new URL(text, window.location.origin);
    if (url.origin !== window.location.origin) return "";
    if (!url.pathname.startsWith("/assets/")) return "";
    if (!/\.(png|jpe?g|webp)$/i.test(url.pathname)) return "";
    return url.pathname;
  } catch {
    return "";
  }
};

ENC.normalizeSettings = function (settings = {}) {
  const source = settings && typeof settings === "object" ? settings : {};
  const validModes = new Set(["simple", "standard", "advanced", "custom"]);
  const mode = validModes.has(source.mode) ? source.mode : "standard";
  const baseModules =
    mode !== "custom" && ENC.MODE_PRESETS[mode]
      ? ENC.MODE_PRESETS[mode]
      : ENC.MODE_PRESETS.standard;
  const rawModules = source.modules && typeof source.modules === "object" ? source.modules : {};
  const modules = {};

  for (const key of Object.keys(ENC.MODE_PRESETS.standard)) {
    modules[key] = Object.prototype.hasOwnProperty.call(rawModules, key)
      ? Boolean(rawModules[key])
      : Boolean(baseModules[key]);
  }

  const rawLimit = Number(source.snapshotLimit);
  const snapshotLimit = Number.isFinite(rawLimit)
    ? Math.min(100, Math.max(1, Math.trunc(rawLimit)))
    : 20;

  return {
    key: "app-settings",
    mode,
    modules,
    systemId: ENC.normalizeSystemId(source.systemId || "generic"),
    customProfile: ENC.normalizeCustomProfile(source.customProfile),
    externalBackup: source.externalBackup !== false,
    snapshotLimit,
  };
};

ENC.createDefaultEncounter = function () {
  return {
    id: "active",
    kind: "active",
    name: "New Encounter",
    systemId: "generic",
    customProfile: ENC.deepClone(ENC.DEFAULT_SETTINGS.customProfile),
    round: 1,
    currentId: null,
    background: "",
    combatants: [],
    updatedAt: new Date().toISOString(),
  };
};

ENC.isMeaningfulEncounter = function (encounter) {
  if (!encounter) return false;
  return Boolean(
    (encounter.combatants || []).length > 0 ||
      Number(encounter.round || 1) > 1 ||
      Boolean(encounter.currentId) ||
      Boolean(encounter.background) ||
      String(encounter.name || "").trim().toLowerCase() !== "new encounter",
  );
};

ENC.getSystemProfile = function (systemId, customProfile = null) {
  const normalizedSystemId = ENC.normalizeSystemId(systemId);
  if (normalizedSystemId === "custom") {
    const profile = ENC.normalizeCustomProfile(customProfile || ENC.DEFAULT_SETTINGS.customProfile);
    return {
      id: "custom",
      label: profile.name,
      stats: [0, 1, 2, 3].map((index) => ({
        key: `custom${index + 1}`,
        label: profile.labels[index],
        type: "text",
      })),
      usesConditionTrack: false,
      statusPlaceholder: "Enter visible status effects",
    };
  }
  return ENC.SYSTEM_PROFILES[normalizedSystemId] || ENC.SYSTEM_PROFILES.generic;
};

ENC.getSystemLabel = function (systemId, customProfile = null) {
  return ENC.getSystemProfile(systemId, customProfile).label;
};

ENC.normalizeAbility = function (ability = {}) {
  const source = ability && typeof ability === "object" ? ability : {};
  const rawMax = source.usesMax;
  const usesMax = rawMax === "" || rawMax === null || rawMax === undefined
    ? ""
    : Math.max(0, ENC.finiteNumber(rawMax, 0));
  const usesRemaining = usesMax === ""
    ? ""
    : Math.min(usesMax, Math.max(0, ENC.finiteNumber(source.usesRemaining, usesMax)));

  return {
    id: String(source.id || ENC.makeId("ability")),
    name: String(source.name || "Ability"),
    usesMax,
    usesRemaining,
    description: String(source.description || ""),
  };
};

ENC.normalizeResource = function (resource = {}) {
  const source = resource && typeof resource === "object" ? resource : {};
  const max = Math.max(0, ENC.finiteNumber(source.max, ENC.finiteNumber(source.current, 0)));
  const current = Math.min(max, Math.max(0, ENC.finiteNumber(source.current, 0)));
  return {
    id: String(source.id || ENC.makeId("resource")),
    name: String(source.name || "Resource"),
    current,
    max,
  };
};

ENC.normalizeLibraryEntry = function (entry = {}) {
  const source = entry && typeof entry === "object" ? entry : {};
  const now = new Date().toISOString();
  const systemId = ENC.normalizeSystemId(source.systemId || "generic");
  const legacyStats =
    source.stats && typeof source.stats === "object" && !Array.isArray(source.stats)
      ? { ...source.stats }
      : {};

  for (const key of ["refDefense", "fortDefense", "willDefense", "damageThreshold"]) {
    if (source[key] !== undefined && source[key] !== "") legacyStats[key] = source[key];
  }

  return {
    id: String(source.id || ENC.makeId("lib")),
    type: ENC.LIBRARY_TYPES.has(source.type) ? source.type : "npc",
    systemId,
    customProfile: ENC.normalizeCustomProfile(source.customProfile),
    name: String(source.name || "Unnamed").trim() || "Unnamed",
    portrait: ENC.sanitizeAssetUrl(source.portrait || source.avatar || ""),
    maxHp: ENC.numericOrBlank(source.maxHp),
    stats: legacyStats,
    abilities: Array.isArray(source.abilities) ? source.abilities.map(ENC.normalizeAbility) : [],
    resources: Array.isArray(source.resources) ? source.resources.map(ENC.normalizeResource) : [],
    notes: String(source.notes || ""),
    tags: Array.isArray(source.tags)
      ? source.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [],
    createdAt: String(source.createdAt || now),
    updatedAt: String(source.updatedAt || now),
  };
};

ENC.normalizeCombatant = function (
  combatant = {},
  fallbackSystem = "generic",
  customProfile = null,
) {
  const source = combatant && typeof combatant === "object" ? combatant : {};
  const systemId = ENC.normalizeSystemId(source.systemId || fallbackSystem);
  const normalized = ENC.normalizeLibraryEntry({
    ...source,
    systemId,
    customProfile: source.customProfile || customProfile || ENC.DEFAULT_SETTINGS.customProfile,
  });
  let combatState = ENC.COMBAT_STATES.has(source.combatState)
    ? source.combatState
    : "active";
  if (combatState === "active" && source.delayed) combatState = "delayed";
  if (combatState === "active" && source.ready) combatState = "ready";
  const initiative = ENC.finiteNumber(source.initiative, 10);
  const createdOrder = ENC.finiteNumber(source.createdOrder, Date.now() + Math.random());
  const hp = source.hp === "" || source.hp === null || source.hp === undefined
    ? normalized.maxHp
    : ENC.numericOrBlank(source.hp);

  return {
    ...normalized,
    id: String(source.id || ENC.makeId("cmb")),
    sourceLibraryId: source.sourceLibraryId ? String(source.sourceLibraryId) : null,
    initiative,
    hp,
    conditionTrack: ENC.CONDITION_TRACK_VALUES.has(source.conditionTrack)
      ? source.conditionTrack
      : "Normal",
    visibleStatus: String(source.visibleStatus || ""),
    combatState,
    hidden: Boolean(source.hidden),
    delayed: combatState === "delayed",
    ready: combatState === "ready",
    createdOrder,
  };
};

ENC.normalizeEncounter = function (encounter = {}) {
  const source = encounter && typeof encounter === "object" ? encounter : {};
  const kind = source.kind === "preset" ? "preset" : "active";
  const systemId = ENC.normalizeSystemId(source.systemId || "generic");
  const customProfile = ENC.normalizeCustomProfile(source.customProfile);
  const combatants = Array.isArray(source.combatants)
    ? source.combatants.map((combatant) =>
        ENC.normalizeCombatant(combatant, systemId, customProfile),
      )
    : [];
  ENC.sortCombatants(combatants);

  const requestedCurrentId = source.currentId ? String(source.currentId) : null;
  const currentId = combatants.some((combatant) => combatant.id === requestedCurrentId)
    ? requestedCurrentId
    : null;
  const rawRound = Number(source.round);

  return {
    id: String(source.id || (kind === "active" ? "active" : ENC.makeId("preset"))),
    kind,
    name: String(source.name || (kind === "active" ? "New Encounter" : "Encounter Preset")).trim() || "Encounter",
    systemId,
    customProfile,
    round: Number.isFinite(rawRound) ? Math.max(1, Math.trunc(rawRound)) : 1,
    currentId,
    background: ENC.sanitizeAssetUrl(source.background),
    combatants,
    updatedAt: String(source.updatedAt || new Date().toISOString()),
  };
};

ENC.sortCombatants = function (combatants) {
  return combatants.sort((a, b) => {
    const aInit = ENC.finiteNumber(a.initiative, 0);
    const bInit = ENC.finiteNumber(b.initiative, 0);
    const initDiff = bInit - aInit;
    if (initDiff !== 0) return initDiff;
    return ENC.finiteNumber(a.createdOrder, 0) - ENC.finiteNumber(b.createdOrder, 0);
  });
};

ENC.isTurnEligibleCombatant = function (combatant) {
  return Boolean(
    combatant &&
      combatant.combatState === "active" &&
      !combatant.delayed &&
      !combatant.ready,
  );
};

/*
 * Player Display visibility is independent from initiative eligibility.
 * Hidden combatants remain fully available to the DM but are omitted from
 * every player-facing initiative surface until they are revealed.
 */
ENC.isPlayerVisibleCombatant = function (combatant) {
  return Boolean(combatant && !combatant.hidden);
};

ENC.getPlayerVisibleCombatants = function (combatants) {
  const all = Array.isArray(combatants) ? combatants : [];
  return all.filter(ENC.isPlayerVisibleCombatant);
};

ENC.findNextPlayerVisibleEligibleCombatant = function (combatants, currentId) {
  const all = Array.isArray(combatants) ? combatants : [];
  if (!all.length) return null;

  const requestedId = currentId ? String(currentId) : null;
  const currentIndex = all.findIndex((combatant) => combatant.id === requestedId);
  const startIndex = currentIndex >= 0 ? currentIndex : -1;

  for (let step = 1; step <= all.length; step += 1) {
    const candidate = all[(startIndex + step) % all.length];
    if (
      ENC.isPlayerVisibleCombatant(candidate) &&
      ENC.isTurnEligibleCombatant(candidate)
    ) {
      return candidate;
    }
  }

  return null;
};

/*
 * Pure turn-transition helper. It does not write to IndexedDB, the DOM, or the
 * supplied combatant array, which makes initiative behavior easy to unit-test.
 */
ENC.calculateTurnMove = function (combatants, currentId, round = 1, direction = 1) {
  const all = Array.isArray(combatants) ? combatants : [];
  const safeRound = Math.max(1, Math.trunc(ENC.finiteNumber(round, 1)));
  const moveDirection = ENC.finiteNumber(direction, 1) < 0 ? -1 : 1;

  if (!all.length || !all.some(ENC.isTurnEligibleCombatant)) {
    return {
      moved: false,
      currentId: currentId ? String(currentId) : null,
      round: safeRound,
      wrapped: false,
    };
  }

  const requestedId = currentId ? String(currentId) : null;
  const currentIndex = all.findIndex((combatant) => combatant.id === requestedId);

  if (currentIndex < 0) {
    const candidate = moveDirection > 0
      ? all.find(ENC.isTurnEligibleCombatant)
      : [...all].reverse().find(ENC.isTurnEligibleCombatant);
    return {
      moved: Boolean(candidate),
      currentId: candidate?.id || null,
      round: safeRound,
      wrapped: false,
    };
  }

  for (let step = 1; step <= all.length; step++) {
    let nextIndex = currentIndex + moveDirection * step;
    let wrapped = false;

    while (nextIndex >= all.length) {
      nextIndex -= all.length;
      wrapped = true;
    }
    while (nextIndex < 0) {
      nextIndex += all.length;
      wrapped = true;
    }

    const candidate = all[nextIndex];
    if (!ENC.isTurnEligibleCombatant(candidate)) continue;

    let nextRound = safeRound;
    if (wrapped && moveDirection > 0) nextRound += 1;
    if (wrapped && moveDirection < 0) nextRound = Math.max(1, nextRound - 1);

    return {
      moved: true,
      currentId: candidate.id,
      round: nextRound,
      wrapped,
    };
  }

  return {
    moved: false,
    currentId: requestedId,
    round: safeRound,
    wrapped: false,
  };
};

ENC.parseAbilities = function (text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "Ability", usesRaw = "", ...descriptionParts] = line
        .split("|")
        .map((part) => part.trim());
      const usesMax = usesRaw === "" ? "" : Math.max(0, ENC.finiteNumber(usesRaw, 0));
      return ENC.normalizeAbility({
        id: ENC.makeId("ability"),
        name,
        usesMax,
        usesRemaining: usesMax,
        description: descriptionParts.join(" | "),
      });
    });
};

ENC.abilitiesToText = function (abilities = []) {
  return abilities
    .map(
      (ability) =>
        `${ability.name || "Ability"} | ${ability.usesMax ?? ""} | ${ability.description || ""}`,
    )
    .join("\n");
};

ENC.parseResources = function (text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "Resource", currentRaw = "0", maxRaw = currentRaw] = line
        .split("|")
        .map((part) => part.trim());
      return ENC.normalizeResource({
        id: ENC.makeId("resource"),
        name,
        current: ENC.finiteNumber(currentRaw, 0),
        max: ENC.finiteNumber(maxRaw, ENC.finiteNumber(currentRaw, 0)),
      });
    });
};

ENC.resourcesToText = function (resources = []) {
  return resources
    .map(
      (resource) =>
        `${resource.name || "Resource"} | ${resource.current ?? 0} | ${resource.max ?? 0}`,
    )
    .join("\n");
};
