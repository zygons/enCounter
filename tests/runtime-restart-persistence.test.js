/*
 * Phase 3.1.14.2 runtime restart persistence contracts.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function loadHarness() {
  let idCounter = 0;
  const storage = new Map();
  const window = {
    ENC: {},
    location: { origin: "http://127.0.0.1:5500" },
    crypto: {
      randomUUID() {
        idCounter += 1;
        return `00000000-0000-4000-8000-${String(idCounter).padStart(12, "0")}`;
      },
    },
    addEventListener() {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  };
  const document = {
    body: { dataset: {} },
    hidden: false,
    addEventListener() {},
    getElementById() { return null; },
    querySelectorAll() { return []; },
  };
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); },
  };

  const context = vm.createContext({
    window,
    ENC: window.ENC,
    document,
    localStorage,
    URL,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Date,
    Math,
    JSON,
  });

  for (const relative of [
    "programs/app/js/core/config.js",
    "programs/app/js/core/db.js",
    "programs/app/js/main.js",
  ]) {
    const filename = path.join(root, relative);
    vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
  }

  const ENC = window.ENC;
  const meta = new Map();
  ENC.db.getMetaRecord = async (key) => meta.get(String(key)) || null;
  ENC.db.saveMetaRecord = async (key, value) => {
    const record = { key: String(key), ...ENC.deepClone(value) };
    meta.set(String(key), record);
    return record;
  };
  ENC.db.delete = async (storeName, key) => {
    if (storeName === "meta") meta.delete(String(key));
  };

  ENC.combat = {
    encounter: ENC.normalizeEncounter({
      id: "active",
      kind: "active",
      name: "Restart Test",
      systemId: "dnd5e",
      timer: {
        name: "Reinforcements",
        durationMs: 600000,
        skin: "scifi-pixels",
        visibleToPlayers: true,
        showNumericToDM: true,
        showNumericToPlayers: true,
        displayMode: "featured",
      },
    }),
  };

  let timerState = {
    id: "primary-timer",
    name: "Reinforcements",
    mode: "countdown",
    skin: "scifi-pixels",
    durationMs: 600000,
    remainingMs: 187000,
    endAt: Date.now() + 187000,
    status: "running",
    visibleToPlayers: true,
    showNumericToDM: true,
    showNumericToPlayers: true,
    displayMode: "featured",
  };

  ENC.app.timerController = {
    getState() { return ENC.deepClone(timerState); },
    setState(next) { timerState = ENC.deepClone(next); return true; },
  };
  ENC.app.setTimerConfigInputs = () => {};
  ENC.app.updateTimerUI = () => {};
  ENC.app.broadcastTimerState = () => {};

  return {
    ENC,
    meta,
    getTimerState: () => ENC.deepClone(timerState),
    setTimerState: (next) => { timerState = ENC.deepClone(next); },
  };
}

test("running timer is checkpointed as paused for restart recovery", async () => {
  const { ENC, meta } = loadHarness();

  const persisted = await ENC.app.persistRuntimeTimerCheckpoint();
  assert.equal(persisted, true);

  const record = meta.get("active-timer-runtime");
  assert.ok(record);
  assert.equal(record.checkpoint.status, "paused");
  assert.equal(record.checkpoint.remainingMs, 187000);
  assert.equal(record.checkpoint.endAt, null);
});

test("restart restores runtime timer paused at checkpoint without counting closed time", async () => {
  const { ENC, meta, getTimerState, setTimerState } = loadHarness();

  await ENC.app.persistRuntimeTimerCheckpoint();
  setTimerState({
    ...getTimerState(),
    status: "idle",
    durationMs: 600000,
    remainingMs: 600000,
    endAt: null,
  });

  const restored = await ENC.app.restoreRuntimeTimerCheckpoint({ broadcast: false });
  assert.equal(restored, true);
  assert.equal(getTimerState().status, "paused");
  assert.equal(getTimerState().remainingMs, 187000);
  assert.equal(meta.get("active-timer-runtime").checkpoint.remainingMs, 187000);
});

test("reset-ready timer clears stale runtime checkpoint", async () => {
  const { ENC, meta, getTimerState, setTimerState } = loadHarness();

  await ENC.app.persistRuntimeTimerCheckpoint();
  assert.ok(meta.has("active-timer-runtime"));

  setTimerState({
    ...getTimerState(),
    status: "idle",
    remainingMs: 600000,
    endAt: null,
  });

  const persisted = await ENC.app.persistRuntimeTimerCheckpoint();
  assert.equal(persisted, false);
  assert.equal(meta.has("active-timer-runtime"), false);
});

test("runtime checkpoint is considered meaningful even for an otherwise blank encounter", async () => {
  const { ENC } = loadHarness();
  assert.equal(
    ENC.app.runtimeTimerCheckpointIsMeaningful({
      status: "paused",
      durationMs: 600000,
      remainingMs: 599000,
    }),
    true,
  );
  assert.equal(
    ENC.app.runtimeTimerCheckpointIsMeaningful({
      status: "idle",
      durationMs: 600000,
      remainingMs: 600000,
    }),
    false,
  );
});
