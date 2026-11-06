/*
 * Phase 3.1.14.1 persistence regression contracts.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function loadPersistenceHarness() {
  let idCounter = 0;
  const window = {
    ENC: {},
    location: { origin: "http://127.0.0.1:5500" },
    crypto: {
      randomUUID() {
        idCounter += 1;
        return `00000000-0000-4000-8000-${String(idCounter).padStart(12, "0")}`;
      },
    },
  };

  const context = vm.createContext({
    window,
    ENC: window.ENC,
    URL,
    console,
    setTimeout,
    clearTimeout,
    Date,
    Math,
    JSON,
  });

  for (const relative of [
    "programs/app/js/core/config.js",
    "programs/app/js/core/db.js",
  ]) {
    const filename = path.join(root, relative);
    vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
  }

  const ENC = window.ENC;
  const stores = {
    encounters: new Map(),
    library: new Map(),
    settings: new Map(),
    snapshots: new Map(),
    meta: new Map(),
  };

  ENC.db.put = async (storeName, value) => {
    const clone = ENC.deepClone(value);
    stores[storeName].set(String(clone.id ?? clone.key), clone);
    return clone.id ?? clone.key;
  };
  ENC.db.get = async (storeName, key) => {
    const value = stores[storeName].get(String(key));
    return value ? ENC.deepClone(value) : null;
  };
  ENC.db.getAll = async (storeName) =>
    [...stores[storeName].values()].map((value) => ENC.deepClone(value));

  return { ENC, stores };
}

function activeEncounter(ENC) {
  return ENC.normalizeEncounter({
    id: "active",
    kind: "active",
    name: "Goblin Forest",
    systemId: "dnd5e",
    phase: "combat",
    playerDisplayMode: "combat",
    round: 4,
    currentId: "goblin-1",
    display: {
      sceneImage: "/assets/backgrounds/custom/goblin-scene.png",
      combatImage: "/assets/backgrounds/custom/goblin-combat.png",
    },
    soundscape: {
      scene: {
        music: { asset: "/assets/sounds/music/forest.mp3", volume: 0.35 },
      },
      combat: {
        music: { asset: "/assets/sounds/music/battle.mp3", volume: 0.65 },
      },
    },
    timer: {
      name: "Reinforcements",
      durationMs: 600000,
      skin: "scifi-pixels",
      visibleToPlayers: true,
      showNumericToDM: true,
      showNumericToPlayers: true,
      displayMode: "featured",
    },
    combatants: [
      {
        id: "goblin-1",
        sourceLibraryId: "lib-goblin",
        name: "Goblin",
        type: "creature",
        systemId: "dnd5e",
        maxHp: 21,
        hp: 6,
        initiative: 17,
        hidden: true,
        dnd5eConditions: ["Poisoned"],
        dnd5eExhaustion: 2,
        visibleStatus: "Concentrating",
        combatState: "delayed",
        delayed: true,
        ready: false,
        createdOrder: 1,
      },
    ],
  });
}

test("reusable template resets transient combat state but preserves prepared setup", async () => {
  const { ENC, stores } = loadPersistenceHarness();
  const source = activeEncounter(ENC);

  const saved = await ENC.db.saveEncounterTemplate(source, "Goblin Template");
  const combatant = saved.combatants[0];

  assert.equal(saved.saveMode, "template");
  assert.equal(saved.phase, "prepared");
  assert.equal(saved.playerDisplayMode, "standby");
  assert.equal(saved.round, 1);
  assert.equal(saved.currentId, null);
  assert.equal(saved.sourceEncounterId, null);
  assert.equal(combatant.hp, 21);
  assert.deepEqual(Array.from(combatant.dnd5eConditions), []);
  assert.equal(combatant.dnd5eExhaustion, 0);
  assert.equal(combatant.visibleStatus, "");
  assert.equal(combatant.combatState, "active");
  assert.equal(combatant.delayed, false);
  // Hidden is encounter preparation, not transient combat damage/status.
  assert.equal(combatant.hidden, true);
  assert.equal(saved.display.sceneImage, source.display.sceneImage);
  assert.equal(saved.display.combatImage, source.display.combatImage);
  assert.equal(saved.soundscape.scene.music.asset, source.soundscape.scene.music.asset);
  assert.equal(saved.timer.durationMs, 600000);
  assert.ok(stores.encounters.has(saved.id));
});

test("saved encounter state preserves live combat progress and checkpoints a running timer as paused", async () => {
  const { ENC, stores } = loadPersistenceHarness();
  const source = activeEncounter(ENC);

  const saved = await ENC.db.saveEncounterState(source, "Goblin State", null, {
    timerState: {
      ...source.timer,
      status: "running",
      remainingMs: 187000,
      endAt: Date.now() + 187000,
    },
  });
  const combatant = saved.combatants[0];

  assert.equal(saved.saveMode, "state");
  assert.equal(saved.phase, "combat");
  assert.equal(saved.round, 4);
  assert.equal(saved.currentId, "goblin-1");
  assert.equal(combatant.hp, 6);
  assert.deepEqual(Array.from(combatant.dnd5eConditions), ["Poisoned"]);
  assert.equal(combatant.dnd5eExhaustion, 2);
  assert.equal(combatant.visibleStatus, "Concentrating");
  assert.equal(combatant.combatState, "delayed");
  assert.equal(saved.timerCheckpoint.status, "paused");
  assert.equal(saved.timerCheckpoint.remainingMs, 187000);
  assert.equal(saved.timerCheckpoint.endAt, null);
  assert.ok(stores.encounters.has(saved.id));
});

test("loading a reusable template creates a fresh active working copy", async () => {
  const { ENC, stores } = loadPersistenceHarness();
  const template = await ENC.db.saveEncounterTemplate(activeEncounter(ENC), "Reusable");
  const storedCombatantId = template.combatants[0].id;

  const loaded = await ENC.db.loadSavedEncounter(template.id);
  const active = stores.encounters.get("active");

  assert.equal(loaded.id, "active");
  assert.equal(loaded.kind, "active");
  assert.equal(loaded.sourceEncounterId, template.id);
  assert.equal(loaded.phase, "prepared");
  assert.equal(loaded.playerDisplayMode, "standby");
  assert.equal(loaded.round, 1);
  assert.equal(loaded.currentId, null);
  assert.notEqual(loaded.combatants[0].id, storedCombatantId);
  assert.equal(loaded.combatants[0].hp, 21);
  assert.deepEqual(Array.from(loaded.combatants[0].dnd5eConditions), []);
  assert.equal(active.sourceEncounterId, template.id);
});

test("loading a saved state preserves progress but always starts the Player Display in standby", async () => {
  const { ENC, stores } = loadPersistenceHarness();
  const state = await ENC.db.saveEncounterState(activeEncounter(ENC), "Resume Me", null, {
    timerState: {
      ...activeEncounter(ENC).timer,
      status: "paused",
      remainingMs: 90000,
    },
  });

  const loaded = await ENC.db.loadSavedEncounter(state.id);

  assert.equal(loaded.sourceEncounterId, state.id);
  assert.equal(loaded.phase, "combat");
  assert.equal(loaded.playerDisplayMode, "standby");
  assert.equal(loaded.round, 4);
  assert.equal(loaded.currentId, "goblin-1");
  assert.equal(loaded.combatants[0].hp, 6);
  assert.deepEqual(Array.from(loaded.combatants[0].dnd5eConditions), ["Poisoned"]);
  assert.equal(loaded.combatants[0].dnd5eExhaustion, 2);
  // The checkpoint stays on the saved record and is applied by Encounter UI.
  const persistedState = stores.encounters.get(state.id);
  assert.equal(persistedState.timerCheckpoint.remainingMs, 90000);
  assert.equal(persistedState.timerCheckpoint.status, "paused");
});

test("new template and state saves never overwrite the loaded source record", async () => {
  const { ENC } = loadPersistenceHarness();
  const source = activeEncounter(ENC);
  source.sourceEncounterId = "existing-template";

  const template = await ENC.db.saveEncounterTemplate(source, "New Template");
  const state = await ENC.db.saveEncounterState(source, "New State", null, {
    timerState: { ...source.timer, status: "idle", remainingMs: 600000 },
  });

  assert.notEqual(template.id, "existing-template");
  assert.notEqual(state.id, "existing-template");
  assert.notEqual(template.id, state.id);
  assert.equal(template.sourceEncounterId, null);
  assert.equal(state.sourceEncounterId, null);
});

test("active encounter round-trip preserves live combat progress and prepared presentation", async () => {
  const { ENC } = loadPersistenceHarness();
  const source = activeEncounter(ENC);

  await ENC.db.saveActiveEncounter(source);
  const restored = await ENC.db.getActiveEncounter();

  assert.equal(restored.id, "active");
  assert.equal(restored.kind, "active");
  assert.equal(restored.phase, "combat");
  assert.equal(restored.round, 4);
  assert.equal(restored.currentId, "goblin-1");
  assert.equal(restored.combatants[0].hp, 6);
  assert.deepEqual(Array.from(restored.combatants[0].dnd5eConditions), ["Poisoned"]);
  assert.equal(restored.combatants[0].dnd5eExhaustion, 2);
  assert.equal(restored.display.sceneImage, source.display.sceneImage);
  assert.equal(restored.display.combatImage, source.display.combatImage);
  assert.equal(restored.soundscape.combat.music.asset, source.soundscape.combat.music.asset);
  assert.equal(restored.timer.durationMs, 600000);
});
