/*
 * Copyright (C) 2026 Zygons
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

ENC.display = {
  encounter: null,
  lastDmSeenAt: 0,
  connectionTimer: null,

  // Visual Timer state
  timerRenderer: null,
  timerController: null,

  // Player Display presentation state
  displayMode: "standby",
  paused: true,
  awaitingDmState: true,
  currentUiTheme: null,
  lastInitiativeSignature: null,
  lastCenteredCurrentId: null,

  applyTheme(theme = null) {
    /*
     * UI theme and presentation mode are independent state.
     * Once a Player Display theme is established, Scene / Combat / Standby
     * transitions must never replace it. Only an explicit theme update
     * (Settings or cross-window storage change) may change the theme.
     */
    const requested =
      theme ||
      this.currentUiTheme ||
      document.body?.dataset?.uiTheme ||
      localStorage.getItem("encounter-ui-theme") ||
      "scifi";
    this.currentUiTheme = ENC.applyUiTheme(requested);
    return this.currentUiTheme;
  },

  /* ========================================
       LOAD ACTIVE ENCOUNTER
    ======================================== */

  async load() {
    this.encounter = ENC.normalizeEncounter(await ENC.db.getActiveEncounter());

    this.render();
  },

  /* ========================================
       DETERMINE WHETHER COMBATANT
       CAN TAKE A NORMAL TURN
    ======================================== */

  isTurnEligible(combatant) {
    return ENC.isTurnEligibleCombatant(combatant);
  },

  /* ========================================
       CONNECTION STATUS
    ======================================== */

  setConnectionState(state) {
    const indicator = document.getElementById("displayConnectionStatus");

    if (!indicator) return;

    indicator.classList.remove("connecting", "connected", "disconnected");

    indicator.classList.add(state);

    const labels = {
      connecting: "DM SYNC: CONNECTING…",
      connected: "DM SYNC: CONNECTED",
      disconnected: "DM SYNC: DISCONNECTED",
    };

    indicator.textContent = labels[state] || labels.disconnected;
  },

  markDmSeen() {
    this.lastDmSeenAt = Date.now();

    this.setConnectionState("connected");
  },

  /* ========================================
       PLAYER DISPLAY PRIVACY
    ======================================== */

  setDisplayMode(mode) {
    /*
     * Presentation changes do not touch the UI theme.
     * This prevents Show Scene / Show Combat / End Combat from ever
     * switching a Fantasy display back to Sci-Fi.
     */
    this.displayMode = ENC.PLAYER_DISPLAY_MODES.has(mode) ? mode : "standby";
    this.paused = this.displayMode === "standby";
    document.body.dataset.displayMode = this.displayMode;

    if (this.displayMode !== "scene") this.hideScenePresentation();

    const overlay = document.getElementById("playerDisplayPrivacyOverlay");
    if (overlay)
      overlay.classList.toggle("show", this.paused || this.awaitingDmState);

    this.updateTimerLayer();
    if (!this.paused && !this.awaitingDmState) this.render();

    // Acknowledge the applied presentation mode so the DM Console can show
    // whether Scene / Combat / Stand By has actually reached this display.
    ENC.sync.broadcast("display-mode-applied", {
      sentAt: Date.now(),
      mode: this.displayMode,
    });
  },

  setPaused(paused) {
    this.paused = Boolean(paused);
    if (this.paused) this.displayMode = "standby";
    else if (this.displayMode === "standby")
      this.displayMode =
        this.encounter?.phase === "combat" ? "combat" : "scene";
    document.body.dataset.displayMode = this.displayMode;

    const overlay = document.getElementById("playerDisplayPrivacyOverlay");

    if (overlay) {
      overlay.classList.toggle("show", this.paused || this.awaitingDmState);
    }

    /*
     * Also hide the visual timer while the
     * Player Display privacy screen is active.
     */
    this.updateTimerLayer();
  },

  /* ========================================
       VISUAL TIMER
    ======================================== */

  initializeTimer() {
    if (!ENC.timerRenderer || typeof ENC.timerRenderer.create !== "function") {
      throw new Error(
        "Timer renderer did not load. Check js/modules/timer-renderer.js.",
      );
    }

    if (!ENC.timer || typeof ENC.timer.create !== "function") {
      throw new Error("Timer engine did not load. Check js/modules/timer.js.");
    }

    const timerContainer = document.getElementById("playerTimer");

    if (!timerContainer) {
      throw new Error("Player Display timer container was not found.");
    }

    /*
     * Create one renderer for the Player Display.
     *
     * Overlay / Featured / Focus all reuse this
     * same renderer. We simply change the outer
     * layer classes.
     */
    this.timerRenderer = ENC.timerRenderer.create(timerContainer);

    this.timerController = ENC.timer.create({
      renderer: this.timerRenderer,

      audience: "player",

      initialState: {
        id: "primary-timer",

        name: "Countdown",

        mode: "countdown",

        skin: "hourglass",

        durationMs: ENC.timer.DEFAULT_DURATION_MS || 300000,

        remainingMs: ENC.timer.DEFAULT_DURATION_MS || 300000,

        endAt: null,

        status: "idle",

        visibleToPlayers: false,

        showNumericToDM: true,

        showNumericToPlayers: false,

        displayMode: "overlay",
      },

      /*
       * The Player Display never owns timer
       * state and never broadcasts changes.
       *
       * The DM Console is authoritative.
       */
      onComplete: () => {
        this.updateTimerLayer();
      },
    });

    this.updateTimerLayer();
  },

  /* ----------------------------------------
     APPLY TIMER STATE FROM DM
     ---------------------------------------- */

  applyTimerState(timerState) {
    if (!this.timerController || !timerState) {
      return;
    }

    /*
     * applyRemoteState() updates the Player
     * timer without causing another broadcast.
     *
     * If the timer is running, the shared endAt
     * value allows this window to independently
     * calculate the correct remaining time.
     */
    this.timerController.applyRemoteState(timerState);

    this.updateTimerLayer();
  },

  /* ----------------------------------------
     SHOW / HIDE PLAYER TIMER
     ---------------------------------------- */

  updateTimerLayer() {
    const layer = document.getElementById("playerTimerLayer");

    if (!layer) {
      return;
    }

    const state = this.timerController?.getState() || null;

    /*
     * Timer visibility requires all three:
     *
     * 1. DM selected Show Timer to Players.
     * 2. Player Display itself is not hidden.
     * 3. Initial DM state has been received.
     */
    const visible =
      Boolean(state?.visibleToPlayers) && !this.paused && !this.awaitingDmState;

    const mode = state?.displayMode || "overlay";

    /*
     * Remove all prior mode classes.
     *
     * The exact timer visual remains mounted
     * inside #playerTimer.
     */
    layer.className = "";

    /* --------------------------------------
       FOCUS MODE
       -------------------------------------- */

    if (mode === "focus") {
      layer.classList.add("player-timer-focus");

      if (visible) {
        layer.classList.add("show");
      }
    } else {
      /* --------------------------------------
       OVERLAY / FEATURED MODE
       -------------------------------------- */
      layer.classList.add("player-timer-overlay");

      if (mode === "featured") {
        layer.classList.add("timer-mode-featured");
      }

      if (!visible) {
        layer.classList.add("timer-overlay-hidden");
      }
    }

    /*
     * The hidden property prevents an invisible
     * timer from intercepting mouse events or
     * occupying accessible UI.
     */
    layer.hidden = !visible;

    layer.setAttribute("aria-hidden", visible ? "false" : "true");
  },

  /* ========================================
       REQUEST DM PRESENCE
    ======================================== */

  requestDmPresence() {
    ENC.sync.broadcast("display-hello", {
      sentAt: Date.now(),
    });
  },

  startConnectionMonitor() {
    this.setConnectionState("connecting");

    this.requestDmPresence();

    clearInterval(this.connectionTimer);

    this.connectionTimer = setInterval(() => {
      this.requestDmPresence();

      const age = this.lastDmSeenAt ? Date.now() - this.lastDmSeenAt : Infinity;

      if (age > ENC.DM_PRESENCE_TIMEOUT_MS) {
        this.setConnectionState("disconnected");
      }
    }, ENC.DISPLAY_PRESENCE_PING_MS);
  },

  /* ========================================
       FIND NEXT ACTIVE COMBATANT
    ======================================== */

  nextActive(currentId) {
    return ENC.findNextPlayerVisibleEligibleCombatant(
      this.encounter?.combatants || [],
      currentId,
    );
  },

  /* ========================================
       CREATE STATUS BADGE
    ======================================== */

  badge(text, className = "") {
    const span = document.createElement("span");

    span.className = `display-badge ${className}`;

    span.textContent = text;

    return span;
  },

  /* ========================================
       SHOW / HIDE BETWEEN-ENCOUNTERS LOGO
    ======================================== */

  updateIdleLogo(hasCombatants) {
    const idleLogo = document.getElementById("idleLogoBackdrop");

    if (!idleLogo) {
      return;
    }

    idleLogo.classList.toggle("show", !hasCombatants);
  },

  /* ========================================
       SCENE PRESENTATION CONTENT
    ======================================== */

  updateScenePresentation(sceneImage = "") {
    const presentation = document.getElementById("scenePresentation");
    const title = document.getElementById("scenePresentationTitle");
    const subtitle = document.getElementById("scenePresentationSubtitle");

    if (!presentation) return;

    const hasBackground = Boolean(sceneImage);
    presentation.classList.add("show");
    presentation.classList.toggle("has-background", hasBackground);

    if (title) title.textContent = this.encounter?.name || "Encounter Scene";
    if (subtitle) {
      subtitle.textContent = hasBackground
        ? "Scene"
        : "Scene • No background configured";
    }
  },

  hideScenePresentation() {
    const presentation = document.getElementById("scenePresentation");
    presentation?.classList.remove("show", "has-background");
  },


  /* ========================================
       ENCOUNTER BACKGROUND PRESENTATION

       Always set sizing explicitly instead of relying on the CSS cascade.
       This prevents Scene mode from falling back to the browser default
       repeating background behavior when themes or presentation rules change.
    ======================================== */

  applyEncounterBackground(image = "") {
    const background = document.getElementById("displayBackground");
    if (!background) return;

    const safeImage = typeof image === "string" ? image.trim() : "";
    background.style.backgroundImage = safeImage
      ? `url("${safeImage.replace(/"/g, "%22")}")`
      : "";
    background.style.backgroundRepeat = "no-repeat";
    background.style.backgroundPosition = "center center";
    background.style.backgroundSize = "cover";
  },

  /* ========================================
       RENDER EMPTY / STANDBY DISPLAY
    ======================================== */

  renderStandby() {
    this.hideScenePresentation();

    const track = document.getElementById("initiativeTrack");

    const background = document.getElementById("displayBackground");

    if (track) {
      track.innerHTML = "";
    }

    if (background) {
      this.applyEncounterBackground("");
    }

    document.body.classList.remove("scene-has-image", "scene-no-image");

    document.getElementById("displayEncounterName").textContent =
      "Awaiting Encounter";

    document.getElementById("displaySystem").textContent = "Stand By";

    document.getElementById("displayRound").textContent = "—";

    document.getElementById("currentName").textContent = "Awaiting Encounter…";

    document.getElementById("nextName").textContent = "—";

    this.updateIdleLogo(false);
  },

  /* ========================================
       SCENE / ROLEPLAY DISPLAY
    ======================================== */

  renderScene() {
    if (!this.encounter) {
      this.renderStandby();
      return;
    }

    document.body.dataset.displayMode = "scene";
    const background = document.getElementById("displayBackground");
    const sceneImage =
      this.encounter.display?.sceneImage || this.encounter.background || "";
    if (background) this.applyEncounterBackground(sceneImage);

    // Scene presentation deliberately hides the combat shell. Preserve a
    // theme-aware fallback and edge treatment so Fantasy does not appear to
    // switch back to the old blue/black Player Display when no scene artwork
    // is configured.
    document.body.classList.toggle("scene-has-image", Boolean(sceneImage));
    document.body.classList.toggle("scene-no-image", !sceneImage);
    this.updateScenePresentation(sceneImage);

    const name = document.getElementById("displayEncounterName");
    if (name) name.textContent = this.encounter.name || "Scene";
    this.updateIdleLogo(Boolean(sceneImage));
  },

  /* ========================================
       MAIN RENDER
    ======================================== */

  render() {
    /*
     * Do not render encounter changes behind
     * the DM-controlled privacy screen.
     */
    if (this.paused || this.awaitingDmState) {
      return;
    }

    if (this.displayMode === "scene") {
      this.renderScene();
      return;
    }

    document.body.dataset.displayMode = "combat";
    this.hideScenePresentation();

    /* ----------------------------------------
       No active encounter
       ---------------------------------------- */

    if (!this.encounter) {
      this.renderStandby();

      return;
    }

    /* ----------------------------------------
       Make sure combatants array exists
       ---------------------------------------- */

    if (!Array.isArray(this.encounter.combatants)) {
      this.encounter.combatants = [];
    }

    /* ----------------------------------------
       Sort initiative
       ---------------------------------------- */

    ENC.sortCombatants(this.encounter.combatants);

    /* ----------------------------------------
       Determine player-visible state
       ---------------------------------------- */

    const visibleCombatants = ENC.getPlayerVisibleCombatants(
      this.encounter.combatants,
    );

    const hasVisibleCombatants = visibleCombatants.length > 0;

    this.updateIdleLogo(hasVisibleCombatants);

    /* ----------------------------------------
       Encounter header
       ---------------------------------------- */

    document.getElementById("displayEncounterName").textContent =
      this.encounter.name || "New Encounter";

    document.getElementById("displaySystem").textContent = ENC.getSystemLabel(
      this.encounter.systemId,
      this.encounter.customProfile,
    );

    document.getElementById("displayRound").textContent =
      this.encounter.round || 1;

    /* ----------------------------------------
       Encounter background
       ---------------------------------------- */

    const background = document.getElementById("displayBackground");

    document.body.classList.remove("scene-has-image", "scene-no-image");

    const combatImage =
      this.encounter.display?.combatImage || this.encounter.background || "";
    this.applyEncounterBackground(combatImage);

    /* ----------------------------------------
       Initiative track
       ---------------------------------------- */

    const track = document.getElementById("initiativeTrack");

    /* ----------------------------------------
       No combatants yet
       ---------------------------------------- */

    if (!hasVisibleCombatants) {
      if (this.lastInitiativeSignature !== "empty") {
        track.replaceChildren();
        this.lastInitiativeSignature = "empty";
        this.lastCenteredCurrentId = null;
      }

      document.getElementById("currentName").textContent =
        "Awaiting Encounter…";

      document.getElementById("nextName").textContent = "—";

      return;
    }

    /* ----------------------------------------
       Find current combatant
       ---------------------------------------- */

    const currentIndex = this.encounter.combatants.findIndex(
      (combatant) => combatant.id === this.encounter.currentId,
    );

    // Only rebuild the initiative DOM when information that is actually shown
    // on the Player Display changes. Audio, timer, save, and other encounter
    // broadcasts must not reload portrait images or disturb card geometry.
    const initiativeSignature = JSON.stringify({
      currentId: this.encounter.currentId || null,
      combatants: visibleCombatants.map((combatant) => ({
        id: combatant.id,
        type: combatant.type,
        combatState: combatant.combatState,
        name: combatant.name,
        initiative: combatant.initiative,
        portrait: combatant.portrait || "",
        systemId: combatant.systemId,
        conditionTrack: combatant.conditionTrack || "",
        dnd5eConditions: combatant.dnd5eConditions || [],
        dnd5eExhaustion: Number(combatant.dnd5eExhaustion || 0),
        visibleStatus: combatant.visibleStatus || "",
        delayed: Boolean(combatant.delayed),
        ready: Boolean(combatant.ready),
      })),
    });

    const rebuildInitiative = this.lastInitiativeSignature !== initiativeSignature;

    if (rebuildInitiative) {
      track.replaceChildren();

      /* ========================================
         BUILD INITIATIVE CARDS
         ======================================== */

      for (const combatant of visibleCombatants) {
        const card = document.createElement("article");
        card.className =
          `initiative-card ` + `${combatant.type} ` + `${combatant.combatState}`;
        card.dataset.combatantId = combatant.id;

        if (
          combatant.id === this.encounter.currentId &&
          this.isTurnEligible(combatant)
        ) {
          card.classList.add("current");
        }

        const portrait = document.createElement("div");
        portrait.className = "display-portrait";

        if (combatant.portrait) {
          const img = document.createElement("img");
          img.src = combatant.portrait;
          img.alt = combatant.name || "";
          img.decoding = "async";
          portrait.appendChild(img);
        } else {
          portrait.textContent = combatant.name?.charAt(0).toUpperCase() || "?";
        }

        const name = document.createElement("div");
        name.className = "display-card-name";
        name.textContent = combatant.name;

        const initiative = document.createElement("div");
        initiative.className = "display-init";
        const initiativeLabel = document.createElement("small");
        initiativeLabel.textContent = "INIT";
        initiative.appendChild(initiativeLabel);
        initiative.append(document.createTextNode(combatant.initiative));

        const badges = document.createElement("div");
        badges.className = "display-badges";

        if (
          combatant.systemId === "swse" &&
          combatant.conditionTrack &&
          combatant.conditionTrack !== "Normal"
        ) {
          badges.appendChild(
            this.badge(`CT ${combatant.conditionTrack}`, "condition"),
          );
        }

        if (
          combatant.systemId === "dnd5e" &&
          Array.isArray(combatant.dnd5eConditions)
        ) {
          for (const condition of combatant.dnd5eConditions) {
            badges.appendChild(this.badge(condition, "condition"));
          }
        }

        if (
          combatant.systemId === "dnd5e" &&
          Number(combatant.dnd5eExhaustion) > 0
        ) {
          badges.appendChild(
            this.badge(`Exhaustion ${combatant.dnd5eExhaustion}`, "exhaustion"),
          );
        }

        if (combatant.visibleStatus) {
          const statuses = combatant.visibleStatus
            .split(",")
            .map((status) => status.trim())
            .filter(Boolean);
          for (const status of statuses) badges.appendChild(this.badge(status));
        }

        if (combatant.combatState === "defeated") {
          badges.appendChild(this.badge("DEFEATED", "defeated"));
        }
        if (combatant.combatState === "inactive") {
          badges.appendChild(this.badge("INACTIVE"));
        }
        if (combatant.delayed || combatant.combatState === "delayed") {
          badges.appendChild(this.badge("DELAYED"));
        }
        if (combatant.ready || combatant.combatState === "ready") {
          badges.appendChild(this.badge("READIED"));
        }

        card.append(portrait, name, initiative, badges);
        track.appendChild(card);
      }

      this.lastInitiativeSignature = initiativeSignature;
    }

    /* ========================================
       CURRENT TURN
       ======================================== */

    const current =
      currentIndex >= 0 ? this.encounter.combatants[currentIndex] : null;

    const currentIsVisible =
      ENC.isPlayerVisibleCombatant(current) && this.isTurnEligible(current);

    document.getElementById("currentName").textContent = currentIsVisible
      ? current.name
      : current?.hidden
        ? "—"
        : "Waiting for combat…";

    /* ========================================
       NEXT TURN
       ======================================== */

    const next =
      currentIndex >= 0 ? this.nextActive(this.encounter.currentId) : null;

    document.getElementById("nextName").textContent = next ? next.name : "—";

    /* ========================================
       CENTER CURRENT CARD
       ======================================== */

    if (this.lastCenteredCurrentId !== this.encounter.currentId) {
      this.lastCenteredCurrentId = this.encounter.currentId || null;
      requestAnimationFrame(() => {
        document.querySelector(".initiative-card.current")?.scrollIntoView({
          behavior: "auto",
          inline: "center",
          block: "nearest",
        });
      });
    }
  },

  /* ========================================
       EVENT BINDING
    ======================================== */

  bind() {
    /* ----------------------------------------
       DM -> Player synchronization
       ---------------------------------------- */

    ENC.sync.onMessage((message) => {
      // =====================================
      // DM PRESENCE / INITIAL DISPLAY STATE
      // =====================================

      if (message.type === "dm-presence") {
        this.markDmSeen();
        if (message.uiTheme) {
          this.applyTheme(message.uiTheme);
        }

        /*
         * We now know whether the DM wants
         * the Player Display visible or
         * hidden.
         */
        this.awaitingDmState = false;

        if (message.encounter) {
          this.encounter = ENC.normalizeEncounter(message.encounter);
        }

        this.setDisplayMode(
          message.playerDisplayMode ||
            (message.playerDisplayPaused
              ? "standby"
              : this.encounter?.phase === "combat"
                ? "combat"
                : "scene"),
        );

        /*
         * main.js will include the current
         * timer state in dm-presence.
         *
         * This allows a Player Display opened
         * halfway through an active countdown
         * to immediately catch up.
         */
        if (message.timer) {
          this.applyTimerState(message.timer);
        }

        if (!this.paused) {
          this.render();
        }

        return;
      }

      // =====================================
      // PLAYER DISPLAY MODE
      // =====================================

      if (message.type === "player-display-mode") {
        this.markDmSeen();
        this.awaitingDmState = false;
        if (message.uiTheme) this.applyTheme(message.uiTheme);
        if (message.encounter)
          this.encounter = ENC.normalizeEncounter(message.encounter);
        if (message.timer) this.applyTimerState(message.timer);
        this.setDisplayMode(message.mode || "standby");
        return;
      }

      // =====================================
      // HIDE / SHOW PLAYER DISPLAY (LEGACY)
      // =====================================

      if (message.type === "player-display-visibility") {
        this.markDmSeen();

        this.awaitingDmState = false;

        /*
         * main.js includes the newest
         * encounter when changing display
         * visibility.
         */
        if (message.encounter) {
          this.encounter = ENC.normalizeEncounter(message.encounter);
        }

        this.setPaused(Boolean(message.paused));

        /*
         * Refresh the timer from the DM's
         * authoritative state whenever the
         * Player Display is hidden or shown.
         */
        if (message.timer) {
          this.applyTimerState(message.timer);
        }

        /*
         * When Show Player Display is pressed,
         * immediately render the newest state.
         */
        if (!this.paused) {
          this.render();
        }

        return;
      }

      // =====================================
      // INTERFACE THEME UPDATES
      // =====================================

      if (message.type === "settings-updated") {
        if (message.settings) {
          const settings = ENC.normalizeSettings(message.settings);
          this.applyTheme(settings.uiTheme);
        }
        return;
      }

      // =====================================
      // VISUAL TIMER UPDATES
      // =====================================

      if (message.type === "timer-state") {
        this.markDmSeen();

        if (message.timer) {
          this.applyTimerState(message.timer);
        }

        return;
      }

      // =====================================
      // NORMAL ENCOUNTER UPDATES
      // =====================================

      if (message.type === "encounter-updated") {
        this.markDmSeen();

        /*
         * Always receive and store the latest
         * encounter, even while hidden.
         */
        this.encounter = ENC.normalizeEncounter(message.encounter || {});

        /*
         * But never render private changes
         * while the privacy screen is active.
         */
        if (!this.paused && !this.awaitingDmState) {
          this.render();
        }

        return;
      }
    });

    window.addEventListener("storage", (event) => {
      if (event.key === "encounter-ui-theme" && event.newValue) {
        this.applyTheme(event.newValue);
      }
    });

    this.startConnectionMonitor();

    /* ----------------------------------------
       Fullscreen
       ---------------------------------------- */

    document
      .getElementById("fullscreenBtn")
      .addEventListener("click", async () => {
        try {
          await document.documentElement.requestFullscreen();
        } catch (error) {
          console.warn("Fullscreen request failed:", error);
        }
      });
  },
};

/* ========================================
   START PLAYER DISPLAY
======================================== */

document.addEventListener("DOMContentLoaded", async () => {
  const versionElement = document.getElementById("playerAppVersion");

  if (versionElement) {
    versionElement.textContent =
      `${ENC.APP_STAGE.toUpperCase()} · ` + `v${ENC.APP_VERSION}`;
  }

  await ENC.db.open();

  try {
    const settings = await ENC.db.getSettings();
    const storedTheme = localStorage.getItem("encounter-ui-theme");
    ENC.display.currentUiTheme = ENC.applyUiTheme(
      settings?.uiTheme || storedTheme || "scifi",
    );
  } catch (error) {
    console.warn("Unable to load Player Display theme:", error);
    ENC.display.currentUiTheme = ENC.applyUiTheme(
      localStorage.getItem("encounter-ui-theme") || "scifi",
    );
  }

  document.body.dataset.displayMode = "standby";

  /*
   * Timer modules must already be loaded by
   * display.html before display.js executes.
   */
  ENC.display.initializeTimer();

  ENC.display.bind();

  await ENC.display.load();
});
