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

function loadAudioWithRejectingPlayer() {
  let uuidCounter = 0;

  class RejectingAudio {
    constructor(src) {
      this.src = src;
      this.preload = "";
      this.loop = false;
      this.volume = 0;
      this.currentTime = 0;
    }

    play() {
      return Promise.reject(new Error("Simulated playback failure"));
    }

    pause() {}
    addEventListener() {}
  }

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
    console: {
      log: console.log,
      debug: () => {},
      warn: () => {},
      error: console.error,
    },
    Audio: RejectingAudio,
    performance: { now: () => 0 },
    requestAnimationFrame: (callback) => callback(20000),
    cancelAnimationFrame: () => {},
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
  const audioPath = path.join(
    __dirname,
    "..",
    "programs",
    "app",
    "js",
    "modules",
    "audio.js",
  );

  vm.runInContext(fs.readFileSync(configPath, "utf8"), context, {
    filename: configPath,
  });
  vm.runInContext(fs.readFileSync(audioPath, "utf8"), context, {
    filename: audioPath,
  });

  return window.ENC;
}

test("Scene audio remains stopped when every configured track fails", async () => {
  const ENC = loadAudioWithRejectingPlayer();
  ENC.audio.setSoundscape({
    scene: {
      music: {
        name: "Scene",
        asset: "/assets/sounds/music/fail.mp3",
        volume: 0.5,
      },
    },
  });

  await assert.rejects(() => ENC.audio.playScene(), /Audio could not start/);
  assert.equal(ENC.audio.mode, "stopped");
});

test("Scene audio reports when no Scene tracks are configured", async () => {
  const ENC = loadAudioWithRejectingPlayer();
  ENC.audio.setSoundscape(ENC.createDefaultSoundscape());

  await assert.rejects(
    () => ENC.audio.playScene(),
    /No Scene audio is configured/,
  );
  assert.equal(ENC.audio.mode, "stopped");
});

test("Combat audio remains stopped when every configured combat track fails", async () => {
  const ENC = loadAudioWithRejectingPlayer();
  ENC.audio.setSoundscape({
    combat: {
      music: {
        name: "Combat",
        asset: "/assets/sounds/music/fail.mp3",
        volume: 0.5,
      },
    },
  });

  await assert.rejects(() => ENC.audio.playCombat(), /Audio could not start/);
  assert.equal(ENC.audio.mode, "stopped");
});
