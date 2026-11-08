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
const exists = (relative) => fs.existsSync(path.join(root, relative));

function inlineScripts(html) {
  return [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>/gi)];
}

test("browser pages use a CSP-compatible external theme bootstrap", () => {
  for (const relative of ["programs/app/index.html", "programs/app/display.html"]) {
    const html = read(relative);
    assert.equal(inlineScripts(html).length, 0, `${relative} contains an inline script`);
    assert.match(html, /js\/theme-bootstrap\.js\?v=alpha3-hardening-1/);
  }

  const bootstrap = read("programs/app/js/theme-bootstrap.js");
  assert.match(bootstrap, /localStorage\.getItem/);
  assert.match(bootstrap, /new Set\(\["original", "scifi", "fantasy"\]\)/);
  assert.match(bootstrap, /classList\.add\(`theme-\$\{normalized\}`\)/);
});

test("local launcher applies browser and localhost hardening", () => {
  const launcher = read("programs/launcher.py");

  assert.match(launcher, /ReusableTCPServer\(\("127\.0\.0\.1", PORT\)/);
  assert.match(launcher, /def version_string\(self\):/);
  assert.match(launcher, /Cross-Origin-Resource-Policy/);
  assert.match(launcher, /Permissions-Policy/);
  assert.match(launcher, /connect-src 'self' https:\/\/www\.dnd5eapi\.co/);
  assert.match(launcher, /Cache-Control", "no-store"/);
  assert.match(launcher, /Cache-Control", "no-cache"/);
  assert.match(launcher, /ENCOUNTER_NO_BROWSER/);
  assert.match(launcher, /def current_server_is_compatible/);
  assert.match(launcher, /def ensure_runtime_layout/);

  const mainBlock = launcher.slice(launcher.indexOf('if __name__ == "__main__":'));
  assert.match(mainBlock, /ensure_runtime_layout\(\)/);
});

test("portable build dependencies and runner baselines are pinned", () => {
  const requirements = read("requirements-build.txt");
  assert.match(requirements, /^PyInstaller==6\.22\.3$/m);
  assert.match(requirements, /^pyinstaller-hooks-contrib==2026\.9$/m);

  const workflow = read(".github/workflows/build-portable.yml");
  assert.match(workflow, /runs-on:\s+ubuntu-22\.04/);
  assert.match(workflow, /runs-on:\s+windows-2022/);
  assert.doesNotMatch(workflow, /runs-on:\s+(?:ubuntu|windows)-latest/);
  assert.match(workflow, /persist-credentials:\s+false/);
  assert.match(workflow, /Smoke-test Windows portable executable/);
  assert.match(workflow, /Smoke-test Linux portable executable/);
  assert.match(workflow, /Verify downloaded release checksums/);
});

test("portable build scripts audit release contents before archive publication", () => {
  const windowsBuild = read("Build enCounter Windows.bat");
  const linuxBuild = read("Build enCounter Linux.sh");

  for (const build of [windowsBuild, linuxBuild]) {
    assert.match(build, /release_audit\.py/);
    assert.match(build, /CHANGELOG\.md/);
  }

  assert.equal(exists("programs/release_audit.py"), true);
});

test("release source tree does not retain the accidental tatus artifact", () => {
  assert.equal(exists("tatus"), false);
});
