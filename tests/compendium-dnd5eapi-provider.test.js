const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const code = fs.readFileSync(
  __dirname + "/../programs/app/js/modules/compendium.js",
  "utf8",
);

const store = new Map();
const storage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, String(value)),
};

const indexPayload = {
  count: 4,
  results: [
    { index: "goblin", name: "Goblin", url: "/api/2014/monsters/goblin" },
    { index: "hobgoblin", name: "Hobgoblin", url: "/api/2014/monsters/hobgoblin" },
    { index: "skeleton", name: "Skeleton", url: "/api/2014/monsters/skeleton" },
    { index: "vampire", name: "Vampire", url: "/api/2014/monsters/vampire" },
  ],
};

const details = {
  goblin: {
    index: "goblin",
    name: "Goblin",
    size: "Small",
    type: "humanoid",
    armor_class: [{ value: 15 }],
    hit_points: 7,
    speed: { walk: "30 ft." },
    dexterity: 14,
    senses: { passive_perception: 9 },
    challenge_rating: 0.25,
    special_abilities: [],
    actions: [],
  },
  hobgoblin: {
    index: "hobgoblin",
    name: "Hobgoblin",
    size: "Medium",
    type: "humanoid",
    armor_class: [{ value: 18 }],
    hit_points: 11,
    speed: { walk: "30 ft." },
    dexterity: 12,
    senses: { passive_perception: 10 },
    challenge_rating: 0.5,
    special_abilities: [],
    actions: [],
  },
  skeleton: {
    index: "skeleton",
    name: "Skeleton",
    size: "Medium",
    type: "undead",
    armor_class: [{ value: 13 }],
    hit_points: 13,
    speed: { walk: "30 ft." },
    dexterity: 14,
    senses: { passive_perception: 9 },
    challenge_rating: 0.25,
    special_abilities: [],
    actions: [],
  },
  vampire: {
    index: "vampire",
    name: "Vampire",
    size: "Medium",
    type: "undead",
    armor_class: [{ value: 16 }],
    hit_points: 144,
    speed: { walk: "30 ft." },
    dexterity: 18,
    senses: { passive_perception: 17 },
    challenge_rating: 13,
    special_abilities: [],
    actions: [],
  },
};

const context = {
  console,
  AbortController,
  URLSearchParams,
  localStorage: storage,
  sessionStorage: storage,
  fetch: async (url) => {
    const value = String(url);
    if (
      value === "/api/compendium/dnd5e/monsters" ||
      value.endsWith("/api/2014/monsters")
    ) {
      return { ok: true, status: 200, json: async () => indexPayload };
    }

    const key = value.split("/").pop();
    if (details[key]) {
      return { ok: true, status: 200, json: async () => details[key] };
    }

    return { ok: false, status: 404, json: async () => ({}) };
  },
  ENC: {
    compendiumProviders: {},
    makeId: () => "id1",
    normalizeAbility: (value) => value,
    normalizeLibraryEntry: (value) => value,
  },
  document: { getElementById: () => null },
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(code, context);

const provider = context.ENC.compendiumProviders.dnd5eApiSrd2014;
assert(provider, "provider should be registered");
assert.strictEqual(
  context.ENC.compendiumUI.provider(),
  provider,
  "UI should resolve provider by provider.id",
);

(async () => {
  for (const [term, expected] of [
    ["goblin", 2],
    ["skeleton", 1],
    ["vampire", 1],
  ]) {
    const result = await provider.search(term, { limit: 25 });
    assert.strictEqual(result.count, expected, `${term} result count`);
    assert(result.results.length >= 1, `${term} should return at least one summary result`);
    assert.equal(result.strategy, "dnd5eapi-index-then-detail");
    assert.equal(result.results[0].__summaryOnly, true);

    const detail = await provider.getDetail(result.results[0]);
    assert.notEqual(detail.hit_points, undefined, `${term} details should hydrate on demand`);
  }

  const normalized = provider.normalizeCreature(details.goblin);
  assert.strictEqual(normalized.name, "Goblin");
  assert.strictEqual(normalized.maxHp, 7);
  assert.strictEqual(normalized.stats.armorClass, 15);
  assert.strictEqual(normalized.stats.passivePerception, 9);
  assert.strictEqual(normalized.compendiumSource.provider, "dnd5eapi-srd-2014");
  console.log("Compendium D&D 5e SRD API provider tests passed.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
