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
  const context = {
    console,
    crypto: { randomUUID: () => "test-id" },
    structuredClone: (value) => JSON.parse(JSON.stringify(value)),
    Date,
    Math,
    Set,
    Number,
    String,
    Boolean,
    Array,
    Object,
    JSON,
    URL,
  };
  context.window = context;
  context.ENC = {};
  vm.createContext(context);
  vm.runInContext(read("programs/app/js/core/config.js"), context);
  return context.ENC;
}

test("legacy combatants with current HP but no max HP get a safe maximum baseline", () => {
  const ENC = loadConfig();
  const combatant = ENC.normalizeCombatant({
    id: "legacy",
    name: "Legacy Goblin",
    systemId: "dnd5e",
    hp: 7,
    maxHp: "",
  });
  assert.equal(combatant.hp, 7);
  assert.equal(combatant.maxHp, 7);
});

test("existing max HP is preserved when current HP is lower", () => {
  const ENC = loadConfig();
  const combatant = ENC.normalizeCombatant({
    id: "wounded",
    name: "Wounded Hero",
    systemId: "dnd5e",
    hp: 15,
    maxHp: 40,
  });
  assert.equal(combatant.hp, 15);
  assert.equal(combatant.maxHp, 40);
});

test("Quick Create captures maximum HP and initializes current HP from it", () => {
  const html = read("programs/app/index.html");
  const combat = read("programs/app/js/modules/combat.js");
  assert.match(html, /id="quickMaxHp"/);
  assert.match(combat, /maxHp: document\.getElementById\("quickMaxHp"\)/);
  assert.match(combat, /hp: document\.getElementById\("quickMaxHp"\)/);
});

test("Asset library provides search, media-specific rendering, and on-demand import", () => {
  const html = read("programs/app/index.html");
  const assets = read("programs/app/js/modules/assets.js");
  const main = read("programs/app/js/main.js");

  assert.match(html, /id="assetSearch"/);
  assert.match(html, /id="assetResultCount"/);
  assert.match(html, /id="toggleAssetImportBtn"/);
  assert.match(html, /id="assetImportPanel"[^>]*hidden/);
  assert.match(assets, /createImageCard\(item\)/);
  assert.match(assets, /createAudioRow\(item\)/);
  assert.match(assets, /className = "asset-visual-grid"/);
  assert.match(assets, /className = "asset-audio-list"/);
  assert.match(main, /getElementById\("assetSearch"\)/);
  assert.match(main, /toggleAssetImport/);
});

test("Asset CSS uses distinct image grid and audio row layouts", () => {
  const css = read("programs/app/css/base.css");
  assert.match(css, /\.asset-visual-grid\s*\{/);
  assert.match(css, /\.asset-audio-row\s*\{/);
  assert.match(css, /\.asset-import-grid\s*\{/);
  assert.match(css, /@media \(max-width: 1100px\)/);
});


test("Asset deletion UI checks references before calling the local delete endpoint", () => {
  const assets = read("programs/app/js/modules/assets.js");
  const launcher = read("programs/launcher.py");
  assert.match(assets, /findReferences\(url\)/);
  assert.match(assets, /createDeleteButton\(item\)/);
  assert.match(assets, /Cannot delete/);
  assert.match(launcher, /def do_DELETE\(self\):/);
  assert.match(launcher, /\/api\/assets\/delete/);
  assert.match(launcher, /Application branding assets cannot be deleted/);
});
