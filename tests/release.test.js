/*
 * Copyright (C) 2026 Zygons
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

function releaseVersion() {
  const match = read("docs/VERSION.txt").match(/^Version:\s*(\S+)/m);
  assert.ok(match, "docs/VERSION.txt must contain a Version line");
  return match[1];
}

test("release-facing version references match docs/VERSION.txt", () => {
  const version = releaseVersion();

  assert.match(
    read("programs/app/js/core/config.js"),
    new RegExp(`ENC\\.APP_VERSION = "${version.replaceAll(".", "\\.")}"`),
  );
  assert.match(read("programs/launcher.py"), new RegExp(`APP_VERSION = "${version.replaceAll(".", "\\.")}"`));
  assert.match(read("programs/app/index.html"), new RegExp(`v${version.replaceAll(".", "\\.")}`));
  assert.match(read("programs/app/display.html"), new RegExp(`v${version.replaceAll(".", "\\.")}`));
  assert.match(read("programs/enCounter_version_info.txt"), new RegExp(version.replaceAll(".", "\\.")));
  assert.match(read("docs/LEGAL.html"), new RegExp(version.replaceAll(".", "\\.")));
  assert.ok(read("README.md").includes("**Current release:** `" + version + "`"));
});

test("build scripts derive package version from docs/VERSION.txt", () => {
  assert.match(read("Build enCounter Windows.bat"), /docs\\VERSION\.txt/);
  assert.match(read("Build enCounter Linux.sh"), /docs\/VERSION\.txt/);
});

test("Windows release copies the User Guide from docs", () => {
  assert.match(
    read("Build enCounter Windows.bat"),
    /docs\\enCounter User Guide\.pdf/,
  );
});

test("gitignore contains no Markdown code fences", () => {
  const gitignore = read(".gitignore");
  assert.equal(gitignore.includes("```"), false);
});
