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

function loadConfigAndCombat() {
  let uuid = 0;
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
    document: {},
  };
  context.window = context;
  context.window.location = { origin: "http://127.0.0.1:5500" };
  context.ENC = {};
  vm.createContext(context);
  vm.runInContext(read("programs/app/js/core/config.js"), context);
  vm.runInContext(read("programs/app/js/modules/combat.js"), context);
  return context;
}

test("full linked sync refreshes durable Library data while preserving live combat state", async () => {
  const context = loadConfigAndCombat();
  const { ENC } = context;
  let saved = null;

  ENC.libraryUI = {
    entries: [
      ENC.normalizeLibraryEntry({
        id: "lib-hero",
        name: "Cleric Updated",
        type: "player",
        systemId: "dnd5e",
        portrait: "/assets/portraits/players/cleric-new.png",
        maxHp: 60,
        stats: { armorClass: 19 },
        notes: "Current Library data",
      }),
    ],
  };
  ENC.db = {
    async saveActiveEncounter(encounter) {
      saved = ENC.deepClone(encounter);
    },
    async getAll() { return ENC.libraryUI.entries; },
  };
  ENC.sync = { broadcast() {} };

  ENC.combat.encounter = ENC.normalizeEncounter({
    name: "Run",
    combatants: [{
      id: "cmb-hero",
      sourceLibraryId: "lib-hero",
      name: "Cleric",
      type: "player",
      systemId: "dnd5e",
      portrait: "/assets/portraits/players/cleric-old.png",
      maxHp: 50,
      hp: 17,
      initiative: 21,
      stats: { armorClass: 16 },
      dnd5eConditions: ["Poisoned"],
      dnd5eExhaustion: 2,
      visibleStatus: "Concentrating",
      combatState: "ready",
      ready: true,
    }],
  });

  const changed = await ENC.combat.syncLinkedIdentities({
    full: true,
    persist: true,
    broadcast: false,
  });

  assert.equal(changed, 1);
  const combatant = ENC.combat.encounter.combatants[0];
  assert.equal(combatant.name, "Cleric Updated");
  assert.equal(combatant.maxHp, 60);
  assert.equal(combatant.stats.armorClass, 19);
  assert.equal(combatant.portrait, "/assets/portraits/players/cleric-new.png");
  assert.equal(combatant.hp, 17);
  assert.equal(combatant.initiative, 21);
  assert.deepEqual([...combatant.dnd5eConditions], ["Poisoned"]);
  assert.equal(combatant.dnd5eExhaustion, 2);
  assert.equal(combatant.visibleStatus, "Concentrating");
  assert.equal(combatant.combatState, "ready");
  assert.equal(combatant.ready, true);
  assert.ok(saved);
});

test("provider + key sync links an encounter-only Compendium creature to its exact Library copy", async () => {
  const context = loadConfigAndCombat();
  const { ENC } = context;

  const library = ENC.normalizeLibraryEntry({
    id: "lib-goblin",
    name: "Goblin",
    type: "creature",
    systemId: "dnd5e",
    maxHp: 7,
    portrait: "/assets/portraits/enemies/goblin-custom.png",
    compendiumSource: {
      provider: "dnd5eapi-srd-2014",
      key: "goblin",
      documentKey: "srd-2014",
    },
  });
  ENC.libraryUI = { entries: [library] };
  ENC.db = {
    async saveActiveEncounter() {},
    async getAll() { return [library]; },
  };
  ENC.sync = { broadcast() {} };

  ENC.combat.encounter = ENC.normalizeEncounter({
    name: "Run",
    combatants: [{
      id: "cmb-goblin",
      sourceLibraryId: null,
      name: "Goblin",
      type: "creature",
      systemId: "dnd5e",
      hp: 3,
      maxHp: 7,
      initiative: 14,
      compendiumSource: {
        provider: "dnd5eapi-srd-2014",
        key: "goblin",
        documentKey: "srd-2014",
      },
    }],
  });

  const changed = await ENC.combat.syncLinkedIdentities({
    full: true,
    persist: true,
    broadcast: false,
  });

  assert.equal(changed, 1);
  const combatant = ENC.combat.encounter.combatants[0];
  assert.equal(combatant.sourceLibraryId, "lib-goblin");
  assert.equal(combatant.portrait, "/assets/portraits/enemies/goblin-custom.png");
  assert.equal(combatant.hp, 3);
  assert.equal(combatant.initiative, 14);
});

