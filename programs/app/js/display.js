/*
 * Copyright (C) 2026 enCounter contributors
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

ENC.display = {
  encounter: null,
  lastDmSeenAt: 0,
  connectionTimer: null,

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

  requestDmPresence() {
    ENC.sync.broadcast("display-hello", { sentAt: Date.now() });
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
        portrait.textContent =
          combatant.name?.charAt(0).toUpperCase() || "?";
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

    const next = currentIndex >= 0
      ? this.nextActive(this.encounter.currentId)
      : null;

    document.getElementById("nextName").textContent = next
      ? next.name
      : "—";

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
      if (message.type === "dm-presence") {
        this.markDmSeen();
        if (message.encounter) {
          this.encounter = ENC.normalizeEncounter(message.encounter);
          this.render();
        }
        return;
      }

      if (message.type === "encounter-updated") {
        this.markDmSeen();
        this.encounter = ENC.normalizeEncounter(message.encounter || {});
        this.render();
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
    versionElement.textContent = `${ENC.APP_STAGE.toUpperCase()} · v${ENC.APP_VERSION}`;
  }

  await ENC.db.open();

  ENC.display.bind();

  await ENC.display.load();
});
