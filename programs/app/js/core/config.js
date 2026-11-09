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
ENC.APP_VERSION = "0.3.0-alpha.1";
ENC.APP_STAGE = "Alpha";

/*
   Database version is NOT the application version.
   Keep this as an integer unless the IndexedDB schema changes.
*/
ENC.DB_NAME = "enCounterAlphaDB";
ENC.DB_VERSION = 3;

// UI-generation metadata is intentionally independent of the IndexedDB schema.
// Phase 1 adds the upgrade/compatibility foundation without moving user data.
ENC.UI_GENERATION = 3;
ENC.UPGRADE_FLOW_VERSION = 1;
ENC.UPGRADE_ASSISTANT_AUTO_START = true;

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
  uiTheme: "scifi",
};

ENC.UI_THEMES = new Set(["original", "scifi", "fantasy"]);

ENC.normalizeUiTheme = function (theme) {
  const value = String(theme || "").trim().toLowerCase();
  return ENC.UI_THEMES.has(value) ? value : "scifi";
};

ENC.applyUiTheme = function (theme, root = document.body) {
  const normalized = ENC.normalizeUiTheme(theme);

  if (root?.classList) {
    root.classList.remove("theme-original", "theme-scifi", "theme-fantasy");
    root.classList.add(`theme-${normalized}`);
    root.dataset.uiTheme = normalized;
  }

  try {
    localStorage.setItem("encounter-ui-theme", normalized);
  } catch (error) {
    console.warn("Unable to persist UI theme preference:", error);
  }

  const subtitle = document.getElementById("themeSidebarSubtitle");
  if (subtitle) {
    subtitle.textContent =
      normalized === "fantasy"
        ? "ADVENTURE DM CONSOLE"
        : normalized === "scifi"
          ? "TACTICAL DM CONSOLE"
          : "TTRPG ENCOUNTER CONSOLE";
  }

  return normalized;
};

ENC.LIBRARY_TYPES = new Set(["player", "npc", "enemy", "creature"]);
ENC.COMBAT_STATES = new Set([
  "active",
  "delayed",
  "ready",
  "defeated",
  "inactive",
]);
ENC.RECOVERY_STATES = new Set(["normal", "downed", "stable", "dead"]);
ENC.CONDITION_TRACK_VALUES = new Set([
  "Normal",
  "-1",
  "-2",
  "-5",
  "-10",
  "Helpless",
]);
ENC.DND5E_CONDITIONS = Object.freeze([
  "Blinded",
  "Charmed",
  "Deafened",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
]);

ENC.DND5E_CONDITION_VALUES = new Set(ENC.DND5E_CONDITIONS);

ENC.DND5E_EXHAUSTION_MIN = 0;
ENC.DND5E_EXHAUSTION_MAX = 6;

ENC.SAVED_ENCOUNTER_MODES = new Set(["template", "state"]);

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
      (index) =>
        String(labels[index] || `Stat ${index + 1}`).trim() ||
        `Stat ${index + 1}`,
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

ENC.sanitizeAudioUrl = function (value) {
  const text = String(value || "").trim();
  if (!text) return "";

  try {
    const url = new URL(text, window.location.origin);
    if (url.origin !== window.location.origin) return "";
    if (!url.pathname.startsWith("/assets/sounds/")) return "";
    if (!/\.(mp3|ogg|wav|flac)$/i.test(url.pathname)) return "";
    return url.pathname;
  } catch {
    return "";
  }
};

ENC.ENCOUNTER_PHASES = new Set(["prepared", "scene", "combat", "complete"]);
ENC.PLAYER_DISPLAY_MODES = new Set(["standby", "scene", "combat"]);

ENC.normalizeAudioTrack = function (track = {}, defaults = {}) {
  const source = track && typeof track === "object" ? track : {};
  const defaultVolume = ENC.finiteNumber(defaults.volume, 0.5);
  const volume = Math.min(
    1,
    Math.max(0, ENC.finiteNumber(source.volume, defaultVolume)),
  );
  const combatBehavior = ["stop", "continue", "duck"].includes(
    source.combatBehavior,
  )
    ? source.combatBehavior
    : String(defaults.combatBehavior || "stop");
  const combatVolume = Math.min(
    1,
    Math.max(0, ENC.finiteNumber(source.combatVolume, 0.15)),
  );

  return {
    id: String(source.id || ENC.makeId("audio")),
    name:
      String(source.name || defaults.name || "Audio Track").trim() ||
      "Audio Track",
    asset: ENC.sanitizeAudioUrl(source.asset),
    volume,
    loop: source.loop !== false,
    combatBehavior,
    combatVolume,
  };
};

