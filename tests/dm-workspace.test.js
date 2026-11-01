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

test("Alpha 3 primary navigation exposes DM workspace and removes old top-level Library/Assets/Data tabs", () => {
  const html = read("programs/app/index.html");
  assert.match(html, /data-section="dmSection"/);
  assert.doesNotMatch(html, /data-section="librarySection"/);
  assert.doesNotMatch(html, /data-section="assetsSection"/);
  assert.doesNotMatch(html, /data-section="dataSection"/);
});

test("DM workspace contains the five planned Phase 2 pages", () => {
  const html = read("programs/app/index.html");
  for (const page of ["characters", "compendium", "encounters", "assets", "data"]) {
    assert.match(html, new RegExp(`data-dm-page-panel="${page}"`));
  }
});

test("DM workspace reuses existing compatibility controls for character and asset filtering", () => {
  const html = read("programs/app/index.html");
  const js = read("programs/app/js/modules/dm-workspace.js");
  assert.match(html, /id="libraryTypeFilter"[^>]*class="hidden"/);
  assert.match(html, /id="assetFilter"/);
  assert.match(js, /libraryTypeFilter/);
  assert.match(js, /assetFilter/);
});

test("upgrade assistant auto-starts once DM workspace exists", () => {
  const config = read("programs/app/js/core/config.js");
  assert.match(config, /ENC\.UPGRADE_ASSISTANT_AUTO_START\s*=\s*true;/);
});
