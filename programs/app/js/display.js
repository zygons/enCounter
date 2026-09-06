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

  // Player Display privacy state
  paused: false,
  awaitingDmState: true,

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

  setPaused(paused) {
    this.paused = Boolean(paused);

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
       RENDER EMPTY / STANDBY DISPLAY
    ======================================== */

  renderStandby() {
    const track = document.getElementById("initiativeTrack");

    const background = document.getElementById("displayBackground");

    if (track) {
      track.innerHTML = "";
    }

    if (background) {
      background.style.backgroundImage = "";
    }

    document.getElementById("displayEncounterName").textContent =
      "Awaiting Encounter";

    document.getElementById("displaySystem").textContent = "Stand By";

    document.getElementById("displayRound").textContent = "—";

    document.getElementById("currentName").textContent = "Awaiting Encounter…";

    document.getElementById("nextName").textContent = "—";

    this.updateIdleLogo(false);
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

    if (this.encounter.background) {
      background.style.backgroundImage = `url("${this.encounter.background}")`;
    } else {
      background.style.backgroundImage = "";
    }

    /* ----------------------------------------
       Initiative track
       ---------------------------------------- */

    const track = document.getElementById("initiativeTrack");

    track.innerHTML = "";

    /* ----------------------------------------
       No combatants yet
       ---------------------------------------- */

    if (!hasVisibleCombatants) {
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

    /* ========================================
       BUILD INITIATIVE CARDS
       ======================================== */

    for (const combatant of visibleCombatants) {
      /* ------------------------------------
         Card
         ------------------------------------ */

      const card = document.createElement("article");

      card.className =
        `initiative-card ` + `${combatant.type} ` + `${combatant.combatState}`;

      /* ------------------------------------
         Current turn highlighting
         ------------------------------------ */

      if (
        combatant.id === this.encounter.currentId &&
        this.isTurnEligible(combatant)
      ) {
        card.classList.add("current");
      }

      /* ------------------------------------
         Portrait
         ------------------------------------ */

      const portrait = document.createElement("div");

      portrait.className = "display-portrait";

      if (combatant.portrait) {
        const img = document.createElement("img");

        img.src = combatant.portrait;

        img.alt = combatant.name || "";

        portrait.appendChild(img);
      } else {
        portrait.textContent = combatant.name?.charAt(0).toUpperCase() || "?";
      }

      /* ------------------------------------
         Name
         ------------------------------------ */

      const name = document.createElement("div");

      name.className = "display-card-name";

      name.textContent = combatant.name;

      /* ------------------------------------
         Initiative
         ------------------------------------ */

      const initiative = document.createElement("div");

      initiative.className = "display-init";

      const initiativeLabel = document.createElement("small");

      initiativeLabel.textContent = "INIT";

      initiative.appendChild(initiativeLabel);

      initiative.append(document.createTextNode(combatant.initiative));

      /* ------------------------------------
         Status badges
         ------------------------------------ */

      const badges = document.createElement("div");

      badges.className = "display-badges";

      /* SWSE Condition Track */

      if (
        combatant.systemId === "swse" &&
        combatant.conditionTrack &&
        combatant.conditionTrack !== "Normal"
      ) {
        badges.appendChild(
          this.badge(`CT ${combatant.conditionTrack}`, "condition"),
        );
      }

      /* Visible statuses */

      if (combatant.visibleStatus) {
        const statuses = combatant.visibleStatus
          .split(",")
          .map((status) => status.trim())
          .filter(Boolean);

        for (const status of statuses) {
          badges.appendChild(this.badge(status));
        }
      }

      /* Defeated */

      if (combatant.combatState === "defeated") {
        badges.appendChild(this.badge("DEFEATED", "defeated"));
      }

      /* Inactive */

      if (combatant.combatState === "inactive") {
        badges.appendChild(this.badge("INACTIVE"));
      }

      /* Delayed */

      if (combatant.delayed || combatant.combatState === "delayed") {
        badges.appendChild(this.badge("DELAYED"));
      }

      /* Readied */

      if (combatant.ready || combatant.combatState === "ready") {
        badges.appendChild(this.badge("READIED"));
      }

      /* ------------------------------------
         Assemble card
         ------------------------------------ */

      card.append(portrait, name, initiative, badges);

      track.appendChild(card);
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

    setTimeout(() => {
      document.querySelector(".initiative-card.current")?.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }, 80);
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

        /*
         * We now know whether the DM wants
         * the Player Display visible or
         * hidden.
         */
        this.awaitingDmState = false;

        if (message.encounter) {
          this.encounter = ENC.normalizeEncounter(message.encounter);
        }

        this.setPaused(Boolean(message.playerDisplayPaused));

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
      // HIDE / SHOW PLAYER DISPLAY
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

  /*
   * Timer modules must already be loaded by
   * display.html before display.js executes.
   */
  ENC.display.initializeTimer();

  ENC.display.bind();

  await ENC.display.load();
});
