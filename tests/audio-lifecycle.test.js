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

function loadAudioHarness() {
  const players = [];

  class FakeAudio {
    constructor(src) {
      this.src = src;
      this.preload = "";
      this.loop = false;
      this.volume = 0;
      this.currentTime = 0;
      this.paused = true;
      this.listeners = new Map();
      players.push(this);
    }
    async play() {
      this.paused = false;
    }
    pause() {
      this.paused = true;
    }
    addEventListener(type, handler) {
      this.listeners.set(type, handler);
    }
  }

  let now = 0;
  const window = {
    ENC: {},
    location: { origin: "http://127.0.0.1:5500" },
  };
  const context = vm.createContext({
    window,
    URL,
    Audio: FakeAudio,
    console,
    performance: { now: () => now },
    requestAnimationFrame(callback) {
      now += 10000;
      callback(now);
    },
    cancelAnimationFrame() {},
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
  vm.runInContext(read("programs/app/js/modules/audio.js"), context, {
    filename: "audio.js",
  });

  return { ENC: window.ENC, players };
}

test("Scene music is stopped when transitioning into Combat with no Combat tracks", async () => {
  const { ENC, players } = loadAudioHarness();
  ENC.audio.setSoundscape({
    fadeMs: 0,
    scene: {
      music: { asset: "assets/sounds/music/scene.wav", volume: 0.5 },
      ambience: [],
    },
    combat: { music: {}, ambience: [] },
  });

  await ENC.audio.playScene();
  assert.equal(ENC.audio.mode, "scene");
  assert.equal(players.length, 1);
  assert.equal(players[0].paused, false);

  await ENC.audio.playCombat();
  assert.equal(ENC.audio.mode, "stopped");
  assert.equal(players[0].paused, true);
});

test("Scene ambience can continue into Combat without a dedicated Combat track", async () => {
  const { ENC, players } = loadAudioHarness();
  ENC.audio.setSoundscape({
    fadeMs: 0,
    scene: {
      music: {},
      ambience: [
        {
          asset: "assets/sounds/ambience/forest.wav",
          volume: 0.5,
          combatBehavior: "continue",
        },
      ],
    },
    combat: { music: {}, ambience: [] },
  });

  await ENC.audio.playScene();
  await ENC.audio.playCombat();

  assert.equal(ENC.audio.mode, "combat");
  assert.equal(players.length, 1);
  assert.equal(players[0].paused, false);
});

test("one-shot cues do not replace the active Scene or Combat audio mode", async () => {
  const { ENC, players } = loadAudioHarness();
  ENC.audio.setSoundscape({
    fadeMs: 0,
    scene: {
      music: { asset: "assets/sounds/music/scene.wav", volume: 0.5 },
      ambience: [],
    },
  });

  await ENC.audio.playScene();
  await ENC.audio.playCue({
    asset: "assets/sounds/cues/hit.wav",
    volume: 0.8,
  });

  assert.equal(ENC.audio.mode, "scene");
  assert.equal(players.at(-1).loop, false);
  assert.equal(players.at(-1).paused, false);
});
