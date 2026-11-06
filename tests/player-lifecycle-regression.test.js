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

test("Player Display timer is hidden in Standby and requires DM player visibility", () => {
  const display = read("programs/app/js/display.js");
  assert.match(
    display,
    /Boolean\(state\?\.visibleToPlayers\)\s*&&\s*!this\.paused\s*&&\s*!this\.awaitingDmState/,
  );
  assert.match(display, /this\.paused = this\.displayMode === "standby"/);
  assert.match(display, /layer\.hidden = !visible/);
});

test("Player Display initiative and next-turn surfaces omit hidden combatants", () => {
  const display = read("programs/app/js/display.js");
  const config = read("programs/app/js/core/config.js");

  assert.match(display, /ENC\.getPlayerVisibleCombatants/);
  assert.match(display, /ENC\.findNextPlayerVisibleEligibleCombatant/);
  assert.match(display, /current\?\.hidden\s*\?\s*"—"/s);
  assert.match(config, /return Boolean\(combatant && !combatant\.hidden\)/);
});

test("encounter updates received during Standby are stored but not rendered", () => {
  const display = read("programs/app/js/display.js");
  assert.match(display, /this\.encounter = ENC\.normalizeEncounter\(message\.encounter \|\| \{\}\)/);
  assert.match(display, /if \(!this\.paused && !this\.awaitingDmState\) \{\s*this\.render\(\)/s);
});

test("Scene and Combat presentation controls remain independent from encounter phase controls", () => {
  const main = read("programs/app/js/main.js");
  const encounters = read("programs/app/js/modules/encounters.js");

  assert.match(main, /showSceneDisplayButton\?\.addEventListener[\s\S]*presentPlayerDisplay\("scene"\)/);
  assert.match(main, /showCombatDisplayButton\?\.addEventListener[\s\S]*presentPlayerDisplay\("combat"\)/);
  assert.match(encounters, /showSceneBtn[\s\S]*transition: "show-scene"/);
  assert.match(encounters, /startCombatBtn[\s\S]*transition: "start-combat"/);
  assert.match(encounters, /endCombatBtn[\s\S]*transition: "end-combat"/);
});
