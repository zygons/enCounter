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

test("Encounter library picker provides Players, NPCs, and Monsters & Enemies tabs", () => {
  const html = read("programs/app/index.html");
  const combat = read("programs/app/js/modules/combat.js");

  assert.match(html, /data-library-picker-tab="player"/);
  assert.match(html, /data-library-picker-tab="npc"/);
  assert.match(html, /data-library-picker-tab="monster"/);
  assert.match(html, /Monsters &amp; Enemies/);

  assert.match(combat, /libraryPickerType:\s*"player"/);
  assert.match(combat, /libraryEntryMatchesPicker/);
  assert.match(combat, /\["enemy", "creature", "monster"\]\.includes\(entry\.type\)/);
});

test("Encounter picker labels entries with type and system and groups current system first", () => {
  const combat = read("programs/app/js/modules/combat.js");
  assert.match(combat, /Current Encounter/);
  assert.match(combat, /Other Systems/);
  assert.match(combat, /typeLabel/);
  assert.match(combat, /systemLabel/);
  assert.match(combat, /entry\.name.*typeLabel.*systemLabel/s);
});

test("Opening Add Combatant refreshes the library before rendering the picker", () => {
  const combat = read("programs/app/js/modules/combat.js");
  assert.match(combat, /await ENC\.libraryUI\?\.load\?\.\(\)/);
  assert.match(combat, /this\.renderLibrarySelect\(\)/);
});
