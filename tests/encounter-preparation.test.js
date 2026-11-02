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

test("DM Encounters exposes reusable-template setup without loading the active encounter", () => {
  const html = read("programs/app/index.html");
  const js = read("programs/app/js/modules/encounter-setup.js");

  assert.doesNotMatch(html, /id="configureTemplateBtn"/);
  assert.match(html, /id="savedTemplateSelect"/);
  assert.match(html, /id="encounterSetupPrompt"/);
  assert.match(html, /id="encounterSetupEditor"/);
  assert.match(html, /id="encounterSetupSceneBackground"/);
  assert.match(html, /id="encounterSetupCombatBackground"/);
  assert.match(html, /id="encounterSetupSceneMusic"/);
  assert.match(html, /id="encounterSetupCombatMusic"/);
  assert.match(html, /id="encounterSetupSaveBtn"/);
  assert.match(html, /id="encounterSetupTemplateName"/);
  assert.match(html, /id="encounterSetupCombatants"/);

  assert.match(js, /saveEncounterTemplate/);
  assert.match(js, /savedTemplateSelect/);
  assert.match(js, /syncFromSelection/);
  assert.doesNotMatch(js, /loadSavedEncounter/);
});

test("Encounter setup supports scene/combat ambience, transition settings, and cues", () => {
  const html = read("programs/app/index.html");

  for (const id of [
    "encounterSetupSceneAmb1",
    "encounterSetupSceneAmb2",
    "encounterSetupSceneAmb3",
    "encounterSetupCombatAmb1",
    "encounterSetupCombatAmb2",
    "encounterSetupAutoCombat",
    "encounterSetupReturnScene",
    "encounterSetupCue1Asset",
    "encounterSetupCue2Asset",
    "encounterSetupCue3Asset",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test("live Encounter background management links to DM Assets instead of duplicating import controls", () => {
  const html = read("programs/app/index.html");
  const dm = read("programs/app/js/modules/dm-workspace.js");

  assert.match(html, /id="manageEncounterBackgroundsBtn"/);
  assert.doesNotMatch(html, /id="uploadBackgroundBtn"/);
  assert.doesNotMatch(html, /id="backgroundUpload"/);
  assert.match(dm, /manageEncounterBackgroundsBtn/);
  assert.match(dm, /assetFilter: "backgrounds\/"/);
});

test("Soundscape is labeled as the live active-encounter mixer", () => {
  const html = read("programs/app/index.html");
  assert.match(html, /Live audio mixer for the currently loaded encounter/);
  assert.match(html, /Apply to Active Encounter/);
});

test("Encounter setup provides persistent save confirmation and verifies storage", () => {
  const html = read("programs/app/index.html");
  const js = read("programs/app/js/modules/encounter-setup.js");

  assert.match(html, /id="encounterSetupSaveStatus"/);
  assert.match(js, /Saving encounter setup/);
  assert.match(js, /ENC\.db\.get\("encounters", saved\.id\)/);
  assert.match(js, /Updated the currently loaded encounter/);
  assert.match(js, /Unsaved setup changes/);
});

test("Show Scene automatically starts prepared scene audio when configured", () => {
  const js = read("programs/app/js/modules/encounters.js");

  assert.match(js, /displayMode === "scene"/);
  assert.match(js, /this\.hasSceneAudio\(encounter\.soundscape\)/);
  assert.match(js, /await ENC\.audio\?\.playScene\(\)/);
});

test("Start Combat automatically switches to prepared combat audio when enabled", () => {
  const js = read("programs/app/js/modules/encounters.js");

  assert.match(js, /autoSwitchToCombat !== false/);
  assert.match(js, /this\.hasCombatAudio\(encounter\.soundscape\)/);
  assert.match(js, /await ENC\.audio\?\.playCombat\(\)/);
});

test("prepared media save uses canonical presentation and exact persistence verification", () => {
  const setup = read("programs/app/js/modules/encounter-setup.js");
  const config = read("programs/app/js/core/config.js");
  const encounters = read("programs/app/js/modules/encounters.js");
  const html = read("programs/app/index.html");

  assert.match(setup, /updated\.presentation\s*=\s*\{/);
  assert.match(setup, /verifyPersistedMedia/);
  assert.match(setup, /Save verification failed/);
  assert.match(setup, /Saved ✓/);
  assert.match(config, /normalizeEncounterPresentation/);
  assert.match(config, /applyEncounterPresentation/);
  assert.match(encounters, /ENC\.applyEncounterPresentation\(loaded\)/);
  assert.match(encounters, /ENC\.applyEncounterPresentation\(encounter\)/);
  assert.match(html, /config\.js\?v=alpha3-p2b6-media2/);
  assert.match(html, /encounter-setup\.js\?v=alpha3-p2b6-media2/);
});