ENC.createDefaultSoundscape = function () {
  return {
    enabled: true,
    masterVolume: 0.8,
    fadeMs: 2500,
    autoSwitchToCombat: true,
    returnToSceneAfterCombat: true,
    scene: {
      music: ENC.normalizeAudioTrack({
        name: "Scene Music",
        loop: true,
        volume: 0.35,
      }),
      ambience: [],
    },
    combat: {
      music: ENC.normalizeAudioTrack({
        name: "Combat Music",
        loop: true,
        volume: 0.65,
      }),
      ambience: [],
    },
    cues: [],
  };
};

ENC.normalizeSoundscape = function (soundscape = {}) {
  const source = soundscape && typeof soundscape === "object" ? soundscape : {};
  const defaults = ENC.createDefaultSoundscape();
  const scene =
    source.scene && typeof source.scene === "object" ? source.scene : {};
  const combat =
    source.combat && typeof source.combat === "object" ? source.combat : {};

  const normalizeList = (items, defaultBehavior = "stop") =>
    (Array.isArray(items) ? items : []).slice(0, 8).map((item, index) =>
      ENC.normalizeAudioTrack(item, {
        name: `Ambience ${index + 1}`,
        volume: 0.4,
        combatBehavior: defaultBehavior,
      }),
    );

  return {
    enabled: source.enabled !== false,
    masterVolume: Math.min(
      1,
      Math.max(0, ENC.finiteNumber(source.masterVolume, defaults.masterVolume)),
    ),
    fadeMs: Math.min(
      15000,
      Math.max(0, Math.trunc(ENC.finiteNumber(source.fadeMs, defaults.fadeMs))),
    ),
    autoSwitchToCombat: source.autoSwitchToCombat !== false,
    returnToSceneAfterCombat: source.returnToSceneAfterCombat !== false,
    scene: {
      music: ENC.normalizeAudioTrack(scene.music || {}, {
        name: "Scene Music",
        volume: 0.35,
        combatBehavior: "stop",
      }),
      ambience: normalizeList(scene.ambience, "duck"),
    },
    combat: {
      music: ENC.normalizeAudioTrack(combat.music || {}, {
        name: "Combat Music",
        volume: 0.65,
        combatBehavior: "continue",
      }),
      ambience: normalizeList(combat.ambience, "continue"),
    },
    cues: (Array.isArray(source.cues) ? source.cues : [])
      .slice(0, 20)
      .map((cue, index) => {
        const normalized = ENC.normalizeAudioTrack(cue, {
          name: `Cue ${index + 1}`,
          volume: 0.8,
        });
        return { ...normalized, loop: false };
      }),
  };
};


/*
 * Canonical prepared-presentation record for reusable encounters.
 * The legacy display/background/soundscape fields remain supported and are
 * mirrored for compatibility, but this object gives pre-game setup one
 * authoritative source that can be re-applied at load/phase boundaries.
 */
ENC.normalizeEncounterPresentation = function (presentation = {}, fallback = {}) {
  const source = presentation && typeof presentation === "object" ? presentation : {};
  const fallbackDisplay = fallback?.display && typeof fallback.display === "object"
    ? fallback.display
    : {};

  const hasScene = Object.prototype.hasOwnProperty.call(source, "sceneBackground");
  const hasCombat = Object.prototype.hasOwnProperty.call(source, "combatBackground");

  const sceneBackground = ENC.sanitizeAssetUrl(
    hasScene
      ? source.sceneBackground
      : (fallbackDisplay.sceneImage ?? fallback?.background ?? ""),
  );
  const combatBackground = ENC.sanitizeAssetUrl(
    hasCombat
      ? source.combatBackground
      : (fallbackDisplay.combatImage ?? fallback?.background ?? ""),
  );

  return {
    schemaVersion: 1,
    sceneBackground,
    combatBackground,
    soundscape: ENC.normalizeSoundscape(source.soundscape || fallback?.soundscape),
  };
};

