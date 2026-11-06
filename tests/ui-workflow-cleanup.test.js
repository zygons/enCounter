/*
 * Copyright (C) 2026 Zygons
 * SPDX-License-Identifier: MIT
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("Timer uses one adaptive primary action and quick duration presets", () => {
  const html = read("programs/app/index.html");
  const main = read("programs/app/js/main.js");

  assert.match(html, /id="timerStartBtn"/);
  assert.doesNotMatch(html, /id="timerPauseBtn"/);
  assert.doesNotMatch(html, /id="timerResumeBtn"/);
  assert.match(html, /data-timer-preset-ms="60000"/);
  assert.match(html, /data-timer-preset-ms="1800000"/);
  assert.match(main, /Pause Timer/);
  assert.match(main, /Resume Timer/);
  assert.match(main, /state\.status === "running"[\s\S]*timerController\.pause\(\)/);
  assert.match(main, /state\.status === "paused"[\s\S]*timerController\.resume\(\)/);
  assert.match(main, /\[data-timer-preset-ms\]/);
  assert.match(html, /data-run-timer-adjust-ms="-300000"/);
  assert.match(html, /data-run-timer-adjust-ms="300000"/);
  assert.match(main, /\[data-run-timer-adjust-ms\]/);
  assert.match(main, /timerController\.subtractTime\(Math\.abs\(deltaMs\)\)/);
  assert.match(main, /timerController\.addTime\(deltaMs\)/);
});

test("Soundscape no longer duplicates audio importing", () => {
  const html = read("programs/app/index.html");
  const dm = read("programs/app/js/modules/dm-workspace.js");

  assert.match(html, /Soundscape Live Mixer/);
  assert.match(html, /id="manageAudioAssetsBtn"/);
  assert.doesNotMatch(html, /id="uploadAudioBtn"/);
  assert.doesNotMatch(html, /id="audioUploadFile"/);
  assert.match(dm, /manageAudioAssetsBtn/);
  assert.match(dm, /assetFilter: "sounds\/music"/);
});

test("Backup configuration lives in DM Data & Tools instead of Settings", () => {
  const html = read("programs/app/index.html");
  const settingsStart = html.indexOf('id="settingsSection"');
  const settingsHtml = settingsStart >= 0 ? html.slice(settingsStart) : "";
  const dataStart = html.indexOf('id="dmDataPage"');
  const dataEnd = html.indexOf('id="timerSection"');
  const dataHtml = dataStart >= 0 && dataEnd > dataStart ? html.slice(dataStart, dataEnd) : "";

  assert.match(dataHtml, /id="externalBackupEnabled"/);
  assert.match(dataHtml, /Automatic external backup/);
  assert.doesNotMatch(settingsHtml, /id="externalBackupEnabled"/);
  assert.match(settingsHtml, /Backup, restore, storage, and recovery tools are managed under DM/);
});
