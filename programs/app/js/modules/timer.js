/*
 * Copyright (C) 2026 Zygons
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

/*
 * ============================================================
 * enCounter Visual Timer Engine
 * ============================================================
 *
 * Responsibilities:
 *
 * - Maintain timer state.
 * - Start countdowns.
 * - Pause countdowns.
 * - Resume countdowns.
 * - Reset countdowns.
 * - Stop countdowns.
 * - Add or subtract time.
 * - Calculate accurate remaining time.
 * - Drive timer-renderer.js.
 * - Export/import timer state for Player Display synchronization.
 *
 * IMPORTANT:
 *
 * This module does NOT count downward by subtracting a fixed
 * amount every second.
 *
 * Instead, a running timer stores an absolute ending timestamp:
 *
 *     endAt = Date.now() + remainingMs
 *
 * Every rendered frame calculates:
 *
 *     remainingMs = endAt - Date.now()
 *
 * This prevents timer drift and allows the Player Display to
 * independently render the same timer accurately.
 *
 * ============================================================
 */

window.ENC = window.ENC || {};

(function (ENC) {
  "use strict";

  const TIMER_VERSION = "1.0";

  const DEFAULT_DURATION_MS = 5 * 60 * 1000;

  const DEFAULT_STATE = Object.freeze({
    id: "primary-timer",

    name: "Countdown",

    /*
     * Only countdown is active in the first implementation.
     *
     * Future values may include:
     *
     * countup
     * rounds
     */
    mode: "countdown",

    /*
     * Timer skin names must match timer-renderer.js.
     */
    skin: "hourglass",

    /*
     * Full configured duration.
     */
    durationMs: DEFAULT_DURATION_MS,

    /*
     * Amount of time currently remaining.
     *
     * While running this value is refreshed from endAt.
     */
    remainingMs: DEFAULT_DURATION_MS,

    /*
     * Absolute JavaScript timestamp for timer completion.
     *
     * null when idle, paused, stopped or complete.
     */
    endAt: null,

    /*
     * idle
     * running
     * paused
     * complete
     */
    status: "idle",

    /*
     * Whether the timer is visible on the Player Display.
     */
    visibleToPlayers: false,

    /*
     * DM may always choose to see exact time in the preview.
     */
    showNumericToDM: true,

    /*
     * Whether players see exact numerical time.
     */
    showNumericToPlayers: false,

    /*
     * Initial display mode.
     *
     * overlay
     * featured
     * focus
     */
    displayMode: "overlay",
  });

  const VALID_SKINS = new Set(["hourglass", "candle", "scifi-pixels"]);

  const VALID_STATUSES = new Set(["idle", "running", "paused", "complete"]);

  const VALID_DISPLAY_MODES = new Set(["overlay", "featured", "focus"]);

  /*
   * Registry primarily useful for debugging and future cleanup.
   */
  const controllers = new Set();

  /* ============================================================
       GENERAL UTILITIES
    ============================================================ */

  function clamp(value, min, max) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return min;
    }

    return Math.min(max, Math.max(min, number));
  }

  function normalizeMilliseconds(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return 0;
    }

    return Math.max(0, Math.round(number));
  }

  function normalizeSkin(value) {
    if (VALID_SKINS.has(value)) {
      return value;
    }

    return DEFAULT_STATE.skin;
  }

  function normalizeStatus(value) {
    if (VALID_STATUSES.has(value)) {
      return value;
    }

    return "idle";
  }

  function normalizeDisplayMode(value) {
    if (VALID_DISPLAY_MODES.has(value)) {
      return value;
    }

    return DEFAULT_STATE.displayMode;
  }

  function createTimerId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return (
      "timer-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10)
    );
  }

  function cloneState(state) {
    return {
      id: state.id,
      name: state.name,
      mode: state.mode,
      skin: state.skin,

      durationMs: state.durationMs,
      remainingMs: state.remainingMs,

      endAt: state.endAt,

      status: state.status,

      visibleToPlayers: state.visibleToPlayers,

      showNumericToDM: state.showNumericToDM,

      showNumericToPlayers: state.showNumericToPlayers,

      displayMode: state.displayMode,
    };
  }

  function sanitizeState(input = {}) {
    let durationMs = normalizeMilliseconds(input.durationMs);

    if (durationMs <= 0) {
      durationMs = DEFAULT_STATE.durationMs;
    }

    let remainingMs;

    if (input.remainingMs === undefined || input.remainingMs === null) {
      remainingMs = durationMs;
    } else {
      remainingMs = normalizeMilliseconds(input.remainingMs);
    }

    /*
     * A timer can have more remaining time than its original
     * duration if the DM added time.
     *
     * If that occurs, expand duration to match.
     */
    if (remainingMs > durationMs) {
      durationMs = remainingMs;
    }

    const status = normalizeStatus(input.status);

    let endAt = null;

    if (status === "running" && Number.isFinite(Number(input.endAt))) {
      endAt = Number(input.endAt);
    }

    return {
      id:
        typeof input.id === "string" && input.id.trim()
          ? input.id.trim()
          : createTimerId(),

      name:
        typeof input.name === "string" ? input.name.trim() : DEFAULT_STATE.name,

      mode: "countdown",

      skin: normalizeSkin(input.skin),

      durationMs,
      remainingMs,

      endAt,

      status,

      visibleToPlayers: input.visibleToPlayers === true,

      showNumericToDM: input.showNumericToDM !== false,

      showNumericToPlayers: input.showNumericToPlayers === true,

      displayMode: normalizeDisplayMode(input.displayMode),
    };
  }

  /* ============================================================
       TIMER CONTROLLER
    ============================================================ */

  function createTimer(options = {}) {
    /*
     * Optional renderer created by timer-renderer.js.
     *
     * Example:
     *
     * const renderer =
     *     ENC.timerRenderer.create("#timerPreview");
     *
     * const timer =
     *     ENC.timer.create({
     *         renderer: renderer
     *     });
     */
    let renderer = options.renderer || null;

    /*
     * audience determines what the renderer should see.
     *
     * dm
     * player
     *
     * DM preview is always visible.
     *
     * Player rendering respects visibleToPlayers.
     */
    const audience = options.audience === "player" ? "player" : "dm";

    /*
     * Optional integration hooks.
     *
     * We are deliberately NOT hard-wiring BroadcastChannel
     * here yet.
     *
     * main.js / display.js can connect these hooks to the
     * existing enCounter synchronization system.
     */
    const onStateChange =
      typeof options.onStateChange === "function"
        ? options.onStateChange
        : null;

    const onComplete =
      typeof options.onComplete === "function" ? options.onComplete : null;

    let state = sanitizeState({
      ...DEFAULT_STATE,
      ...(options.initialState || {}),
    });

    let animationFrameId = null;

    let destroyed = false;

    let completionNotified = false;

    /* ========================================================
           CURRENT TIME CALCULATION
        ======================================================== */

    function calculateRemainingMs() {
      if (state.status !== "running") {
        return state.remainingMs;
      }

      if (!Number.isFinite(state.endAt)) {
        return state.remainingMs;
      }

      return Math.max(0, state.endAt - Date.now());
    }

    function syncRemainingFromClock() {
      if (state.status !== "running") {
        return state.remainingMs;
      }

      state.remainingMs = calculateRemainingMs();

      return state.remainingMs;
    }

    function calculateRemainingRatio() {
      const duration = Math.max(1, state.durationMs);

      const remaining =
        state.status === "running" ? calculateRemainingMs() : state.remainingMs;

      return clamp(remaining / duration, 0, 1);
    }

    /* ========================================================
           RENDER STATE
        ======================================================== */

    function createRenderState() {
      syncRemainingFromClock();

      /*
       * The renderer uses the generic "visible" and
       * "showNumeric" properties.
       *
       * Resolve those based on whether this controller is
       * rendering the DM Console or Player Display.
       */
      return {
        ...cloneState(state),

        visible: audience === "player" ? state.visibleToPlayers : true,

        showNumeric:
          audience === "player"
            ? state.showNumericToPlayers
            : state.showNumericToDM,
      };
    }

    function render() {
      if (destroyed) {
        return;
      }

      if (!renderer || typeof renderer.render !== "function") {
        return;
      }

      const ratio = calculateRemainingRatio();

      renderer.render(createRenderState(), ratio);
    }

    /* ========================================================
           NOTIFICATIONS / SYNC HOOK
        ======================================================== */

    function notifyStateChange(reason) {
      if (destroyed) {
        return;
      }

      /*
       * Make sure a running timer exports the most recent
       * remaining time.
       */
      syncRemainingFromClock();

      if (onStateChange) {
        onStateChange(cloneState(state), reason);
      }
    }

    /* ========================================================
           ANIMATION LOOP
        ======================================================== */

    function cancelAnimationLoop() {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);

        animationFrameId = null;
      }
    }

    function finishTimer() {
      cancelAnimationLoop();

      state.remainingMs = 0;
      state.endAt = null;
      state.status = "complete";

      render();

      notifyStateChange("complete");

      if (!completionNotified && onComplete) {
        completionNotified = true;

        onComplete(cloneState(state));
      }
    }

    function animationLoop() {
      if (destroyed) {
        return;
      }

      if (state.status !== "running") {
        animationFrameId = null;
        return;
      }

      const remaining = syncRemainingFromClock();

      if (remaining <= 0) {
        finishTimer();
        return;
      }

      render();

      animationFrameId = window.requestAnimationFrame(animationLoop);
    }

    function startAnimationLoop() {
      cancelAnimationLoop();

      if (state.status !== "running") {
        return;
      }

      animationFrameId = window.requestAnimationFrame(animationLoop);
    }

    /* ========================================================
           START
        ======================================================== */

    function start() {
      if (destroyed) {
        return false;
      }

      if (state.status === "running") {
        return true;
      }

      /*
       * Starting a completed timer begins it again from the
       * configured duration.
       */
      if (state.status === "complete" || state.remainingMs <= 0) {
        state.remainingMs = state.durationMs;
      }

      completionNotified = false;

      state.endAt = Date.now() + state.remainingMs;

      state.status = "running";

      render();

      notifyStateChange("start");

      startAnimationLoop();

      return true;
    }

    /* ========================================================
           PAUSE
        ======================================================== */

    function pause() {
      if (destroyed) {
        return false;
      }

      if (state.status !== "running") {
        return false;
      }

      state.remainingMs = calculateRemainingMs();

      state.endAt = null;

      state.status = "paused";

      cancelAnimationLoop();

      render();

      notifyStateChange("pause");

      return true;
    }

    /* ========================================================
           RESUME
        ======================================================== */

    function resume() {
      if (destroyed) {
        return false;
      }

      if (state.status !== "paused") {
        return false;
      }

      if (state.remainingMs <= 0) {
        finishTimer();
        return false;
      }

      completionNotified = false;

      state.endAt = Date.now() + state.remainingMs;

      state.status = "running";

      render();

      notifyStateChange("resume");

      startAnimationLoop();

      return true;
    }

    /* ========================================================
           RESET
        ======================================================== */

    function reset() {
      if (destroyed) {
        return false;
      }

      cancelAnimationLoop();

      state.remainingMs = state.durationMs;

      state.endAt = null;

      state.status = "idle";

      completionNotified = false;

      render();

      notifyStateChange("reset");

      return true;
    }

    /* ========================================================
           STOP
        ======================================================== */

    function stop() {
      if (destroyed) {
        return false;
      }

      if (state.status === "running") {
        state.remainingMs = calculateRemainingMs();
      }

      cancelAnimationLoop();

      state.endAt = null;

      /*
       * Stop preserves the current remaining time.
       *
       * Reset restores the full configured duration.
       */
      state.status = "idle";

      completionNotified = false;

      render();

      notifyStateChange("stop");

      return true;
    }

    /* ========================================================
           DURATION
        ======================================================== */

    function setDuration(milliseconds) {
      if (destroyed) {
        return false;
      }

      const newDuration = normalizeMilliseconds(milliseconds);

      if (newDuration <= 0) {
        return false;
      }

      cancelAnimationLoop();

      state.durationMs = newDuration;

      state.remainingMs = newDuration;

      state.endAt = null;

      state.status = "idle";

      completionNotified = false;

      render();

      notifyStateChange("duration");

      return true;
    }

    /* ========================================================
           ADD / SUBTRACT TIME
        ======================================================== */

    function adjustTime(deltaMilliseconds) {
      if (destroyed) {
        return false;
      }

      const delta = Number(deltaMilliseconds);

      if (!Number.isFinite(delta)) {
        return false;
      }

      if (state.status === "running") {
        state.remainingMs = calculateRemainingMs();
      }

      let newRemaining = state.remainingMs + delta;

      newRemaining = Math.max(0, newRemaining);

      /*
       * If the DM adds enough time that the remaining value
       * exceeds the original configured duration, expand the
       * duration.
       *
       * Example:
       *
       * 10:00 timer
       * currently 10:00
       * DM presses +1 minute
       *
       * new duration  = 11:00
       * new remaining = 11:00
       */
      if (newRemaining > state.durationMs) {
        state.durationMs = newRemaining;
      }

      state.remainingMs = newRemaining;

      if (newRemaining <= 0) {
        finishTimer();
        return true;
      }

      if (state.status === "running") {
        state.endAt = Date.now() + newRemaining;
      } else {
        state.endAt = null;

        if (state.status === "complete") {
          state.status = "paused";
        }
      }

      completionNotified = false;

      render();

      notifyStateChange(delta >= 0 ? "add-time" : "subtract-time");

      if (state.status === "running") {
        startAnimationLoop();
      }

      return true;
    }

    function addTime(milliseconds) {
      return adjustTime(Math.abs(Number(milliseconds) || 0));
    }

    function subtractTime(milliseconds) {
      return adjustTime(-Math.abs(Number(milliseconds) || 0));
    }

    /* ========================================================
           TIMER NAME
        ======================================================== */

    function setName(name) {
      if (destroyed) {
        return false;
      }

      state.name = typeof name === "string" ? name.trim() : "";

      render();

      notifyStateChange("name");

      return true;
    }

    /* ========================================================
           TIMER SKIN
        ======================================================== */

    function setSkin(skin) {
      if (destroyed) {
        return false;
      }

      if (!VALID_SKINS.has(skin)) {
        return false;
      }

      state.skin = skin;

      render();

      notifyStateChange("skin");

      return true;
    }

    /* ========================================================
           PLAYER VISIBILITY
        ======================================================== */

    function setVisibleToPlayers(visible) {
      if (destroyed) {
        return false;
      }

      state.visibleToPlayers = visible === true;

      render();

      notifyStateChange("visibility");

      return true;
    }

    function showToPlayers() {
      return setVisibleToPlayers(true);
    }

    function hideFromPlayers() {
      return setVisibleToPlayers(false);
    }

    /* ========================================================
           NUMERIC DISPLAY
        ======================================================== */

    function setShowNumericToPlayers(show) {
      if (destroyed) {
        return false;
      }

      state.showNumericToPlayers = show === true;

      render();

      notifyStateChange("player-numeric");

      return true;
    }

    function setShowNumericToDM(show) {
      if (destroyed) {
        return false;
      }

      state.showNumericToDM = show !== false;

      render();

      notifyStateChange("dm-numeric");

      return true;
    }

    /* ========================================================
           DISPLAY MODE
        ======================================================== */

    function setDisplayMode(mode) {
      if (destroyed) {
        return false;
      }

      if (!VALID_DISPLAY_MODES.has(mode)) {
        return false;
      }

      state.displayMode = mode;

      render();

      notifyStateChange("display-mode");

      return true;
    }

    /* ========================================================
           RENDERER
        ======================================================== */

    function setRenderer(newRenderer) {
      if (destroyed) {
        return false;
      }

      renderer = newRenderer || null;

      render();

      return true;
    }

    /* ========================================================
           STATE EXPORT
        ======================================================== */

    function getState() {
      if (destroyed) {
        return null;
      }

      syncRemainingFromClock();

      return cloneState(state);
    }

    function getRemainingMs() {
      if (destroyed) {
        return 0;
      }

      return calculateRemainingMs();
    }

    function getRemainingRatio() {
      if (destroyed) {
        return 0;
      }

      return calculateRemainingRatio();
    }

    /* ========================================================
           IMPORT / REMOTE STATE
        ======================================================== */

    function setState(incomingState, options = {}) {
      if (destroyed) {
        return false;
      }

      cancelAnimationLoop();

      state = sanitizeState(incomingState);

      /*
       * A remote running timer should normally include
       * endAt.
       *
       * If it does not, rebuild it from remainingMs.
       */
      if (state.status === "running" && !Number.isFinite(state.endAt)) {
        state.endAt = Date.now() + state.remainingMs;
      }

      /*
       * If the remote end time has already passed, show the
       * completed state immediately.
       */
      if (state.status === "running" && state.endAt <= Date.now()) {
        state.remainingMs = 0;
        state.endAt = null;
        state.status = "complete";
      }

      completionNotified = state.status === "complete";

      render();

      /*
       * Normally remote synchronization should not be
       * rebroadcast, otherwise DM and Player Display could
       * bounce the same timer update back and forth.
       */
      if (options.notify === true) {
        notifyStateChange(options.reason || "set-state");
      }

      if (state.status === "running") {
        startAnimationLoop();
      }

      return true;
    }

    /*
     * Convenience alias specifically intended for data that
     * arrived from another display/window.
     */
    function applyRemoteState(incomingState) {
      return setState(incomingState, {
        notify: false,
      });
    }

    /* ========================================================
           PAGE VISIBILITY
        ======================================================== */

    /*
     * requestAnimationFrame may be throttled or completely
     * paused when a browser tab/window is not visible.
     *
     * That is okay because the timer uses an absolute endAt.
     *
     * When the document becomes visible again, immediately
     * recalculate from Date.now().
     */
    function handleVisibilityChange() {
      if (destroyed) {
        return;
      }

      if (state.status !== "running") {
        return;
      }

      const remaining = syncRemainingFromClock();

      if (remaining <= 0) {
        finishTimer();
        return;
      }

      render();

      if (!document.hidden) {
        startAnimationLoop();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    /* ========================================================
           DESTROY
        ======================================================== */

    function destroy() {
      if (destroyed) {
        return;
      }

      destroyed = true;

      cancelAnimationLoop();

      document.removeEventListener("visibilitychange", handleVisibilityChange);

      controllers.delete(api);

      renderer = null;
    }

    /* ========================================================
           PUBLIC CONTROLLER API
        ======================================================== */

    const api = {
      start,
      pause,
      resume,
      reset,
      stop,

      setDuration,

      adjustTime,
      addTime,
      subtractTime,

      setName,
      setSkin,

      setVisibleToPlayers,
      showToPlayers,
      hideFromPlayers,

      setShowNumericToPlayers,
      setShowNumericToDM,

      setDisplayMode,

      setRenderer,

      getState,
      getRemainingMs,
      getRemainingRatio,

      setState,
      applyRemoteState,

      render,

      destroy,

      get status() {
        return state.status;
      },

      get running() {
        return state.status === "running";
      },

      get paused() {
        return state.status === "paused";
      },

      get complete() {
        return state.status === "complete";
      },
    };

    controllers.add(api);

    /*
     * Render the initial state immediately.
     */
    render();

    /*
     * If an imported initial state is already running,
     * continue rendering from its absolute end timestamp.
     */
    if (state.status === "running") {
      if (!Number.isFinite(state.endAt)) {
        state.endAt = Date.now() + state.remainingMs;
      }

      startAnimationLoop();
    }

    return api;
  }

  /* ============================================================
       PUBLIC ENC API
    ============================================================ */

  ENC.timer = {
    VERSION: TIMER_VERSION,

    DEFAULT_DURATION_MS,

    skins: Object.freeze(["hourglass", "candle", "scifi-pixels"]),

    displayModes: Object.freeze(["overlay", "featured", "focus"]),

    create: createTimer,

    createDefaultState() {
      return sanitizeState({
        ...DEFAULT_STATE,
        id: createTimerId(),
      });
    },

    getControllerCount() {
      return controllers.size;
    },
  };
})(window.ENC);
