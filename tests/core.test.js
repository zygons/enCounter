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
