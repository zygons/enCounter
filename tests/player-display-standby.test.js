const fs = require('fs');
const assert = require('assert');

const encounters = fs.readFileSync('programs/app/js/modules/encounters.js', 'utf8');
const main = fs.readFileSync('programs/app/js/main.js', 'utf8');

assert(
  encounters.includes('.getElementById("endCombatBtn")') &&
    encounters.includes('this.setPhase("scene", "scene", { transition: "end-combat" })'),
  'End Combat must return Player Display to Scene using the explicit end-combat lifecycle transition.'
);

assert(
  main.includes('getSafeStartupPlayerDisplayMode(encounter)'),
  'main.js must include safe Player Display startup normalization.'
);
assert(
  main.includes('if (encounter?.phase !== "combat") return "standby";'),
  'Non-combat encounters must reopen in standby.'
);
assert(
  main.includes('return savedMode === "combat" ? "combat" : "standby";'),
  'Combat encounters may restore combat mode only when it was explicitly active.'
);

console.log('player-display-standby.test.js: PASS');
