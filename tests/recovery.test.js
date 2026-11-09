/*
 * Copyright (C) 2026 Zygons
 * SPDX-License-Identifier: MIT
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

function loadRecoveryHarness() {
  let uuid = 0;
  const toasts = [];
  const context = {
    console,
    Date,
    Math,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Set,
    Map,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    structuredClone: (value) => JSON.parse(JSON.stringify(value)),
    crypto: {
      randomUUID() {
        uuid += 1;
        return `00000000-0000-4000-8000-${String(uuid).padStart(12, "0")}`;
      },
    },
    prompt: () => "1",
    document: {},
  };
  context.window = context;
  context.window.location = { origin: "http://127.0.0.1:5500" };
  context.ENC = {};
  vm.createContext(context);
  vm.runInContext(read("programs/app/js/core/config.js"), context);
  vm.runInContext(read("programs/app/js/modules/combat.js"), context);

  context.ENC.app = {
    toast(message) {
      toasts.push(message);
    },
  };
  context.ENC.combat.save = async () => {};
  context.ENC.combat.render = () => {};
  context.ENC.combat.followCurrentTurn = () => {};

  return { context, ENC: context.ENC, toasts };
}

test("D&D player reaching 0 HP automatically becomes Downed and remains active", async () => {
  const { ENC } = loadRecoveryHarness();
  const combatant = ENC.normalizeCombatant({
    id: "cleric",
    name: "Cleric",
    type: "player",
    systemId: "dnd5e",
    maxHp: 20,
    hp: 5,
    combatState: "active",
  });
  ENC.combat.encounter = ENC.normalizeEncounter({
    currentId: "cleric",
    combatants: [combatant],
  });
  const current = ENC.combat.encounter.combatants[0];

  await ENC.combat.setHp(current, 0);

  assert.equal(current.hp, 0);
  assert.equal(current.recoveryState, "downed");
  assert.equal(current.combatState, "active");
  assert.equal(ENC.isTurnEligibleCombatant(current), true);
  assert.equal(current.dnd5eConditions.includes("Unconscious"), true);
  assert.equal(current.dnd5eDeathSaves.successes, 0);
  assert.equal(current.dnd5eDeathSaves.failures, 0);
});

test("D&D death-save failures mark the combatant Dead and remove normal initiative eligibility", async () => {
  const { ENC } = loadRecoveryHarness();
  ENC.combat.encounter = ENC.normalizeEncounter({
    currentId: "cleric",
    combatants: [
      {
        id: "cleric",
        name: "Cleric",
        type: "player",
        systemId: "dnd5e",
        maxHp: 20,
        hp: 0,
        combatState: "active",
        recoveryState: "downed",
        dnd5eConditions: ["Unconscious"],
      },
    ],
  });
  const current = ENC.combat.encounter.combatants[0];

  await ENC.combat.recordDnd5eDeathSave(current, { failures: 1 });
  await ENC.combat.recordDnd5eDeathSave(current, { failures: 2 });

  assert.equal(current.recoveryState, "dead");
  assert.equal(current.combatState, "inactive");
  assert.equal(ENC.combat.encounter.currentId, null);
  assert.equal(ENC.isTurnEligibleCombatant(current), false);
});

test("damage at 0 HP records a D&D death-save failure", async () => {
  const { ENC } = loadRecoveryHarness();
  ENC.combat.encounter = ENC.normalizeEncounter({
    currentId: "cleric",
    combatants: [
      {
        id: "cleric",
        name: "Cleric",
        type: "player",
        systemId: "dnd5e",
        maxHp: 20,
        hp: 0,
        combatState: "active",
        recoveryState: "downed",
        dnd5eConditions: ["Unconscious"],
      },
    ],
  });
  const current = ENC.combat.encounter.combatants[0];

  await ENC.combat.changeHp(current, -1);

  assert.equal(current.hp, 0);
  assert.equal(current.dnd5eDeathSaves.failures, 1);
});

test("Return to Combat can revive a Dead combatant with restored HP", async () => {
  const { context, ENC } = loadRecoveryHarness();
  context.prompt = () => "4";
  ENC.combat.encounter = ENC.normalizeEncounter({
    combatants: [
      {
        id: "hero",
        name: "Hero",
        type: "player",
        systemId: "dnd5e",
        maxHp: 20,
        hp: 0,
        combatState: "inactive",
        recoveryState: "dead",
      },
    ],
  });
  const combatant = ENC.combat.encounter.combatants[0];

  await ENC.combat.returnCombatantToCombat(combatant, false);

  assert.equal(combatant.hp, 4);
  assert.equal(combatant.recoveryState, "normal");
  assert.equal(combatant.combatState, "active");
  assert.equal(ENC.isTurnEligibleCombatant(combatant), true);
});

test("SWSE manual Downed state uses Helpless and Return to Combat moves off Helpless", async () => {
  const { context, ENC } = loadRecoveryHarness();
  context.prompt = () => "3";
  ENC.combat.encounter = ENC.normalizeEncounter({
    combatants: [
      {
        id: "swse-hero",
        name: "SWSE Hero",
        type: "player",
        systemId: "swse",
        maxHp: 30,
        hp: 10,
        combatState: "active",
        conditionTrack: "Normal",
      },
    ],
  });
  const combatant = ENC.combat.encounter.combatants[0];

  await ENC.combat.setRecoveryState(combatant, "downed");
  assert.equal(combatant.hp, 0);
  assert.equal(combatant.recoveryState, "downed");
  assert.equal(combatant.conditionTrack, "Helpless");

  await ENC.combat.returnCombatantToCombat(combatant, false);
  assert.equal(combatant.hp, 3);
  assert.equal(combatant.recoveryState, "normal");
  assert.equal(combatant.conditionTrack, "-10");
});

test("full Library sync preserves live recovery and death-save state", () => {
  const { ENC } = loadRecoveryHarness();
  const live = ENC.normalizeCombatant({
    id: "cleric",
    sourceLibraryId: "library-cleric",
    name: "Cleric",
    type: "player",
    systemId: "dnd5e",
    maxHp: 50,
    hp: 0,
    initiative: 14,
    combatState: "active",
    recoveryState: "downed",
    dnd5eConditions: ["Unconscious"],
    dnd5eDeathSaves: { successes: 1, failures: 2 },
  });
  const library = ENC.normalizeLibraryEntry({
    id: "library-cleric",
    name: "Cleric Updated",
    type: "player",
    systemId: "dnd5e",
    maxHp: 60,
    stats: { armorClass: 18 },
  });

  const synced = ENC.syncCombatantDetailsFromLibrary(live, library);

  assert.equal(synced.name, "Cleric Updated");
  assert.equal(synced.maxHp, 60);
  assert.equal(synced.hp, 0);
  assert.equal(synced.recoveryState, "downed");
  assert.equal(synced.dnd5eDeathSaves.successes, 1);
  assert.equal(synced.dnd5eDeathSaves.failures, 2);
});

test("recovery UI, styling, and Player Display integration are present", () => {
  const html = read("programs/app/index.html");
  const css = read("programs/app/css/workspace-layout.css");
  const combat = read("programs/app/js/modules/combat.js");
  const display = read("programs/app/js/display.js");
  const displayHtml = read("programs/app/display.html");

  assert.match(html, /id="currentTurnRecoveryBtn"/);
  assert.match(html, /id="currentTurnDeathSavePanel"/);
  assert.match(html, /id="currentTurnReturnCombatBtn"/);
  assert.match(css, /\.current-turn-recovery-panel/);
  assert.match(css, /\.combatant-status-badge\.recovery-downed/);
  assert.match(combat, /rollDnd5eDeathSave/);
  assert.match(combat, /returnCombatantToCombat/);
  assert.match(display, /recoveryState/);
  assert.match(displayHtml, /js\/display\.js\?v=alpha3-recovery-1/);
});