ENC.applyEncounterPresentation = function (encounter) {
  if (!encounter || typeof encounter !== "object") return encounter;

  const presentation = ENC.normalizeEncounterPresentation(
    encounter.presentation,
    encounter,
  );

  encounter.presentation = ENC.deepClone(presentation);
  encounter.display = {
    ...(encounter.display || {}),
    sceneImage: presentation.sceneBackground,
    combatImage: presentation.combatBackground,
  };
  encounter.background = presentation.combatBackground;
  encounter.soundscape = ENC.deepClone(presentation.soundscape);
  return encounter;
};

ENC.createDefaultTimerConfig = function () {
  return {
    name: "Countdown",
    durationMs: 5 * 60 * 1000,
    skin: "hourglass",
    visibleToPlayers: false,
    showNumericToDM: true,
    showNumericToPlayers: false,
    displayMode: "overlay",
  };
};

ENC.normalizeTimerConfig = function (timer = {}) {
  const source = timer && typeof timer === "object" ? timer : {};
  const defaults = ENC.createDefaultTimerConfig();
  const maxDurationMs = (999 * 60 + 59) * 1000;
  const rawDuration = Math.round(
    ENC.finiteNumber(source.durationMs, defaults.durationMs),
  );

  return {
    name:
      String(source.name || defaults.name).trim().slice(0, 80) ||
      defaults.name,
    durationMs: Math.min(
      maxDurationMs,
      Math.max(1000, rawDuration),
    ),
    skin: ["hourglass", "candle", "scifi-pixels"].includes(source.skin)
      ? source.skin
      : defaults.skin,
    visibleToPlayers: source.visibleToPlayers === true,
    showNumericToDM: source.showNumericToDM !== false,
    showNumericToPlayers: source.showNumericToPlayers === true,
    displayMode: ["overlay", "featured", "focus"].includes(source.displayMode)
      ? source.displayMode
      : defaults.displayMode,
  };
};

ENC.isDefaultTimerConfig = function (timer = {}) {
  const current = ENC.normalizeTimerConfig(timer);
  const defaults = ENC.createDefaultTimerConfig();
  return Object.keys(defaults).every((key) => current[key] === defaults[key]);
};

ENC.normalizeTimerCheckpoint = function (timerState = null, timerConfig = {}) {
  if (!timerState || typeof timerState !== "object") return null;

  const prepared = ENC.normalizeTimerConfig(timerConfig);
  const stateConfig = ENC.normalizeTimerConfig(timerState);

  let durationMs = Math.max(1000, ENC.finiteNumber(timerState.durationMs, stateConfig.durationMs));
  let remainingMs = Math.max(0, ENC.finiteNumber(timerState.remainingMs, durationMs));

  if (remainingMs > durationMs) durationMs = remainingMs;

  let status = String(timerState.status || "idle");
  if (remainingMs <= 0 || status === "complete") {
    status = "complete";
    remainingMs = 0;
  } else if (status === "running" || status === "paused") {
    // A saved checkpoint never continues counting while the app is closed.
    status = "paused";
  } else {
    status = "idle";
  }

  return {
    id: "primary-timer",
    name: stateConfig.name || prepared.name,
    mode: "countdown",
    skin: stateConfig.skin || prepared.skin,
    durationMs,
    remainingMs,
    endAt: null,
    status,
    visibleToPlayers: stateConfig.visibleToPlayers,
    showNumericToDM: stateConfig.showNumericToDM,
    showNumericToPlayers: stateConfig.showNumericToPlayers,
    displayMode: stateConfig.displayMode,
  };
};

ENC.normalizeSettings = function (settings = {}) {
  const source = settings && typeof settings === "object" ? settings : {};
  const validModes = new Set(["simple", "standard", "advanced", "custom"]);
  const mode = validModes.has(source.mode) ? source.mode : "standard";
  const baseModules =
    mode !== "custom" && ENC.MODE_PRESETS[mode]
      ? ENC.MODE_PRESETS[mode]
      : ENC.MODE_PRESETS.standard;
  const rawModules =
    source.modules && typeof source.modules === "object" ? source.modules : {};
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
    uiTheme: ENC.normalizeUiTheme(source.uiTheme || "scifi"),
  };
};

