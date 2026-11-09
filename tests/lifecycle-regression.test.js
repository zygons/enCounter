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

function createLifecycleHarness(encounter, { audioMode = "stopped" } = {}) {
  const calls = {
    playScene: 0,
    playCombat: 0,
    stopAll: 0,
    displayModes: [],
    saves: [],
    toasts: [],
  };

  const window = { ENC: {}, location: { origin: "http://127.0.0.1:5500" } };
  const context = vm.createContext({
    window,
    URL,
    document: { getElementById: () => null },
    console,
    setTimeout,
    clearTimeout,
    Date,
    Math,
    JSON,
    structuredClone: global.structuredClone,
  });

  vm.runInContext(read("programs/app/js/core/config.js"), context, {
    filename: "config.js",
  });

  const ENC = window.ENC;
  ENC.combat = {
    encounter: ENC.normalizeEncounter(encounter),
    async save(reason) {
      calls.saves.push(reason || "");
    },
    render() {},
    followCurrentTurn() {},
  };
  ENC.app = {
    setPlayerDisplayMode(mode) {
      calls.displayModes.push(mode);
    },
    toast(message) {
      calls.toasts.push(String(message || ""));
    },
  };
  ENC.audio = {
    mode: audioMode,
    setSoundscape() {},
    async playScene() {
      calls.playScene += 1;
      this.mode = "scene";
    },
    async playCombat() {
      calls.playCombat += 1;
      this.mode = "combat";
    },
    stopAll() {
      calls.stopAll += 1;
      this.mode = "stopped";
    },
  };
  ENC.soundscapeUI = { renderStatus() {} };

  context.ENC = ENC;
  vm.runInContext(read("programs/app/js/modules/encounters.js"), context, {
    filename: "encounters.js",
  });
  ENC.encounterUI.renderPhase = () => {};

  return { ENC, calls };
}

function sceneMusicOnlySoundscape(overrides = {}) {
  return {
    scene: {
      music: {
        name: "Scene Music",
        asset: "assets/sounds/music/scene.mp3",
        volume: 0.6,
        loop: true,
      },
      ambience: [],
    },
    combat: { music: {}, ambience: [] },
    autoSwitchToCombat: true,
    returnToSceneAfterCombat: true,
    ...overrides,
  };
}

test("Start Combat transitions currently playing Scene audio even with no dedicated Combat track", async () => {
  const { ENC, calls } = createLifecycleHarness(
    {
      name: "Audio Transition",
      phase: "scene",
      playerDisplayMode: "scene",
      soundscape: sceneMusicOnlySoundscape(),
    },
    { audioMode: "scene" },
  );

  await ENC.encounterUI.setPhase("combat", "combat", {
    transition: "start-combat",
  });

  assert.equal(calls.playCombat, 1);
  assert.equal(ENC.combat.encounter.phase, "combat");
  assert.deepEqual(calls.displayModes, ["combat"]);
});

test("End Combat stops Combat audio when automatic return to Scene is disabled", async () => {
  const { ENC, calls } = createLifecycleHarness(
    {
      name: "No Return",
      phase: "combat",
      playerDisplayMode: "combat",
      soundscape: sceneMusicOnlySoundscape({ returnToSceneAfterCombat: false }),
    },
    { audioMode: "combat" },
  );

  await ENC.encounterUI.setPhase("scene", "scene", {
    transition: "end-combat",
  });

  assert.equal(calls.stopAll, 1);
  assert.equal(calls.playScene, 0);
  assert.equal(ENC.combat.encounter.phase, "scene");
  assert.deepEqual(calls.displayModes, ["scene"]);
});

test("End Combat starts prepared Scene audio when automatic return is enabled", async () => {
  const { ENC, calls } = createLifecycleHarness(
    {
      name: "Return to Scene",
      phase: "combat",
      playerDisplayMode: "combat",
      soundscape: sceneMusicOnlySoundscape({ returnToSceneAfterCombat: true }),
    },
    { audioMode: "combat" },
  );

  await ENC.encounterUI.setPhase("scene", "scene", {
    transition: "end-combat",
  });

  assert.equal(calls.playScene, 1);
  assert.equal(calls.stopAll, 0);
});

test("Explicit Show Scene can start Scene audio even when automatic post-combat return is disabled", async () => {
  const { ENC, calls } = createLifecycleHarness(
    {
      name: "Explicit Scene",
      phase: "combat",
      playerDisplayMode: "combat",
      soundscape: sceneMusicOnlySoundscape({ returnToSceneAfterCombat: false }),
    },
    { audioMode: "combat" },
  );

  await ENC.encounterUI.setPhase("scene", "scene", {
    transition: "show-scene",
  });

  assert.equal(calls.playScene, 1);
  assert.equal(calls.stopAll, 0);
});

test("loading saved material stops old encounter audio and returns Player Display to standby", () => {
  const encounters = read("programs/app/js/modules/encounters.js");
  assert.match(encounters, /ENC\.audio\?\.stopAll\(250\)/);
  assert.match(encounters, /ENC\.app\.playerDisplayMode\s*=\s*"standby"/);
  assert.match(encounters, /ENC\.app\.broadcastDisplayState\?\.\(\)/);
});

test("Quick Encounter and New Build clear runtime audio, timer checkpoint, and Player Display presentation", () => {
  const combat = read("programs/app/js/modules/combat.js");
  const encounters = read("programs/app/js/modules/encounters.js");

  assert.match(combat, /ENC\.audio\?\.stopAll\(250\)/);
  assert.match(combat, /clearRuntimeTimerCheckpoint/);
  assert.match(combat, /fresh\.playerDisplayMode\s*=\s*"standby"/);
  assert.match(combat, /broadcastDisplayState/);
  assert.match(encounters, /resetActiveEncounter/);
});
