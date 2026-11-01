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

function loadDatabase() {
  let uuidCounter = 0;
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
    console,
    setTimeout,
    clearTimeout,
    Date,
    Math,
    JSON,
  });

  for (const relativePath of [
    "programs/app/js/core/config.js",
    "programs/app/js/core/db.js",
  ]) {
    const filePath = path.join(__dirname, "..", relativePath);
    vm.runInContext(fs.readFileSync(filePath, "utf8"), context, {
      filename: filePath,
    });
  }

  // These unit tests exercise record-ID selection only; no IndexedDB access
  // is needed. Replace put() with a harmless in-memory stub.
  window.ENC.db.put = async (_storeName, value) => value.id;
  return window.ENC;
}

test("new reusable templates never reuse a loaded source encounter ID", async () => {
  const ENC = loadDatabase();
  const encounter = ENC.createDefaultEncounter();
  encounter.sourceEncounterId = "existing-state-id";

  const saved = await ENC.db.saveEncounterTemplate(
    encounter,
    "Fresh Template",
    null,
  );

  assert.notEqual(saved.id, "existing-state-id");
  assert.match(saved.id, /^enc-/);
  assert.equal(saved.saveMode, "template");
});

test("new saved encounter states never reuse a loaded source encounter ID", async () => {
  const ENC = loadDatabase();
  const encounter = ENC.createDefaultEncounter();
  encounter.sourceEncounterId = "existing-template-id";

  const saved = await ENC.db.saveEncounterState(
    encounter,
    "Fresh State",
    null,
    { timerState: null },
  );

  assert.notEqual(saved.id, "existing-template-id");
  assert.match(saved.id, /^enc-/);
  assert.equal(saved.saveMode, "state");
});

test("explicit update IDs are preserved for template and state updates", async () => {
  const ENC = loadDatabase();
  const encounter = ENC.createDefaultEncounter();

  const template = await ENC.db.saveEncounterTemplate(
    encounter,
    "Template",
    "template-update-id",
  );
  const state = await ENC.db.saveEncounterState(
    encounter,
    "State",
    "state-update-id",
    { timerState: null },
  );

  assert.equal(template.id, "template-update-id");
  assert.equal(state.id, "state-update-id");
});