ENC.createDefaultEncounter = function () {
  return {
    id: "active",
    kind: "active",
    sourceEncounterId: null,
    name: "New Encounter",
    systemId: "generic",
    customProfile: ENC.deepClone(ENC.DEFAULT_SETTINGS.customProfile),
    phase: "prepared",
    playerDisplayMode: "standby",
    round: 1,
    currentId: null,
    background: "",
    display: {
      sceneImage: "",
      combatImage: "",
    },
    soundscape: ENC.createDefaultSoundscape(),
    presentation: {
      schemaVersion: 1,
      sceneBackground: "",
      combatBackground: "",
      soundscape: ENC.createDefaultSoundscape(),
    },
    timer: ENC.createDefaultTimerConfig(),
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
    Boolean(encounter.display?.sceneImage) ||
    Boolean(encounter.display?.combatImage) ||
    Boolean(encounter.soundscape?.scene?.music?.asset) ||
    Boolean(encounter.soundscape?.combat?.music?.asset) ||
    Boolean(
      encounter.soundscape?.scene?.ambience?.some?.((track) => track.asset),
    ) ||
    !ENC.isDefaultTimerConfig(encounter.timer) ||
    String(encounter.name || "")
      .trim()
      .toLowerCase() !== "new encounter",
  );
};

ENC.getSystemProfile = function (systemId, customProfile = null) {
  const normalizedSystemId = ENC.normalizeSystemId(systemId);
  if (normalizedSystemId === "custom") {
    const profile = ENC.normalizeCustomProfile(
      customProfile || ENC.DEFAULT_SETTINGS.customProfile,
    );
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
  const usesMax =
    rawMax === "" || rawMax === null || rawMax === undefined
      ? ""
      : Math.max(0, ENC.finiteNumber(rawMax, 0));
  const usesRemaining =
    usesMax === ""
      ? ""
      : Math.min(
          usesMax,
          Math.max(0, ENC.finiteNumber(source.usesRemaining, usesMax)),
        );

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
  const max = Math.max(
    0,
    ENC.finiteNumber(source.max, ENC.finiteNumber(source.current, 0)),
  );
  const current = Math.min(
    max,
    Math.max(0, ENC.finiteNumber(source.current, 0)),
  );
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
    source.stats &&
    typeof source.stats === "object" &&
    !Array.isArray(source.stats)
      ? { ...source.stats }
      : {};

  for (const key of [
    "refDefense",
    "fortDefense",
    "willDefense",
    "damageThreshold",
  ]) {
    if (source[key] !== undefined && source[key] !== "")
      legacyStats[key] = source[key];
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
    abilities: Array.isArray(source.abilities)
      ? source.abilities.map(ENC.normalizeAbility)
      : [],
    resources: Array.isArray(source.resources)
      ? source.resources.map(ENC.normalizeResource)
      : [],
    notes: String(source.notes || ""),
    tags: Array.isArray(source.tags)
      ? source.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [],
    compendiumSource:
      source.compendiumSource && typeof source.compendiumSource === "object"
        ? {
            provider: String(source.compendiumSource.provider || ""),
            key: String(source.compendiumSource.key || ""),
            documentKey: String(source.compendiumSource.documentKey || ""),
            documentName: String(source.compendiumSource.documentName || ""),
            sourceUrl: String(source.compendiumSource.sourceUrl || ""),
            license: String(source.compendiumSource.license || ""),
          }
        : null,
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
    customProfile:
      source.customProfile ||
      customProfile ||
      ENC.DEFAULT_SETTINGS.customProfile,
  });
  let combatState = ENC.COMBAT_STATES.has(source.combatState)
    ? source.combatState
    : "active";
  if (combatState === "active" && source.delayed) combatState = "delayed";
  if (combatState === "active" && source.ready) combatState = "ready";
  const initiative = ENC.finiteNumber(source.initiative, 10);
  const createdOrder = ENC.finiteNumber(
    source.createdOrder,
    Date.now() + Math.random(),
  );
  const recoveryState = ENC.RECOVERY_STATES.has(source.recoveryState)
    ? source.recoveryState
    : "normal";
  const deathSaveSource =
    source.dnd5eDeathSaves && typeof source.dnd5eDeathSaves === "object"
      ? source.dnd5eDeathSaves
      : {};
  const dnd5eDeathSaves = {
    successes: Math.max(
      0,
      Math.min(
        3,
        Math.trunc(ENC.finiteNumber(deathSaveSource.successes, 0)),
      ),
    ),
    failures: Math.max(
      0,
      Math.min(
        3,
        Math.trunc(ENC.finiteNumber(deathSaveSource.failures, 0)),
      ),
    ),
  };
  // Alpha 3 HP model: combatants need both current HP and maximum HP so
  // the live Encounter meter can represent health accurately. Older records
  // may only contain `hp`; when that happens, treat the legacy value as the
  // best-known maximum rather than displaying a misleading percentage.
  const legacyHp = ENC.numericOrBlank(source.hp);
  const maxHp =
    normalized.maxHp === "" && legacyHp !== "" && ENC.finiteNumber(legacyHp, 0) > 0
      ? legacyHp
      : normalized.maxHp;
  const hp =
    source.hp === "" || source.hp === null || source.hp === undefined
      ? maxHp
      : legacyHp;

  return {
    ...normalized,
    maxHp,
    id: String(source.id || ENC.makeId("cmb")),
    sourceLibraryId: source.sourceLibraryId
      ? String(source.sourceLibraryId)
      : null,
    initiative,
    hp,
    conditionTrack: ENC.CONDITION_TRACK_VALUES.has(source.conditionTrack)
      ? source.conditionTrack
      : "Normal",

    dnd5eConditions: Array.isArray(source.dnd5eConditions)
      ? [
          ...new Set(
            source.dnd5eConditions
              .map((condition) => String(condition))
              .filter((condition) => ENC.DND5E_CONDITION_VALUES.has(condition)),
          ),
        ]
      : [],

    dnd5eExhaustion: Math.max(
      ENC.DND5E_EXHAUSTION_MIN,
      Math.min(
        ENC.DND5E_EXHAUSTION_MAX,
        Number.parseInt(source.dnd5eExhaustion, 10) || 0,
      ),
    ),

    recoveryState,
    dnd5eDeathSaves,

    visibleStatus: String(source.visibleStatus || ""),
    combatState,
    hidden: Boolean(source.hidden),
    delayed: combatState === "delayed",
    ready: combatState === "ready",
    createdOrder,
  };
};

