const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("all three UI themes are registered", () => {
  const config = read("programs/app/js/core/config.js");
  assert.match(config, /new Set\(\["original", "scifi", "fantasy"\]\)/);
});

test("Fantasy Player Display owns standby, scene, and combat surfaces", () => {
  const css = read("programs/app/css/theme-display.css");
  assert.match(css, /theme-fantasy\.player-body\[data-display-mode="standby"\]/);
  assert.match(css, /theme-fantasy\.player-body\[data-display-mode="scene"\]/);
  assert.match(css, /theme-fantasy\.player-body\[data-display-mode="combat"\]/);
  assert.match(css, /scene-no-image[\s\S]*#0d0906/);
});

test("Sci-Fi Player Display owns standby, scene, and combat surfaces", () => {
  const css = read("programs/app/css/theme-display.css");
  assert.match(css, /theme-scifi\.player-body\[data-display-mode="standby"\]/);
  assert.match(css, /theme-scifi\.player-body\[data-display-mode="scene"\]/);
  assert.match(css, /theme-scifi\.player-body\[data-display-mode="combat"\]/);
});

test("Player Display starts from saved settings before local cache", () => {
  const display = read("programs/app/js/display.js");
  assert.match(display, /settings\?\.uiTheme \|\| storedTheme \|\| "scifi"/);
});


test("Fantasy DM screens explicitly own remaining hard-coded base surfaces", () => {
  const css = read("programs/app/css/theme-fantasy.css");
  const required = [
    ".encounter-setup-card",
    ".encounter-setup-background-preview",
    ".library-row",
    ".library-row-more-menu",
    ".compendium-stat-grid > div",
    ".compendium-preview-notes",
    ".timer-controls",
    ".timer-preview-panel",
    ".timer-primary-action[data-timer-state=\"paused\"]",
    ".snapshot-item",
    ".upgrade-modal-card",
    ".startup-modal-card",
    ".toast",
    ".combatant-library-link-badge",
    ".encounter-add-workflow-header",
  ];
  for (const selector of required) {
    assert.ok(css.includes(`body.theme-fantasy ${selector}`), `missing Fantasy selector: ${selector}`);
  }
});

test("Sci-Fi live Run actions use cyan/teal rather than Fantasy amber", () => {
  const css = read("programs/app/css/theme-scifi.css");
  assert.match(css, /body\.theme-scifi #nextTurnBtn,[\s\S]*body\.theme-scifi #startCombatBtn[\s\S]*#087f99/);
  assert.doesNotMatch(css, /body\.theme-scifi #nextTurnBtn,[\s\S]{0,500}#9a6728/);
});

test("Fantasy Prepare pages own shared navigation, empty states, library, assets, and compendium chrome", () => {
  const css = read("programs/app/css/theme-fantasy.css");
  const required = [
    ".dm-segmented-nav",
    ".dm-segment-button",
    ".empty-state",
    ".character-editor-panel .stat-fields",
    ".encounter-library-bar",
    ".saved-encounter-group",
    ".saved-encounter-group-title",
    ".asset-section-count",
    ".compendium-online-badge",
    ".compendium-result-count",
  ];
  for (const selector of required) {
    assert.ok(css.includes(`body.theme-fantasy ${selector}`), `missing Fantasy Prepare selector: ${selector}`);
  }
  assert.match(css, /body\.theme-fantasy input\[type="file"\]::file-selector-button/);
});
