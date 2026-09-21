/*
 * Copyright (C) 2026 Zygons
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

/*
 * ============================================================
 * enCounter Timer Renderer
 * ============================================================
 *
 * Responsibilities:
 *
 * - Render timer skins.
 * - Update visual progress.
 * - Update optional numeric countdown.
 * - Apply running / paused / warning / critical / complete states.
 * - Render:
 *      Fantasy Hourglass
 *      Candle
 *      Sci-Fi Pixel Depletion
 *
 * This module DOES NOT keep track of time.
 *
 * timer.js is responsible for:
 *
 * - starting timers
 * - pausing timers
 * - resuming timers
 * - resetting timers
 * - calculating remaining milliseconds
 * - calculating remainingRatio
 *
 * remainingRatio:
 *
 *   1.00 = all time remaining
 *   0.50 = halfway
 *   0.00 = complete
 *
 * ============================================================
 */

window.ENC = window.ENC || {};

(function (ENC) {
  "use strict";

  const TIMER_RENDERER_VERSION = "1.0";

  const DEFAULT_SKIN = "hourglass";

  const SUPPORTED_SKINS = new Set(["hourglass", "candle", "scifi-pixels"]);

  const SCI_FI_PIXEL_COUNT = 64;

  /*
   * Warning thresholds.
   *
   * 25% remaining -> warning
   * 10% remaining -> critical
   */
  const WARNING_RATIO = 0.25;
  const CRITICAL_RATIO = 0.1;

  /*
   * Keep track of renderer instances.
   *
   * This allows the DM Console and Player Display to each have
   * their own renderer while using the same rendering engine.
   */
  const renderers = new Set();

  /* ============================================================
       UTILITY FUNCTIONS
    ============================================================ */

  function clamp(value, min, max) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return min;
    }

    return Math.min(max, Math.max(min, number));
  }

  function normalizeRatio(value) {
    return clamp(value, 0, 1);
  }

  function normalizeSkin(skin) {
    if (SUPPORTED_SKINS.has(skin)) {
      return skin;
    }

    return DEFAULT_SKIN;
  }

  function normalizeStatus(status) {
    switch (status) {
      case "running":
      case "paused":
      case "complete":
      case "idle":
        return status;

      default:
        return "idle";
    }
  }

  function formatTime(milliseconds) {
    let value = Number(milliseconds);

    if (!Number.isFinite(value) || value < 0) {
      value = 0;
    }

    /*
     * Use Math.ceil so a timer with 0.4 seconds remaining
     * still displays 00:01 rather than prematurely showing
     * 00:00.
     */
    const totalSeconds = Math.ceil(value / 1000);

    const hours = Math.floor(totalSeconds / 3600);

    const minutes = Math.floor((totalSeconds % 3600) / 60);

    const seconds = totalSeconds % 60;

    const paddedSeconds = String(seconds).padStart(2, "0");

    if (hours > 0) {
      return (
        String(hours).padStart(2, "0") +
        ":" +
        String(minutes).padStart(2, "0") +
        ":" +
        paddedSeconds
      );
    }

    return String(minutes).padStart(2, "0") + ":" + paddedSeconds;
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text !== undefined && text !== null) {
      element.textContent = text;
    }

    return element;
  }

  /*
   * Deterministic shuffle for Sci-Fi pixels.
   *
   * We want pixels to disappear in a visually irregular order,
   * but they must always disappear in the SAME order so the
   * visual is directly tied to remaining time.
   *
   * This is intentionally deterministic rather than random.
   */
  function createPixelDecayOrder(count) {
    const values = [];

    for (let i = 0; i < count; i += 1) {
      values.push(i);
    }

    let seed = 0x5eed1234;

    function nextRandom() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;

      return seed / 4294967296;
    }

    for (let i = values.length - 1; i > 0; i -= 1) {
      const j = Math.floor(nextRandom() * (i + 1));

      const temp = values[i];

      values[i] = values[j];
      values[j] = temp;
    }

    return values;
  }

  const SCI_FI_DECAY_ORDER = createPixelDecayOrder(SCI_FI_PIXEL_COUNT);

  /* ============================================================
       BASE TIMER STRUCTURE
    ============================================================ */

  function createBaseStructure(container) {
    container.innerHTML = "";

    const root = createElement("div", "timer-display timer-visible");

    root.setAttribute("aria-label", "enCounter timer");

    /*
     * Timer label
     */
    const label = createElement("div", "timer-label");

    /*
     * Skin container
     *
     * The selected timer skin will be inserted here.
     */
    const skinHost = createElement("div", "timer-skin-host");

    /*
     * Optional numerical countdown.
     */
    const numeric = createElement(
      "div",
      "timer-numeric timer-numeric-hidden",
      "00:00",
    );

    numeric.setAttribute("aria-live", "off");

    root.appendChild(label);
    root.appendChild(skinHost);
    root.appendChild(numeric);

    container.appendChild(root);

    return {
      root,
      label,
      skinHost,
      numeric,
    };
  }

  /* ============================================================
       HOURGLASS SKIN
    ============================================================ */

  function createHourglassSkin() {
    const hourglass = createElement("div", "timer-hourglass");

    /*
     * Outer wooden / fantasy frame.
     */
    const frame = createElement("div", "timer-hourglass-frame");

    /*
     * Glass chamber.
     */
    const glass = createElement("div", "timer-hourglass-glass");

    /*
     * Upper sand.
     */
    const topSand = createElement("div", "timer-hourglass-sand-top");

    /*
     * Lower collected sand.
     */
    const bottomSand = createElement("div", "timer-hourglass-sand-bottom");

    /*
     * Falling sand stream.
     */
    const stream = createElement("div", "timer-hourglass-stream");

    /*
     * Decorative sand particles.
     */
    const particles = createElement("div", "timer-hourglass-particles");

    for (let i = 0; i < 3; i += 1) {
      particles.appendChild(createElement("span", "timer-hourglass-particle"));
    }

    glass.appendChild(topSand);
    glass.appendChild(bottomSand);
    glass.appendChild(stream);
    glass.appendChild(particles);

    hourglass.appendChild(frame);
    hourglass.appendChild(glass);

    return {
      element: hourglass,

      refs: {
        glass,
        topSand,
        bottomSand,
        stream,
        particles,
      },
    };
  }

  function updateHourglassSkin(skin, timer, remainingRatio) {
    const status = normalizeStatus(timer.status);

    skin.element.classList.toggle("timer-idle", status === "idle");

    skin.element.classList.toggle("timer-paused", status === "paused");

    skin.element.classList.toggle(
      "timer-complete",
      status === "complete" || remainingRatio <= 0,
    );
  }

  /* ============================================================
       CANDLE SKIN
    ============================================================ */

  function createCandleSkin() {
    const candle = createElement("div", "timer-candle");

    const base = createElement("div", "timer-candle-base");

    /*
     * Candle body.
     *
     * Flame, wick and glow are children of the body so they
     * move downward naturally as the candle height decreases.
     */
    const body = createElement("div", "timer-candle-body");

    const wick = createElement("div", "timer-candle-wick");

    const glow = createElement("div", "timer-candle-glow");

    const flameWrap = createElement("div", "timer-candle-flame-wrap");

    const flame = createElement("div", "timer-candle-flame");

    const smoke = createElement("div", "timer-candle-smoke");

    flameWrap.appendChild(flame);

    body.appendChild(glow);
    body.appendChild(flameWrap);
    body.appendChild(wick);
    body.appendChild(smoke);

    candle.appendChild(base);
    candle.appendChild(body);

    return {
      element: candle,

      refs: {
        base,
        body,
        wick,
        glow,
        flameWrap,
        flame,
        smoke,
      },
    };
  }

  function updateCandleSkin(skin, timer, remainingRatio) {
    /*
     * CSS handles the actual height using:
     *
     * --timer-remaining
     *
     * This method is currently responsible only for
     * skin-specific state if needed later.
     */

    const complete = timer.status === "complete" || remainingRatio <= 0;

    skin.element.classList.toggle("timer-complete", complete);
  }

  /* ============================================================
       SCI-FI PIXEL SKIN
    ============================================================ */

  function createSciFiSkin() {
    const scifi = createElement("div", "timer-scifi");

    /*
     * Decorative animated scanning line.
     */
    const scan = createElement("div", "timer-scifi-scan");

    const heading = createElement(
      "div",
      "timer-scifi-heading",
      "TEMPORAL SEQUENCE",
    );

    const grid = createElement("div", "timer-scifi-grid");

    grid.setAttribute("aria-hidden", "true");

    const pixels = [];

    for (let i = 0; i < SCI_FI_PIXEL_COUNT; i += 1) {
      const pixel = createElement("span", "timer-scifi-pixel");

      pixel.dataset.pixelIndex = String(i);

      grid.appendChild(pixel);

      pixels.push(pixel);
    }

    const footer = createElement("div", "timer-scifi-footer");

    const footerLeft = createElement("span", "", "SEQ ACTIVE");

    const footerRight = createElement("span", "", "ENC-TMR");

    footer.appendChild(footerLeft);
    footer.appendChild(footerRight);

    scifi.appendChild(scan);
    scifi.appendChild(heading);
    scifi.appendChild(grid);
    scifi.appendChild(footer);

    return {
      element: scifi,

      refs: {
        scan,
        heading,
        grid,
        pixels,
        footer,
        footerLeft,
        footerRight,
      },

      /*
       * Store previous number of active pixels.
       *
       * This allows us to briefly animate a pixel when it
       * changes from active to depleted.
       */
      previousActiveCount: SCI_FI_PIXEL_COUNT,
    };
  }

  function updateSciFiSkin(skin, timer, remainingRatio) {
    const pixels = skin.refs.pixels;

    /*
     * Convert the exact timer percentage into the number of
     * illuminated pixels.
     *
     * Example with 64 pixels:
     *
     * 1.00 -> 64
     * 0.75 -> 48
     * 0.50 -> 32
     * 0.25 -> 16
     * 0.00 -> 0
     */
    const activeCount = Math.ceil(SCI_FI_PIXEL_COUNT * remainingRatio);

    const activeIndexes = new Set(SCI_FI_DECAY_ORDER.slice(0, activeCount));

    for (let i = 0; i < pixels.length; i += 1) {
      const pixel = pixels[i];

      const shouldBeActive = activeIndexes.has(i);

      const wasActive = !pixel.classList.contains("off");

      if (shouldBeActive) {
        pixel.classList.remove("off", "decaying");
      } else {
        /*
         * If this pixel just transitioned from ON to OFF,
         * briefly apply the decay animation.
         */
        if (wasActive) {
          pixel.classList.remove("decaying");

          /*
           * Force a reflow so repeatedly applying the
           * animation works reliably.
           */
          void pixel.offsetWidth;

          pixel.classList.add("decaying");

          window.setTimeout(() => {
            pixel.classList.remove("decaying");
          }, 300);
        }

        pixel.classList.add("off");
      }
    }

    skin.previousActiveCount = activeCount;

    /*
     * Footer status.
     */
    if (timer.status === "complete" || remainingRatio <= 0) {
      skin.refs.footerLeft.textContent = "SEQUENCE ENDED";
    } else if (timer.status === "paused") {
      skin.refs.footerLeft.textContent = "SEQUENCE HOLD";
    } else if (timer.status === "running") {
      skin.refs.footerLeft.textContent = "SEQ ACTIVE";
    } else {
      skin.refs.footerLeft.textContent = "SEQ READY";
    }
  }

  /* ============================================================
       SKIN FACTORY
    ============================================================ */

  function createSkin(skinName) {
    const normalizedSkin = normalizeSkin(skinName);

    switch (normalizedSkin) {
      case "candle":
        return {
          name: "candle",
          ...createCandleSkin(),
        };

      case "scifi-pixels":
        return {
          name: "scifi-pixels",
          ...createSciFiSkin(),
        };

      case "hourglass":
      default:
        return {
          name: "hourglass",
          ...createHourglassSkin(),
        };
    }
  }

  /* ============================================================
       WARNING / CRITICAL STATE
    ============================================================ */

  function updateWarningState(root, timer, remainingRatio) {
    root.classList.remove("timer-warning", "timer-critical");

    if (timer.status === "complete" || remainingRatio <= 0) {
      return;
    }

    if (timer.status !== "running" && timer.status !== "paused") {
      return;
    }

    if (remainingRatio <= CRITICAL_RATIO) {
      root.classList.add("timer-critical");

      return;
    }

    if (remainingRatio <= WARNING_RATIO) {
      root.classList.add("timer-warning");
    }
  }

  /* ============================================================
       TIMER ROOT STATE
    ============================================================ */

  function updateRootState(root, timer, remainingRatio) {
    const status = normalizeStatus(timer.status);

    root.classList.toggle("timer-paused", status === "paused");

    root.classList.toggle(
      "timer-complete",
      status === "complete" || remainingRatio <= 0,
    );

    root.classList.toggle("timer-hidden", timer.visible === false);

    root.classList.toggle("timer-visible", timer.visible !== false);

    /*
     * Update the CSS custom properties that drive the
     * time-accurate visual animations.
     */
    root.style.setProperty("--timer-remaining", String(remainingRatio));

    root.style.setProperty("--timer-elapsed", String(1 - remainingRatio));

    updateWarningState(root, timer, remainingRatio);
  }

  /* ============================================================
       CREATE RENDERER INSTANCE
    ============================================================ */

  function createRenderer(container) {
    /*
     * Allow either:
     *
     * ENC.timerRenderer.create("#timerPreview")
     *
     * or:
     *
     * ENC.timerRenderer.create(element)
     */
    let resolvedContainer = container;

    if (typeof container === "string") {
      resolvedContainer = document.querySelector(container);
    }

    if (!(resolvedContainer instanceof Element)) {
      throw new Error("Timer renderer requires a valid container element.");
    }

    const structure = createBaseStructure(resolvedContainer);

    let currentSkin = null;

    let destroyed = false;

    function installSkin(skinName) {
      const normalizedSkin = normalizeSkin(skinName);

      if (currentSkin && currentSkin.name === normalizedSkin) {
        return currentSkin;
      }

      structure.skinHost.innerHTML = "";

      currentSkin = createSkin(normalizedSkin);

      structure.skinHost.appendChild(currentSkin.element);

      return currentSkin;
    }

    function updateSkin(timer, remainingRatio) {
      if (!currentSkin) {
        return;
      }

      switch (currentSkin.name) {
        case "hourglass":
          updateHourglassSkin(currentSkin, timer, remainingRatio);
          break;

        case "candle":
          updateCandleSkin(currentSkin, timer, remainingRatio);
          break;

        case "scifi-pixels":
          updateSciFiSkin(currentSkin, timer, remainingRatio);
          break;

        default:
          break;
      }
    }

    function render(timer = {}, remainingRatio = 1) {
      if (destroyed) {
        return;
      }

      const ratio = normalizeRatio(remainingRatio);

      const skinName = normalizeSkin(timer.skin);

      installSkin(skinName);

      /*
       * Label
       */
      structure.label.textContent = timer.name || timer.label || "";

      structure.label.hidden = structure.label.textContent.trim() === "";

      /*
       * Numeric timer
       */
      const showNumeric =
        timer.showNumeric === true || timer.showNumericToPlayers === true;

      structure.numeric.classList.toggle("timer-numeric-hidden", !showNumeric);

      if (showNumeric) {
        const remainingMs = Number.isFinite(Number(timer.remainingMs))
          ? Number(timer.remainingMs)
          : Number(timer.durationMs || 0) * ratio;

        structure.numeric.textContent = formatTime(remainingMs);
      }

      /*
       * Root timer state.
       */
      updateRootState(structure.root, timer, ratio);

      /*
       * Skin-specific changes.
       */
      updateSkin(timer, ratio);
    }

    function clear() {
      if (destroyed) {
        return;
      }

      structure.label.textContent = "";

      structure.numeric.textContent = "00:00";

      structure.root.classList.remove(
        "timer-warning",
        "timer-critical",
        "timer-paused",
        "timer-complete",
      );

      structure.root.style.setProperty("--timer-remaining", "1");

      structure.root.style.setProperty("--timer-elapsed", "0");

      if (currentSkin) {
        structure.skinHost.innerHTML = "";
        currentSkin = null;
      }
    }

    function setVisible(visible) {
      if (destroyed) {
        return;
      }

      structure.root.classList.toggle("timer-hidden", visible === false);

      structure.root.classList.toggle("timer-visible", visible !== false);
    }

    function destroy() {
      if (destroyed) {
        return;
      }

      destroyed = true;

      renderers.delete(api);

      resolvedContainer.innerHTML = "";

      currentSkin = null;
    }

    const api = {
      render,
      clear,
      setVisible,
      destroy,

      get element() {
        return structure.root;
      },

      get skin() {
        return currentSkin ? currentSkin.name : null;
      },
    };

    renderers.add(api);

    return api;
  }

  /* ============================================================
       PUBLIC API
    ============================================================ */

  ENC.timerRenderer = {
    VERSION: TIMER_RENDERER_VERSION,

    skins: Object.freeze(["hourglass", "candle", "scifi-pixels"]),

    create: createRenderer,

    formatTime,

    normalizeRatio,

    /*
     * Primarily useful for debugging.
     */
    getRendererCount() {
      return renderers.size;
    },
  };
})(window.ENC);