ENC.resetCombatantTransientState = function (combatant = {}) {
  const source = combatant && typeof combatant === "object" ? combatant : {};
  return {
    ...source,
    hp: source.maxHp ?? source.hp ?? "",
    conditionTrack: "Normal",
    dnd5eConditions: [],
    dnd5eExhaustion: 0,
    recoveryState: "normal",
    dnd5eDeathSaves: { successes: 0, failures: 0 },
    visibleStatus: "",
    combatState: "active",
    delayed: false,
    ready: false,
  };
};

ENC.syncCombatantIdentityFromLibrary = function (combatant = {}, libraryEntry = {}) {
  const source = ENC.normalizeCombatant(combatant);
  const library = ENC.normalizeLibraryEntry(libraryEntry);

  return ENC.normalizeCombatant(
    {
      ...source,
      name: library.name,
      type: library.type,
      portrait: library.portrait,
      sourceLibraryId: source.sourceLibraryId || library.id,
    },
    source.systemId,
    source.customProfile,
  );
};

ENC.syncCombatantDetailsFromLibrary = function (combatant = {}, libraryEntry = {}) {
  const source = ENC.normalizeCombatant(combatant);
  const library = ENC.normalizeLibraryEntry(libraryEntry);

  // Library sync updates durable character data while preserving every piece
  // of live encounter state. In particular, Current HP is never reset merely
  // because Maximum HP changed in the Library.
  return ENC.normalizeCombatant(
    {
      ...source,
      name: library.name,
      type: library.type,
      systemId: library.systemId,
      customProfile: ENC.deepClone(library.customProfile),
      portrait: library.portrait,
      maxHp: library.maxHp,
      stats: ENC.deepClone(library.stats),
      abilities: ENC.deepClone(library.abilities),
      resources: ENC.deepClone(library.resources),
      notes: library.notes,
      tags: ENC.deepClone(library.tags),
      sourceLibraryId: source.sourceLibraryId || library.id,

      // Explicit live-state preservation.
      id: source.id,
      initiative: source.initiative,
      hp: source.hp,
      conditionTrack: source.conditionTrack,
      dnd5eConditions: ENC.deepClone(source.dnd5eConditions),
      dnd5eExhaustion: source.dnd5eExhaustion,
      recoveryState: source.recoveryState,
      dnd5eDeathSaves: ENC.deepClone(source.dnd5eDeathSaves),
      visibleStatus: source.visibleStatus,
      combatState: source.combatState,
      hidden: source.hidden,
      delayed: source.delayed,
      ready: source.ready,
      createdOrder: source.createdOrder,
    },
    library.systemId,
    library.customProfile,
  );
};

