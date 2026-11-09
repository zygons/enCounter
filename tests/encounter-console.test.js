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

test("combatant rendering includes graphical HP, system-aware defense, and simplified row controls", () => {
  const js = read("programs/app/js/modules/combat.js");
  assert.match(js, /renderHpCell\(combatant\)/);
  assert.match(js, /primaryDefenseSummary\(combatant\)/);
  assert.match(js, /armorClass/);
  assert.match(js, /refDefense/);
  assert.match(js, /fortDefense/);
  assert.match(js, /willDefense/);
  assert.match(js, /combatant-quick-actions-simplified/);
  assert.match(js, /Set Turn/);
  assert.match(js, /conditionEditorIds/);
  assert.match(js, /expandedCombatantIds/);
  assert.match(js, /currentTurnHpMinus10/);
  assert.doesNotMatch(js, /for \(const delta of \[-10, -1, 1, 10\]\)/);
});


test("Current Turn hierarchy emphasizes active management without changing control wiring", () => {
  const html = read("programs/app/index.html");
  const js = read("programs/app/js/modules/combat.js");
  const css = read("programs/app/css/workspace-layout.css");

  assert.match(html, />Quick Actions</);
  assert.match(html, /Status &amp; State/);
  assert.match(html, /Damage ← · → Heal/);
  assert.match(html, /class="current-turn-state-action"/);
  assert.match(js, /label\.textContent = "Active Turn"/);
  assert.match(js, /conditionCount/);
  assert.match(js, /recoveryButton\.dataset\.state = state/);
  assert.match(js, /aria-expanded/);
  assert.match(css, /current-turn-actions-heading/);
  assert.match(css, /current-turn-hp-actions \.hp-action\.damage/);
  assert.match(css, /currentTurnRecoveryBtn\[data-state="downed"\]/);
});

test("Encounter console CSS provides HP state colors and responsive control rail", () => {
  const css = read("programs/app/css/base.css");
  assert.match(css, /\.combatant-hp-track\.wounded/);
  assert.match(css, /\.combatant-hp-track\.critical/);
  assert.match(css, /\.encounter-control-rail\s*\{[^}]*position:\s*sticky/s);
  assert.match(css, /@media \(max-width: 1279px\)/);
});

test("Run workspace visual polish keeps control rhythm and focus states consistent", () => {
  const html = read("programs/app/index.html");
  const css = read("programs/app/css/workspace-layout.css");

  assert.match(html, /workspace-layout\.css\?v=alpha3-phase3-1-13-4a/);
  assert.match(css, /PHASE 3\.1\.13\.4 — RUN WORKSPACE VISUAL POLISH/);
  assert.match(css, /\.combatant-quick-actions\s*\{[^}]*border-top:/s);
  assert.match(css, /\.encounter-control-rail \.rail-section-heading\s*\{[^}]*min-height:\s*34px/s);
  assert.match(css, /button:focus-visible/);
  assert.match(css, /summary:focus-visible/);
});


test("theme header keeps Exit enCounter inside the header at high zoom breakpoints", () => {
  const css = read("programs/app/css/workspace-layout.css");

  assert.match(css, /@media \(max-width: 1350px\)/);
  assert.match(
    css,
    /body\.theme-scifi \.header-actions,[\s\S]*?grid-column:\s*auto;[\s\S]*?grid-row:\s*auto;/,
  );
});
