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

test("Encounter console uses a roster plus sticky control rail", () => {
  const html = read("programs/app/index.html");
  assert.match(html, /class="encounter-console-layout"/);
  assert.match(html, /class="encounter-control-rail"/);
  assert.match(html, /id="combatantTableHeader"/);
  assert.match(html, /id="toggleAddCombatantBtn"/);
});

test("live turn, phase, display, audio, and scene controls remain uniquely wired", () => {
  const html = read("programs/app/index.html");
  for (const id of [
    "roundNumber",
    "previousTurnBtn",
    "nextTurnBtn",
    "openDisplayBtn",
    "showSceneBtn",
    "startCombatBtn",
    "endCombatBtn",
    "startSceneAudioBtn",
    "stopEncounterAudioBtn",
    "backgroundControls",
  ]) {
    const matches = html.match(new RegExp(`id="${id}"`, "g")) || [];
    assert.equal(matches.length, 1, `${id} should appear exactly once`);
  }
});

test("combatant rendering includes graphical HP, system-aware defense, and fast controls", () => {
  const js = read("programs/app/js/modules/combat.js");
  assert.match(js, /renderHpCell\(combatant\)/);
  assert.match(js, /primaryDefenseSummary\(combatant\)/);
  assert.match(js, /armorClass/);
  assert.match(js, /refDefense/);
  assert.match(js, /fortDefense/);
  assert.match(js, /willDefense/);
  assert.match(js, /\[-10, -1, 1, 10\]/);
  assert.match(js, /conditionEditorIds/);
  assert.match(js, /expandedCombatantIds/);
});

test("Encounter console CSS provides HP state colors and responsive control rail", () => {
  const css = read("programs/app/css/base.css");
  assert.match(css, /\.combatant-hp-track\.wounded/);
  assert.match(css, /\.combatant-hp-track\.critical/);
  assert.match(css, /\.encounter-control-rail\s*\{[^}]*position:\s*sticky/s);
  assert.match(css, /@media \(max-width: 1279px\)/);
});
