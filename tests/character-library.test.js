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

test("DM Characters uses a compact table-style library with on-demand editor", () => {
  const html = read("programs/app/index.html");
  assert.match(html, /class="character-table-header"/);
  assert.match(html, /id="libraryCards"\s+class="library-cards character-table"/);
  assert.match(html, /id="libraryEditorPanel"[^>]*hidden/);
  assert.match(html, /id="newLibraryEntryBtn"/);
  assert.match(html, /id="libraryResultCount"/);
});

test("Library rendering uses compact rows and consolidates secondary actions", () => {
  const js = read("programs/app/js/modules/library.js");
  assert.match(js, /row\.className = "library-row"/);
  assert.match(js, /more\.className = "library-row-more"/);
  assert.match(js, /menu\.append\(duplicate, exportOne, del\)/);
  assert.match(js, /openCreate\(\)/);
  assert.match(js, /showEditor\(\)/);
  assert.match(js, /hideEditor\(\)/);
});

test("Character categories update the context-sensitive create button", () => {
  const dm = read("programs/app/js/modules/dm-workspace.js");
  const lib = read("programs/app/js/modules/library.js");
  assert.match(dm, /updateCreateButton/);
  assert.match(lib, /\+ New \$\{label\}/);
  assert.match(lib, /enemy-creature/);
});

test("Encounter condition action buttons do not duplicate condition counts", () => {
  const combat = read("programs/app/js/modules/combat.js");
  assert.match(combat, /conditionLabel = "Conditions"/);
  assert.match(combat, /conditionLabel = "Condition"/);
  assert.doesNotMatch(combat, /`Conditions \$\{count\}`/);
});

test("Character library CSS supports 1080p table layout and responsive editor", () => {
  const css = read("programs/app/css/base.css");
  assert.match(css, /\.character-table-header,\s*\.library-row/);
  assert.match(css, /\.character-editor-panel\s*\{[^}]*position:\s*sticky/s);
  assert.match(css, /\.library-row-more-menu/);
  assert.match(css, /@media \(max-width: 1120px\)/);
});
