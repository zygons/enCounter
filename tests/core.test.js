/*
 * Copyright (C) 2026 Zygons
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadConfig() {
  let uuidCounter = 0;
  const window = {
    ENC: {},
    location: { origin: "http://127.0.0.1:5500" },
    crypto: {
      randomUUID() {
        uuidCounter += 1;
        return `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, "0")}`;
      },
    },
  };

  const context = vm.createContext({
    window,
    URL,
    console,
    setTimeout,
    clearTimeout,
    Date,
    Math,
    JSON,
  });

  const configPath = path.join(
    __dirname,
    "..",
    "programs",
    "app",
    "js",
    "core",
    "config.js",
  );
  vm.runInContext(fs.readFileSync(configPath, "utf8"), context, {
    filename: configPath,
  });
  return window.ENC;
}

const ENC = loadConfig();

test("sortCombatants orders by descending initiative and created order", () => {
  const combatants = [
    { id: "b", initiative: 10, createdOrder: 2 },
    { id: "c", initiative: 15, createdOrder: 3 },
    { id: "a", initiative: 10, createdOrder: 1 },
  ];

  ENC.sortCombatants(combatants);
  assert.deepEqual(combatants.map((item) => item.id), ["c", "a", "b"]);
});

test("normalizeCombatant repairs invalid imported state", () => {
  const normalized = ENC.normalizeCombatant({
    id: "test",
    name: "Imported",
    type: "not-a-type",
    combatState: "mystery",
    initiative: "not-a-number",
    maxHp: "22",
    hp: "999",
    portrait: "https://example.com/not-local.png",
  });

  assert.equal(normalized.type, "npc");
  assert.equal(normalized.combatState, "active");
  assert.equal(normalized.initiative, 10);
  assert.equal(normalized.maxHp, 22);
  assert.equal(normalized.hp, 999);
  assert.equal(normalized.portrait, "");
});

test("normalizeEncounter clamps round, sanitizes background, and removes missing current id", () => {
  const encounter = ENC.normalizeEncounter({
    round: -4,
    currentId: "missing",
    background: "https://example.com/background.png",
    combatants: [{ id: "one", name: "One", initiative: 12 }],
  });

  assert.equal(encounter.round, 1);
  assert.equal(encounter.currentId, null);
  assert.equal(encounter.background, "");
  assert.equal(encounter.combatants.length, 1);
});

test("sanitizeAssetUrl accepts supported local assets and rejects external URLs", () => {
  assert.equal(
    ENC.sanitizeAssetUrl("/assets/portraits/players/test.png"),
    "/assets/portraits/players/test.png",
  );
  assert.equal(ENC.sanitizeAssetUrl("https://example.com/test.png"), "");
  assert.equal(ENC.sanitizeAssetUrl("/programs/app/index.html"), "");
});

test("calculateTurnMove skips defeated, delayed, and readied combatants", () => {
  const combatants = [
    { id: "a", combatState: "active", delayed: false, ready: false },
    { id: "b", combatState: "defeated", delayed: false, ready: false },
    { id: "c", combatState: "delayed", delayed: true, ready: false },
    { id: "d", combatState: "ready", delayed: false, ready: true },
    { id: "e", combatState: "active", delayed: false, ready: false },
  ];

  const transition = ENC.calculateTurnMove(combatants, "a", 2, 1);
  assert.equal(transition.moved, true);
  assert.equal(transition.currentId, "e");
  assert.equal(transition.round, 2);
  assert.equal(transition.wrapped, false);
});

test("calculateTurnMove increments the round after wrapping forward", () => {
  const combatants = [
    { id: "a", combatState: "active", delayed: false, ready: false },
    { id: "b", combatState: "active", delayed: false, ready: false },
  ];

  const transition = ENC.calculateTurnMove(combatants, "b", 3, 1);
  assert.equal(transition.currentId, "a");
  assert.equal(transition.round, 4);
  assert.equal(transition.wrapped, true);
});

test("calculateTurnMove decrements the round after wrapping backward without going below one", () => {
  const combatants = [
    { id: "a", combatState: "active", delayed: false, ready: false },
    { id: "b", combatState: "active", delayed: false, ready: false },
  ];

  const transition = ENC.calculateTurnMove(combatants, "a", 2, -1);
  assert.equal(transition.currentId, "b");
  assert.equal(transition.round, 1);
  assert.equal(transition.wrapped, true);

  const atRoundOne = ENC.calculateTurnMove(combatants, "a", 1, -1);
  assert.equal(atRoundOne.round, 1);
});

test("calculateTurnMove reports no move when normal initiative has no eligible combatants", () => {
  const combatants = [
    { id: "a", combatState: "defeated", delayed: false, ready: false },
    { id: "b", combatState: "ready", delayed: false, ready: true },
  ];

  const transition = ENC.calculateTurnMove(combatants, "a", 5, 1);
  assert.equal(transition.moved, false);
  assert.equal(transition.currentId, "a");
  assert.equal(transition.round, 5);
});


test("player-visible combatants omit hidden entries completely", () => {
  const combatants = [
    { id: "visible-a", hidden: false },
    { id: "hidden-b", hidden: true },
    { id: "visible-c", hidden: false },
  ];

  const visible = ENC.getPlayerVisibleCombatants(combatants);
  assert.deepEqual(visible.map((item) => item.id), ["visible-a", "visible-c"]);
});

test("player display next-turn helper skips hidden and ineligible combatants", () => {
  const combatants = [
    { id: "a", hidden: false, combatState: "active", delayed: false, ready: false },
    { id: "hidden", hidden: true, combatState: "active", delayed: false, ready: false },
    { id: "defeated", hidden: false, combatState: "defeated", delayed: false, ready: false },
    { id: "d", hidden: false, combatState: "active", delayed: false, ready: false },
  ];

  const next = ENC.findNextPlayerVisibleEligibleCombatant(combatants, "a");
  assert.equal(next?.id, "d");
});

test("player display next-turn helper can advance from a hidden current combatant", () => {
  const combatants = [
    { id: "a", hidden: false, combatState: "active", delayed: false, ready: false },
    { id: "hidden", hidden: true, combatState: "active", delayed: false, ready: false },
    { id: "c", hidden: false, combatState: "active", delayed: false, ready: false },
  ];

  const next = ENC.findNextPlayerVisibleEligibleCombatant(combatants, "hidden");
  assert.equal(next?.id, "c");
});

test("sanitizeAudioUrl accepts only local supported sound assets", () => {
  assert.equal(
    ENC.sanitizeAudioUrl("/assets/sounds/ambience/forest.mp3"),
    "/assets/sounds/ambience/forest.mp3",
  );
  assert.equal(ENC.sanitizeAudioUrl("https://example.com/forest.mp3"), "");
  assert.equal(ENC.sanitizeAudioUrl("/assets/backgrounds/forest.mp3"), "");
});

test("normalizeEncounter preserves scene/combat display modes and soundscape", () => {
  const encounter = ENC.normalizeEncounter({
    kind: "saved",
    phase: "scene",
    playerDisplayMode: "scene",
    display: {
      sceneImage: "/assets/backgrounds/fantasy/market.png",
      combatImage: "/assets/backgrounds/fantasy/battle.png",
    },
    soundscape: {
      masterVolume: 0.75,
      scene: {
        ambience: [
          {
            name: "Market",
            asset: "/assets/sounds/ambience/market.mp3",
            volume: 0.5,
            combatBehavior: "duck",
            combatVolume: 0.2,
          },
        ],
      },
      combat: {
        music: {
          name: "Battle",
          asset: "/assets/sounds/music/battle.mp3",
          volume: 0.6,
        },
      },
    },
  });

  assert.equal(encounter.kind, "saved");
  assert.equal(encounter.phase, "scene");
  assert.equal(encounter.playerDisplayMode, "scene");
  assert.equal(encounter.display.sceneImage, "/assets/backgrounds/fantasy/market.png");
  assert.equal(encounter.soundscape.scene.ambience[0].combatBehavior, "duck");
  assert.equal(encounter.soundscape.combat.music.asset, "/assets/sounds/music/battle.mp3");
});

test("normalizeCombatant keeps valid 5E conditions, removes duplicates, and clamps Exhaustion", () => {
  const normalized = ENC.normalizeCombatant({
    id: "fighter",
    name: "Fighter",
    systemId: "dnd5e",
    dnd5eConditions: [
      "Prone",
      "Poisoned",
      "Prone",
      "Made Up Condition",
    ],
    dnd5eExhaustion: 99,
  });

  assert.deepEqual(Array.from(normalized.dnd5eConditions), ["Prone", "Poisoned"]);
  assert.equal(normalized.dnd5eExhaustion, 6);
});

test("normalizeCombatant defaults invalid negative 5E Exhaustion to zero", () => {
  const normalized = ENC.normalizeCombatant({
    id: "fighter",
    name: "Fighter",
    systemId: "dnd5e",
    dnd5eExhaustion: -4,
  });

  assert.equal(normalized.dnd5eExhaustion, 0);
});

test("resetCombatantTransientState clears reusable encounter combat state", () => {
  const reset = ENC.resetCombatantTransientState({
    id: "fighter",
    maxHp: 42,
    hp: 11,
    conditionTrack: "-5",
    dnd5eConditions: ["Prone", "Poisoned"],
    dnd5eExhaustion: 2,
    visibleStatus: "Concentrating",
    combatState: "defeated",
    delayed: true,
    ready: true,
    hidden: true,
  });

  assert.equal(reset.hp, 42);
  assert.equal(reset.conditionTrack, "Normal");
  assert.deepEqual(Array.from(reset.dnd5eConditions), []);
  assert.equal(reset.dnd5eExhaustion, 0);
  assert.equal(reset.visibleStatus, "");
  assert.equal(reset.combatState, "active");
  assert.equal(reset.delayed, false);
  assert.equal(reset.ready, false);
  assert.equal(reset.hidden, true);
});

test("normalizeEncounter preserves prepared Timer configuration but drops runtime state", () => {
  const encounter = ENC.normalizeEncounter({
    timer: {
      name: "Reinforcements",
      durationMs: 600000,
      skin: "scifi-pixels",
      visibleToPlayers: true,
      showNumericToDM: true,
      showNumericToPlayers: false,
      displayMode: "featured",
      status: "running",
      remainingMs: 12345,
      endAt: Date.now() + 12345,
    },
  });

  assert.deepEqual(JSON.parse(JSON.stringify(encounter.timer)), {
    name: "Reinforcements",
    durationMs: 600000,
    skin: "scifi-pixels",
    visibleToPlayers: true,
    showNumericToDM: true,
    showNumericToPlayers: false,
    displayMode: "featured",
  });
  assert.equal(Object.hasOwn(encounter.timer, "status"), false);
  assert.equal(Object.hasOwn(encounter.timer, "remainingMs"), false);
  assert.equal(Object.hasOwn(encounter.timer, "endAt"), false);
});


test("legacy saved encounters default to reusable template mode", () => {
  const encounter = ENC.normalizeEncounter({
    kind: "saved",
    name: "Legacy Encounter",
  });

  assert.equal(encounter.saveMode, "template");
  assert.equal(encounter.timerCheckpoint, null);
});

test("saved encounter state preserves live combat progress during normalization", () => {
  const encounter = ENC.normalizeEncounter({
    kind: "saved",
    saveMode: "state",
    phase: "combat",
    playerDisplayMode: "combat",
    round: 4,
    currentId: "fighter",
    combatants: [
      {
        id: "fighter",
        name: "Fighter",
        systemId: "dnd5e",
        maxHp: 42,
        hp: 11,
        initiative: 18,
        dnd5eConditions: ["Prone", "Poisoned"],
        dnd5eExhaustion: 2,
        visibleStatus: "Concentrating",
        combatState: "active",
      },
    ],
  });

  assert.equal(encounter.saveMode, "state");
  assert.equal(encounter.phase, "combat");
  assert.equal(encounter.round, 4);
  assert.equal(encounter.currentId, "fighter");
  assert.equal(encounter.combatants[0].hp, 11);
  assert.deepEqual(Array.from(encounter.combatants[0].dnd5eConditions), [
    "Prone",
    "Poisoned",
  ]);
  assert.equal(encounter.combatants[0].dnd5eExhaustion, 2);
  assert.equal(encounter.combatants[0].visibleStatus, "Concentrating");
});

test("saved running timer checkpoints restore paused at the saved remaining time", () => {
  const encounter = ENC.normalizeEncounter({
    kind: "saved",
    saveMode: "state",
    timer: {
      name: "Reinforcements",
      durationMs: 600000,
      skin: "scifi-pixels",
      visibleToPlayers: true,
      showNumericToDM: true,
      showNumericToPlayers: false,
      displayMode: "featured",
    },
    timerCheckpoint: {
      name: "Reinforcements",
      durationMs: 600000,
      remainingMs: 272000,
      status: "running",
      endAt: Date.now() + 272000,
      skin: "scifi-pixels",
      visibleToPlayers: true,
      showNumericToDM: true,
      showNumericToPlayers: false,
      displayMode: "featured",
    },
  });

  assert.equal(encounter.timerCheckpoint.status, "paused");
  assert.equal(encounter.timerCheckpoint.remainingMs, 272000);
  assert.equal(encounter.timerCheckpoint.endAt, null);
});


test("normalizeEncounter preserves intentionally blank scene/combat image fields independently", () => {
  const encounter = ENC.normalizeEncounter({
    background: "/assets/backgrounds/custom/legacy.png",
    display: {
      sceneImage: "",
      combatImage: "/assets/backgrounds/custom/battle.png",
    },
  });

  assert.equal(encounter.display.sceneImage, "");
  assert.equal(
    encounter.display.combatImage,
    "/assets/backgrounds/custom/battle.png",
  );
});

test("prepared presentation becomes the canonical scene/combat media source", () => {
  const normalized = ENC.normalizeEncounter({
    id: "prepared-media",
    kind: "saved",
    saveMode: "template",
    name: "Prepared Media",
    display: {
      sceneImage: "/assets/backgrounds/custom/old-scene.png",
      combatImage: "/assets/backgrounds/custom/old-combat.png",
    },
    soundscape: ENC.createDefaultSoundscape(),
    presentation: {
      schemaVersion: 1,
      sceneBackground: "/assets/backgrounds/custom/new-scene.png",
      combatBackground: "/assets/backgrounds/custom/new-combat.png",
      soundscape: {
        scene: {
          music: { asset: "/assets/sounds/music/scene.mp3", volume: 0.35 },
          ambience: [],
        },
        combat: {
          music: { asset: "/assets/sounds/music/combat.mp3", volume: 0.65 },
          ambience: [],
        },
      },
    },
  });

  assert.equal(normalized.display.sceneImage, "/assets/backgrounds/custom/new-scene.png");
  assert.equal(normalized.display.combatImage, "/assets/backgrounds/custom/new-combat.png");
  assert.equal(normalized.soundscape.scene.music.asset, "/assets/sounds/music/scene.mp3");
  assert.equal(normalized.soundscape.combat.music.asset, "/assets/sounds/music/combat.mp3");
  assert.equal(normalized.presentation.sceneBackground, normalized.display.sceneImage);
});

test("legacy encounter media is promoted into prepared presentation", () => {
  const normalized = ENC.normalizeEncounter({
    id: "legacy-media",
    kind: "saved",
    saveMode: "template",
    display: {
      sceneImage: "/assets/backgrounds/custom/scene.png",
      combatImage: "/assets/backgrounds/custom/combat.png",
    },
    soundscape: {
      scene: { music: { asset: "/assets/sounds/music/scene.mp3" }, ambience: [] },
      combat: { music: { asset: "/assets/sounds/music/combat.mp3" }, ambience: [] },
    },
  });

  assert.equal(normalized.presentation.sceneBackground, "/assets/backgrounds/custom/scene.png");
  assert.equal(normalized.presentation.combatBackground, "/assets/backgrounds/custom/combat.png");
  assert.equal(normalized.presentation.soundscape.scene.music.asset, "/assets/sounds/music/scene.mp3");
});