test("asset reference scan protects Library, Template, State, active Run, and Recovery Snapshot uses", async () => {
  const target = "/assets/portraits/enemies/goblin.png";
  const data = {
    library: [{ id: "lib-1", name: "Goblin", portrait: target }],
    encounters: [
      { id: "active", kind: "active", name: "Active Run", combatants: [{ portrait: target }] },
      { id: "tpl", kind: "saved", saveMode: "template", name: "Goblin Template", combatants: [{ portrait: target }] },
      { id: "state", kind: "saved", saveMode: "state", name: "Goblin State", combatants: [{ portrait: target }] },
    ],
    snapshots: [{ id: 1, createdAt: "2026-11-06T12:00:00Z", encounter: { name: "Recovery Run", combatants: [{ portrait: target }] } }],
  };
  const context = {
    console,
    URL,
    URLSearchParams,
    window: { location: { origin: "http://127.0.0.1:5500" } },
    document: {},
    fetch: async () => { throw new Error("not used"); },
    ENC: {
      db: { async getAll(store) { return data[store] || []; } },
      combat: { encounter: { name: "Live Run", combatants: [{ portrait: target }] } },
    },
  };
  vm.createContext(context);
  vm.runInContext(read("programs/app/js/modules/assets.js"), context);

  const refs = await context.ENC.assets.findReferences(target);
  assert.ok(refs.some((ref) => ref.startsWith("Character Library: Goblin")));
  assert.ok(refs.some((ref) => ref.startsWith("Active Encounter: Active Run")));
  assert.ok(refs.some((ref) => ref.startsWith("Encounter Template: Goblin Template")));
  assert.ok(refs.some((ref) => ref.startsWith("Saved Encounter State: Goblin State")));
  assert.ok(refs.some((ref) => ref.startsWith("Current Run Encounter: Live Run")));
  assert.ok(refs.some((ref) => ref.startsWith("Recovery Snapshot: Recovery Run")));
});

test("Library portrait deletion uses the complete Asset Library reference scan", () => {
  const library = read("programs/app/js/modules/library.js");
  assert.match(library, /ENC\.assets\.findReferences\(portrait\)/);
  assert.match(library, /Recovery[\s\S]*Snapshots/);
});

test("deleting a Library entry removes dead sourceLibraryId links without deleting copied encounter data", async () => {
  const stores = {
    encounters: [
      { id: "active", kind: "active", combatants: [{ id: "a", sourceLibraryId: "lib-x", name: "Hero", hp: 4 }] },
      { id: "tpl", kind: "saved", saveMode: "template", combatants: [{ id: "b", sourceLibraryId: "lib-x", name: "Hero", hp: 10 }] },
    ],
    snapshots: [
      { id: 1, encounter: { combatants: [{ id: "c", sourceLibraryId: "lib-x", name: "Hero", hp: 2 }] } },
    ],
  };
  const puts = [];
  const context = {
    console,
    Date,
    document: {},
    confirm: () => false,
    ENC: {
      deepClone: (value) => JSON.parse(JSON.stringify(value)),
      db: {
        async getAll(store) { return stores[store] || []; },
        async put(store, value) { puts.push([store, JSON.parse(JSON.stringify(value))]); },
      },
      combat: {
        encounter: { combatants: [{ id: "a", sourceLibraryId: "lib-x", name: "Hero", hp: 4 }] },
        render() {},
      },
      sync: { broadcast() {} },
      assets: { async findReferences() { return []; }, async deleteAsset() {} },
      app: { toast() {} },
    },
  };
  vm.createContext(context);
  vm.runInContext(read("programs/app/js/modules/library.js"), context);

  const count = await context.ENC.libraryUI.unlinkDeletedLibraryEntry("lib-x");
  assert.equal(count, 3);
  assert.equal(context.ENC.combat.encounter.combatants[0].sourceLibraryId, null);
  assert.equal(context.ENC.combat.encounter.combatants[0].name, "Hero");
  assert.equal(context.ENC.combat.encounter.combatants[0].hp, 4);
  assert.ok(puts.some(([store, value]) => store === "encounters" && value.id === "tpl" && value.combatants[0].sourceLibraryId === null));
  assert.ok(puts.some(([store, value]) => store === "snapshots" && value.id === 1 && value.encounter.combatants[0].sourceLibraryId === null));
});

test("Reusable Template load refreshes Library-linked durable data but Saved State load remains historical", () => {
  const encounters = read("programs/app/js/modules/encounters.js");
  assert.match(encounters, /if \(actualMode === "template"\)[\s\S]*syncLinkedIdentities\(\{[\s\S]*full: true/);
  assert.match(encounters, /Saved States are historical[\s\S]*retain the exact character data saved/);
});

test("Compendium Save/Refresh immediately syncs or links matching active combatants by exact source identity", () => {
  const compendium = read("programs/app/js/modules/compendium.js");
  assert.match(compendium, /syncLinkedLibraryEntry\(persisted, \{ full: true \}\)/);
  assert.match(compendium, /provider \+ key, never name/);
});
