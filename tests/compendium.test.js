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

test("DM Compendium exposes SRD search, preview, Library, and Encounter actions", () => {
  const html = read("programs/app/index.html");
  assert.match(html, /id="compendiumSearch"/);
  assert.match(html, /id="compendiumSearchBtn"/);
  assert.match(html, /id="compendiumResults"/);
  assert.match(html, /id="compendiumPreview"/);
  assert.match(html, /Manage Creature Library/);
  assert.match(html, /Search Compendium/);
  assert.doesNotMatch(html, /Search Compendium — Coming Next/);
});

test("D&D 5e API provider uses index discovery, detail hydration, and cache fallback", () => {
  const js = read("programs/app/js/modules/compendium.js");
  assert.match(js, /baseUrl:\s*"https:\/\/www\.dnd5eapi\.co"/);
  assert.match(js, /indexPath:\s*"\/api\/2014\/monsters"/);
  assert.match(js, /proxyIndexPath:\s*"\/api\/compendium\/dnd5e\/monsters"/);
  assert.match(js, /dnd5eapi-index-then-detail/);
  assert.match(js, /async getDetail\(candidate, signal\)/);
  assert.match(js, /readCachedIndex/);
  assert.match(js, /readCachedDetail/);
});

test("Compendium imports preserve source metadata and D&D encounter fields", () => {
  const config = read("programs/app/js/core/config.js");
  const compendium = read("programs/app/js/modules/compendium.js");
  assert.match(config, /compendiumSource:/);
  assert.match(config, /documentKey:/);
  assert.match(compendium, /systemId:\s*"dnd5e"/);
  assert.match(compendium, /type:\s*"creature"/);
  assert.match(compendium, /armorClass:/);
  assert.match(compendium, /passivePerception:/);
  assert.match(compendium, /maxHp:\s*raw\.hit_points/);
});

test("Compendium can save a local Library copy or add an encounter-only creature", () => {
  const compendium = read("programs/app/js/modules/compendium.js");
  const combat = read("programs/app/js/modules/combat.js");
  assert.match(compendium, /async saveToLibrary\(raw\)/);
  assert.match(compendium, /await ENC\.db\.put\("library", entry\)/);
  assert.match(compendium, /async addToEncounter\(raw\)/);
  assert.match(compendium, /ENC\.combat\.addLibraryEntry\(encounterEntry, initiative\)/);
  assert.match(compendium, /await ENC\.combat\.addCompendiumEntry\(entry, initiative\)/);
  assert.match(combat, /async addCompendiumEntry\(entry, initiative = 10\)/);
  assert.match(combat, /sourceLibraryId:\s*null/);
});

test("Compendium is initialized with the DM Console", () => {
  const html = read("programs/app/index.html");
  const main = read("programs/app/js/main.js");
  assert.match(html, /js\/modules\/compendium\.js\?v=alpha3-phase3-1-14-3/);
  assert.match(main, /ENC\.compendiumUI\?\.initialize\?\.\(\)/);
});

test("Compendium UI includes responsive result and preview styling", () => {
  const css = read("programs/app/css/base.css");
  assert.match(css, /\.compendium-workspace\s*\{/);
  assert.match(css, /\.compendium-result-row\s*\{/);
  assert.match(css, /\.compendium-preview\s*\{/);
  assert.match(css, /@media \(max-width: 1180px\)/);
});


test("D&D 5e API search returns summaries and detail loading is deferred", () => {
  const js = read("programs/app/js/modules/compendium.js");
  assert.match(js, /__summaryOnly:\s*true/);
  assert.match(js, /Full creature data is[\s\S]*fetched when the user selects Preview\/Save\/Add/);
  assert.match(js, /raw = await this\.provider\(\)\.getDetail\(raw\)/);
});

test("D&D 5e API creature normalization produces a usable enCounter creature record", () => {
  const code = read("programs/app/js/modules/compendium.js");
  let counter = 0;
  const storage = new Map();
  const sandbox = {
    ENC: {
      compendiumProviders: {},
      makeId(prefix) { counter += 1; return `${prefix}_${counter}`; },
      normalizeAbility(value) { return { ...value }; },
      normalizeLibraryEntry(value) { return { ...value }; },
    },
    localStorage: {
      getItem(key) { return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, String(value)); },
    },
    URLSearchParams,
    AbortController,
    console,
    fetch: async () => { throw new Error("not used"); },
    document: {},
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const provider = sandbox.ENC.compendiumProviders.dnd5eApiSrd2014;
  const entry = provider.normalizeCreature({
    index: "goblin",
    name: "Goblin",
    type: "humanoid",
    size: "Small",
    challenge_rating: 0.25,
    armor_class: [{ value: 15 }],
    hit_points: 7,
    hit_dice: "2d6",
    speed: { walk: "30 ft." },
    senses: { passive_perception: 9 },
    strength: 8, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 8, charisma: 8,
    special_abilities: [{ name: "Nimble Escape", desc: "The goblin can take a special action." }],
    actions: [{ name: "Scimitar", desc: "Melee weapon attack." }],
  });
  assert.equal(entry.systemId, "dnd5e");
  assert.equal(entry.type, "creature");
  assert.equal(entry.maxHp, 7);
  assert.equal(entry.stats.armorClass, 15);
  assert.equal(entry.stats.passivePerception, 9);
  assert.equal(entry.stats.speed, "30 ft.");
  assert.equal(entry.compendiumSource.provider, "dnd5eapi-srd-2014");
  assert.equal(entry.compendiumSource.documentKey, "srd-2014");
  assert.ok(entry.tags.includes("CR 1/4"));
  assert.equal(entry.abilities.length, 2);
});