ENC.normalizeEncounter = function (encounter = {}) {
  const source = encounter && typeof encounter === "object" ? encounter : {};
  const kind = ["active", "preset", "saved"].includes(source.kind)
    ? source.kind
    : "active";
  const saveMode =
    kind === "saved" && source.saveMode === "state" ? "state" : kind === "saved" ? "template" : null;
  const systemId = ENC.normalizeSystemId(source.systemId || "generic");
  const customProfile = ENC.normalizeCustomProfile(source.customProfile);
  const combatants = Array.isArray(source.combatants)
    ? source.combatants.map((combatant) =>
        ENC.normalizeCombatant(combatant, systemId, customProfile),
      )
    : [];
  ENC.sortCombatants(combatants);

  const requestedCurrentId = source.currentId ? String(source.currentId) : null;
  const currentId = combatants.some(
    (combatant) => combatant.id === requestedCurrentId,
  )
    ? requestedCurrentId
    : null;
  const rawRound = Number(source.round);

  const legacyBackground = ENC.sanitizeAssetUrl(source.background);
  const displaySource =
    source.display && typeof source.display === "object" ? source.display : {};
  const hasCombatImage = Object.prototype.hasOwnProperty.call(
    displaySource,
    "combatImage",
  );
  const hasSceneImage = Object.prototype.hasOwnProperty.call(
    displaySource,
    "sceneImage",
  );
  const legacyCombatImage = ENC.sanitizeAssetUrl(
    hasCombatImage ? displaySource.combatImage : legacyBackground,
  );
  const legacySceneImage = ENC.sanitizeAssetUrl(
    hasSceneImage ? displaySource.sceneImage : legacyBackground,
  );
  const presentation = ENC.normalizeEncounterPresentation(source.presentation, {
    ...source,
    background: legacyCombatImage,
    display: {
      sceneImage: legacySceneImage,
      combatImage: legacyCombatImage,
    },
    soundscape: source.soundscape,
  });
  const combatImage = presentation.combatBackground;
  const sceneImage = presentation.sceneBackground;
  const phase = ENC.ENCOUNTER_PHASES.has(source.phase)
    ? source.phase
    : "prepared";
  const playerDisplayMode = ENC.PLAYER_DISPLAY_MODES.has(
    source.playerDisplayMode,
  )
    ? source.playerDisplayMode
    : "standby";
  const timer = ENC.normalizeTimerConfig(source.timer || source.timerConfig);
  const timerCheckpoint =
    kind === "saved" && saveMode === "state"
      ? ENC.normalizeTimerCheckpoint(source.timerCheckpoint, timer)
      : null;

  return {
    id: String(
      source.id ||
        (kind === "active"
          ? "active"
          : ENC.makeId(kind === "saved" ? "enc" : "preset")),
    ),
    kind,
    saveMode,
    sourceEncounterId: source.sourceEncounterId
      ? String(source.sourceEncounterId)
      : null,
    name:
      String(
        source.name ||
          (kind === "active" ? "New Encounter" : "Saved Encounter"),
      ).trim() || "Encounter",
    systemId,
    customProfile,
    phase,
    playerDisplayMode,
    round: Number.isFinite(rawRound) ? Math.max(1, Math.trunc(rawRound)) : 1,
    currentId,
    background: combatImage,
    display: {
      sceneImage,
      combatImage,
    },
    soundscape: ENC.deepClone(presentation.soundscape),
    presentation: ENC.deepClone(presentation),
    timer,
    timerCheckpoint,
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
    return (
      ENC.finiteNumber(a.createdOrder, 0) - ENC.finiteNumber(b.createdOrder, 0)
    );
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
  const currentIndex = all.findIndex(
    (combatant) => combatant.id === requestedId,
  );
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
ENC.calculateTurnMove = function (
  combatants,
  currentId,
  round = 1,
  direction = 1,
) {
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
  const currentIndex = all.findIndex(
    (combatant) => combatant.id === requestedId,
  );

  if (currentIndex < 0) {
    const candidate =
      moveDirection > 0
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
      const usesMax =
        usesRaw === "" ? "" : Math.max(0, ENC.finiteNumber(usesRaw, 0));
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
