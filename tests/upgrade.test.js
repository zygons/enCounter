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

function loadMigration() {
  let uuidCounter = 0;
  const window = {
    ENC: {},
    location: { origin: "http://127.0.0.1:5500", search: "" },
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
    URLSearchParams,
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
    "programs/app/js/modules/migration.js",
  ]) {
    const filePath = path.join(__dirname, "..", relativePath);
    vm.runInContext(fs.readFileSync(filePath, "utf8"), context, {
      filename: filePath,
    });
  }

  return window.ENC;
}

test("upgrade assistant is not offered to a fresh install", () => {
  const ENC = loadMigration();
  assert.equal(
    ENC.migration.shouldOfferUpgrade({ hasExistingData: false }, null),
    false,
  );
});

test("existing data with no upgrade metadata is offered the upgrade assistant", () => {
  const ENC = loadMigration();
  assert.equal(
    ENC.migration.shouldOfferUpgrade({ hasExistingData: true }, null),
    true,
  );
});

test("an acknowledged current UI generation is not offered again", () => {
  const ENC = loadMigration();
  assert.equal(
    ENC.migration.shouldOfferUpgrade(
      { hasExistingData: true },
      { uiGeneration: ENC.UI_GENERATION },
    ),
    false,
  );
});

test("an older UI generation is offered the upgrade assistant", () => {
  const ENC = loadMigration();
  assert.equal(
    ENC.migration.shouldOfferUpgrade(
      { hasExistingData: true },
      { uiGeneration: ENC.UI_GENERATION - 1 },
    ),
    true,
  );
});

test("upgrade state keeps backup metadata while recording the current generation", () => {
  const ENC = loadMigration();
  const state = ENC.migration.buildState(
    {
      backupAt: "2026-10-31T12:00:00.000Z",
      acknowledgedAt: null,
    },
    {
      acknowledgedAt: "2026-11-01T12:00:00.000Z",
    },
  );

  assert.equal(state.uiGeneration, ENC.UI_GENERATION);
  assert.equal(state.flowVersion, ENC.UPGRADE_FLOW_VERSION);
  assert.equal(state.lastSeenAppVersion, ENC.APP_VERSION);
  assert.equal(state.backupAt, "2026-10-31T12:00:00.000Z");
  assert.equal(state.acknowledgedAt, "2026-11-01T12:00:00.000Z");
});
