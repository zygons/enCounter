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

  const configPath = path.join(root, "programs/app/js/core/config.js");
  vm.runInContext(fs.readFileSync(configPath, "utf8"), context, {
    filename: configPath,
  });
  return window.ENC;
}

const ENC = loadConfig();

test("linked identity sync refreshes portrait/name/type but preserves live values", () => {
  const combatant = ENC.normalizeCombatant({
    id: "cmb-1",
    sourceLibraryId: "lib-1",
    name: "Old Goblin",
    type: "enemy",
    systemId: "dnd5e",
    portrait: "/assets/portraits/enemies/old.png",
    maxHp: 12,
    hp: 4,
    initiative: 17,
    dnd5eConditions: ["Prone"],
    dnd5eExhaustion: 2,
    visibleStatus: "Bloodied",
    combatState: "active",
  });

  const library = ENC.normalizeLibraryEntry({
    id: "lib-1",
    name: "Goblin Scout",
    type: "creature",
    systemId: "dnd5e",
    portrait: "/assets/portraits/enemies/new.png",
    maxHp: 30,
  });

  const synced = ENC.syncCombatantIdentityFromLibrary(combatant, library);
  assert.equal(synced.name, "Goblin Scout");
  assert.equal(synced.type, "creature");
  assert.equal(synced.portrait, "/assets/portraits/enemies/new.png");
  assert.equal(synced.hp, 4);
  assert.equal(synced.maxHp, 12);
  assert.equal(synced.initiative, 17);
  assert.deepEqual([...synced.dnd5eConditions], ["Prone"]);
  assert.equal(synced.dnd5eExhaustion, 2);
  assert.equal(synced.visibleStatus, "Bloodied");
});

test("full Library sync updates durable stats and max HP while preserving live combat state", () => {
  const combatant = ENC.normalizeCombatant({
    id: "cmb-2",
    sourceLibraryId: "lib-2",
    name: "Fighter",
    type: "player",
    systemId: "dnd5e",
    maxHp: 40,
    hp: 11,
    initiative: 19,
    stats: { ac: 16 },
    dnd5eConditions: ["Poisoned"],
    dnd5eExhaustion: 1,
    visibleStatus: "Concentrating",
    hidden: true,
    combatState: "ready",
    ready: true,
  });

  const library = ENC.normalizeLibraryEntry({
    id: "lib-2",
    name: "Fighter Updated",
    type: "player",
    systemId: "dnd5e",
    maxHp: 55,
    portrait: "/assets/portraits/players/fighter.png",
    stats: { ac: 19 },
    abilities: [{ name: "Second Wind", text: "Recover HP" }],
    notes: "Updated library notes",
  });

  const synced = ENC.syncCombatantDetailsFromLibrary(combatant, library);
  assert.equal(synced.name, "Fighter Updated");
  assert.equal(synced.maxHp, 55);
  assert.equal(synced.hp, 11);
  assert.equal(synced.initiative, 19);
  assert.equal(synced.stats.ac, 19);
  assert.equal(synced.portrait, "/assets/portraits/players/fighter.png");
  assert.deepEqual([...synced.dnd5eConditions], ["Poisoned"]);
  assert.equal(synced.dnd5eExhaustion, 1);
  assert.equal(synced.visibleStatus, "Concentrating");
  assert.equal(synced.hidden, true);
  assert.equal(synced.combatState, "ready");
  assert.equal(synced.ready, true);
});

test("Encounter UI exposes linked status and explicit full sync action", () => {
  const combat = read("programs/app/js/modules/combat.js");
  const css = read("programs/app/css/base.css");

  assert.match(combat, /combatant-library-link-badge/);
  assert.match(combat, /Library linked/);
  assert.match(combat, /Sync from Library/);
  assert.match(combat, /syncCombatantFromLibrary/);
  assert.match(css, /\.combatant-library-link-badge/);
});

test("saving a Library entry automatically refreshes linked combatant identity", () => {
  const library = read("programs/app/js/modules/library.js");
  assert.match(library, /syncLinkedLibraryEntry/);
  assert.match(library, /full: true/);
  assert.match(read("programs/app/js/modules/combat.js"), /syncLinkedLibraryEntry/);
});
