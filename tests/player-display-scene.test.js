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

test("Player Display has a dedicated scene presentation fallback", () => {
  const html = read("programs/app/display.html");
  const js = read("programs/app/js/display.js");
  const css = read("programs/app/css/display.css");

  assert.match(html, /id="scenePresentation"/);
  assert.match(html, /id="scenePresentationTitle"/);
  assert.match(js, /scenePresentation\.classList\.add\("show"\)/);
  assert.match(js, /scenePresentation\.classList\.toggle\("has-background"/);
  assert.match(css, /\.scene-presentation\.show/);
  assert.match(css, /\.scene-presentation-card/);
});

test("Player Display control is simplified to one dynamic Show/Hide action", () => {
  const html = read("programs/app/index.html");
  const main = read("programs/app/js/main.js");

  const openDisplayMatches = html.match(/id="openDisplayBtn"/g) || [];
  assert.equal(openDisplayMatches.length, 1);
  assert.doesNotMatch(html, /id="hideEncounterDisplayBtn"/);
  assert.match(main, /phase === "combat" \? "Show Combat" : "Show Scene"/);
  assert.match(main, /button\.textContent = "Hide Player Display"/);
});
