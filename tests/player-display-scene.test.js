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

test("Player Display includes a dedicated theme-aware scene presentation", () => {
  const html = read("programs/app/display.html");
  const js = read("programs/app/js/display.js");
  const css = read("programs/app/css/theme-display.css");

  assert.match(html, /id="scenePresentation"/);
  assert.match(html, /id="scenePresentationTitle"/);
  assert.match(html, /id="scenePresentationSubtitle"/);
  assert.match(js, /updateScenePresentation\(sceneImage/);
  assert.match(js, /presentation\.classList\.add\("show"\)/);
  assert.match(js, /presentation\.classList\.toggle\("has-background"/);
  assert.match(css, /theme-fantasy[\s\S]*scene-presentation-card/);
  assert.match(css, /theme-scifi[\s\S]*scene-presentation-card/);
});

test("Player Display mode messages carry but do not derive the active UI theme", () => {
  const main = read("programs/app/js/main.js");
  const display = read("programs/app/js/display.js");

  assert.match(main, /uiTheme: this\.getActiveUiTheme\(\)/);
  assert.match(display, /if \(message\.uiTheme\) this\.applyTheme\(message\.uiTheme\)/);
  assert.match(display, /Presentation changes do not touch the UI theme/);
});
