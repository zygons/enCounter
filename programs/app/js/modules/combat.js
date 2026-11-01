/*
 * Copyright (C) 2026 Zygons
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

ENC.combat = {
  encounter: null,
  saveTimer: null,
  expandedCombatantIds: new Set(),
  conditionEditorIds: new Set(),

  settings() {
    return ENC.settingsUI.settings || ENC.DEFAULT_SETTINGS;
  },

  modules() {
    return this.settings().modules || ENC.MODE_PRESETS.standard;
  },

  async load() {
    this.encounter = await ENC.db.getActiveEncounter();
    ENC.sortCombatants(this.encounter.combatants);
    return this.encounter;
  },

  async save(reason = null) {
    ENC.app?.setSaveIndicator(true);
    try {
      const normalizedEncounter = ENC.normalizeEncounter(this.encounter);
      await ENC.db.saveActiveEncounter(normalizedEncounter);
      if (reason) {
        await ENC.db.addSnapshot(
          normalizedEncounter,
          reason,
          this.settings().snapshotLimit || 20,
        );
      }
      ENC.sync.broadcast("encounter-updated", {
        encounter: normalizedEncounter,
      });
      ENC.backup.scheduleExternalBackup();
      if (reason) ENC.app?.renderSnapshots?.();
    } finally {
      ENC.app?.setSaveIndicator(false);
    }
  },

  async addLibraryEntry(entry, initiative = 10) {
    const combatant = ENC.normalizeCombatant(
      {
        ...ENC.deepClone(entry),
        id: ENC.makeId("cmb"),
        sourceLibraryId: entry.id,
        initiative,
        hp: entry.maxHp ?? "",
        conditionTrack: "Normal",
        dnd5eConditions: [],
        dnd5eExhaustion: 0,
        visibleStatus: "",
        combatState: "active",
        hidden: false,
        delayed: false,
        ready: false,
        createdOrder: Date.now() + Math.random(),
      },
      entry.systemId,
      entry.customProfile,
    );
    this.encounter.combatants.push(combatant);
    ENC.sortCombatants(this.encounter.combatants);
    if (!this.encounter.currentId)
      this.encounter.currentId =
        this.encounter.combatants.find((c) => c.combatState === "active")?.id ||
        combatant.id;
    await this.save("combatant added");
    this.render();
  },

  async quickAdd() {
    const name = document.getElementById("quickName").value.trim();
    if (!name) return ENC.app.toast("Enter a combatant name.");
    const combatant = ENC.normalizeCombatant(
      {
        id: ENC.makeId("cmb"),
        name,
        type: document.getElementById("quickType").value,
        systemId: this.encounter.systemId,
        customProfile: ENC.deepClone(this.encounter.customProfile),
        initiative: Number(
          document.getElementById("quickInitiative").value || 10,
        ),
        createdOrder: Date.now() + Math.random(),
      },
      this.encounter.systemId,
      this.encounter.customProfile,
    );
    this.encounter.combatants.push(combatant);
    ENC.sortCombatants(this.encounter.combatants);
    if (!this.encounter.currentId) this.encounter.currentId = combatant.id;
    document.getElementById("quickName").value = "";
    await this.save("quick combatant added");
    this.render();
  },

  getCurrentIndex() {
    return this.encounter.combatants.findIndex(
      (c) => c.id === this.encounter.currentId,
    );
  },

  followCurrentTurn() {
    requestAnimationFrame(() => {
      const currentCard = document.querySelector(
        "#combatantList .combatant-card.current",
      );

      if (!currentCard) return;

      currentCard.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    });
  },

  async moveTurn(direction) {
    const all = this.encounter.combatants;
    if (!all.length) return;

    ENC.sortCombatants(all);
    const transition = ENC.calculateTurnMove(
      all,
      this.encounter.currentId,
      this.encounter.round,
      direction,
    );

    if (!transition.moved) {
      return ENC.app.toast(
        "No active combatants are available in normal initiative.",
      );
    }

    const hadCurrent = this.getCurrentIndex() >= 0;
    this.encounter.currentId = transition.currentId;
    this.encounter.round = transition.round;

    await this.save(
      hadCurrent ? (direction > 0 ? "next turn" : "previous turn") : "turn set",
    );

    this.render();
    this.followCurrentTurn();
  },

  async changeHp(combatant, amount) {
    const current = ENC.finiteNumber(combatant.hp, 0);
    const delta = ENC.finiteNumber(amount, 0);
    const max =
      combatant.maxHp === "" ? null : ENC.finiteNumber(combatant.maxHp, null);
    let next = current + delta;
    if (max !== null && Number.isFinite(max)) next = Math.min(max, next);
    combatant.hp = Math.max(0, Number.isFinite(next) ? next : 0);
    await this.save();
    this.render();
  },

  async customHp(combatant, heal = false) {
    const amount = Number(
      prompt(heal ? "Healing amount:" : "Damage amount:", "1"),
    );
    if (!Number.isFinite(amount) || amount < 0) return;
    await this.changeHp(combatant, heal ? amount : -amount);
  },

  async setState(combatant, state) {
    combatant.combatState = state;
    combatant.delayed = state === "delayed";
    combatant.ready = state === "ready";
    if (
      ["defeated", "inactive", "delayed", "ready"].includes(state) &&
      this.encounter.currentId === combatant.id
    )
      this.encounter.currentId = null;
    await this.save(`state: ${state}`);
    this.render();
  },

  async resumeCombatant(combatant, takeTurn = false) {
    combatant.combatState = "active";
    combatant.delayed = false;
    combatant.ready = false;

    if (takeTurn) {
      this.encounter.currentId = combatant.id;
    }

    await this.save(
      takeTurn ? "delayed/readied action triggered" : "combatant restored",
    );

    this.render();

    if (takeTurn) {
      this.followCurrentTurn();
    }
  },

  statSummary(combatant) {
    const profile = ENC.getSystemProfile(
      combatant.systemId,
      combatant.customProfile,
    );
    return profile.stats
      .map((stat) => {
        const value = combatant.stats?.[stat.key];
        return value !== "" && value !== undefined
          ? `${stat.label} ${value}`
          : null;
      })
      .filter(Boolean)
      .join(" | ");
  },

  primaryDefenseSummary(combatant) {
    const stats = combatant.stats || {};

    if (combatant.systemId === "dnd5e") {
      return [{ label: "AC", value: stats.armorClass }];
    }

    if (combatant.systemId === "swse") {
      return [
        { label: "REF", value: stats.refDefense },
        { label: "FORT", value: stats.fortDefense },
        { label: "WILL", value: stats.willDefense },
      ];
    }

    if (combatant.systemId === "generic") {
      return [{ label: "DEF", value: stats.defense }];
    }

    const profile = ENC.getSystemProfile(
      combatant.systemId,
      combatant.customProfile,
    );

    return (profile.stats || []).slice(0, 3).map((stat) => ({
      label: stat.label,
      value: stats[stat.key],
    }));
  },

  hpMetrics(combatant) {
    const hasCurrent = combatant.hp !== "" && combatant.hp !== null;
    const hasMax = combatant.maxHp !== "" && combatant.maxHp !== null;
    const current = hasCurrent ? ENC.finiteNumber(combatant.hp, 0) : null;
    const max = hasMax ? ENC.finiteNumber(combatant.maxHp, 0) : null;

    if (current === null || max === null || max <= 0) {
      return {
        current,
        max,
        percent: null,
        state: "unknown",
      };
    }

    const percent = Math.max(0, Math.min(100, (current / max) * 100));
    let state = "healthy";
    if (current <= 0) state = "defeated";
    else if (percent <= 25) state = "critical";
    else if (percent <= 50) state = "wounded";

    return { current, max, percent, state };
  },

  portraitElement(combatant) {
    const box = document.createElement("div");
    box.className = "combatant-portrait";
    if (combatant.portrait) {
      const img = document.createElement("img");
      img.src = combatant.portrait;
      img.alt = "";
      box.appendChild(img);
    } else {
      box.textContent = combatant.name.charAt(0).toUpperCase();
    }
    return box;
  },

  createField(labelText, value, onChange, type = "text") {
    const label = document.createElement("label");
    label.className = "compact-control";
    const span = document.createElement("span");
    span.textContent = labelText;
    const input = document.createElement("input");
    input.type = type;
    input.value = value ?? "";
    input.addEventListener("change", async () => onChange(input.value));
    label.append(span, input);
    return label;
  },

  createActionButton(text, onClick, options = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    if (options.className) button.className = options.className;
    if (options.title) button.title = options.title;
    if (options.disabled) button.disabled = true;
    button.addEventListener("click", onClick);
    return button;
  },

  createStatusBadge(text, variant = "status") {
    const badge = document.createElement("span");
    badge.className = `combatant-status-badge ${variant}`;
    badge.textContent = text;
    return badge;
  },

  renderAbilities(container, combatant) {
    if (!this.modules().abilities || !combatant.abilities?.length) return;
    const box = document.createElement("div");
    box.className = "module-box";
    box.innerHTML = "<strong>Abilities</strong>";
    for (const ability of combatant.abilities) {
      const row = document.createElement("div");
      row.className = "ability-row";
      const name = document.createElement("span");
      name.textContent = ability.name;
      const uses = document.createElement("span");
      uses.textContent =
        ability.usesMax === ""
          ? ""
          : `${ability.usesRemaining}/${ability.usesMax}`;
      const use = document.createElement("button");
      use.textContent = "Use";
      use.disabled =
        ability.usesMax !== "" && Number(ability.usesRemaining) <= 0;
      use.addEventListener("click", async () => {
        if (ability.usesMax !== "")
          ability.usesRemaining = Math.max(
            0,
            Number(ability.usesRemaining) - 1,
          );
        await this.save();
        this.render();
      });
      row.append(name, uses, use);
      if (ability.description) {
        const description = document.createElement("div");
        description.className = "ability-description";
        description.textContent = ability.description;
        row.appendChild(description);
      }
      box.appendChild(row);
    }
    container.appendChild(box);
  },

  renderResources(container, combatant) {
    if (!this.modules().resources || !combatant.resources?.length) return;
    const box = document.createElement("div");
    box.className = "module-box";
    box.innerHTML = "<strong>Resources</strong>";
    for (const resource of combatant.resources) {
      const row = document.createElement("div");
      row.className = "resource-row";
      const name = document.createElement("span");
      name.textContent = `${resource.name}: ${resource.current}/${resource.max}`;
      const minus = document.createElement("button");
      minus.textContent = "−";
      minus.addEventListener("click", async () => {
        resource.current = Math.max(0, Number(resource.current) - 1);
        await this.save();
        this.render();
      });
      const plus = document.createElement("button");
      plus.textContent = "+";
      plus.addEventListener("click", async () => {
        resource.current = Math.min(
          Number(resource.max),
          Number(resource.current) + 1,
        );
        await this.save();
        this.render();
      });
      row.append(name, minus, plus);
      box.appendChild(row);
    }
    container.appendChild(box);
  },

  renderHpCell(combatant) {
    const metrics = this.hpMetrics(combatant);
    const cell = document.createElement("div");
    cell.className = "combatant-hp-cell";

    const value = document.createElement("div");
    value.className = "combatant-hp-value";
    if (metrics.current === null) {
      value.textContent = "—";
    } else if (metrics.max !== null && metrics.max > 0) {
      value.textContent = `${metrics.current} / ${metrics.max}`;
    } else {
      value.textContent = String(metrics.current);
    }
    cell.appendChild(value);

    const track = document.createElement("div");
    track.className = `combatant-hp-track ${metrics.state}`;
    const fill = document.createElement("div");
    fill.className = "combatant-hp-fill";
    fill.style.width = `${metrics.percent ?? 0}%`;
    track.appendChild(fill);
    if (metrics.percent === null) track.classList.add("no-meter");
    cell.appendChild(track);

    return cell;
  },

  renderDefenseCell(combatant) {
    const cell = document.createElement("div");
    cell.className = "combatant-defense-cell";

    const defenses = this.primaryDefenseSummary(combatant).filter(
      (item) => item.value !== "" && item.value !== undefined && item.value !== null,
    );

    if (!defenses.length) {
      cell.textContent = "—";
      return cell;
    }

    for (const item of defenses) {
      const pill = document.createElement("span");
      pill.className = "defense-stat-pill";
      const label = document.createElement("small");
      label.textContent = item.label;
      const value = document.createElement("strong");
      value.textContent = item.value;
      pill.append(label, value);
      cell.appendChild(pill);
    }

    return cell;
  },

  renderStatusCell(combatant) {
    const cell = document.createElement("div");
    cell.className = "combatant-status-cell";
    let count = 0;

    const add = (text, variant) => {
      if (!text) return;
      cell.appendChild(this.createStatusBadge(text, variant));
      count += 1;
    };

    if (combatant.systemId === "dnd5e") {
      for (const condition of combatant.dnd5eConditions || []) {
        add(condition, "condition");
      }
      if (Number(combatant.dnd5eExhaustion) > 0) {
        add(`Exhaustion ${combatant.dnd5eExhaustion}`, "exhaustion");
      }
    }

    const profile = ENC.getSystemProfile(
      combatant.systemId,
      combatant.customProfile,
    );
    if (profile.usesConditionTrack && combatant.conditionTrack !== "Normal") {
      add(`CT ${combatant.conditionTrack}`, "warning");
    }

    add(combatant.visibleStatus, "status");

    if (combatant.combatState && combatant.combatState !== "active") {
      add(combatant.combatState, "state");
    }
    if (combatant.hidden) add("Hidden", "muted");

    if (!count) {
      const empty = document.createElement("span");
      empty.className = "combatant-status-empty";
      empty.textContent = "—";
      cell.appendChild(empty);
    }

    return cell;
  },

  renderConditionEditor(combatant) {
    const modules = this.modules();
    const panel = document.createElement("div");
    panel.className = "combatant-inline-editor combatant-condition-editor";

    const heading = document.createElement("div");
    heading.className = "combatant-inline-editor-heading";
    const title = document.createElement("strong");
    title.textContent = "Conditions & Status";
    const close = this.createActionButton("Close", () => {
      this.conditionEditorIds.delete(combatant.id);
      this.render();
    }, { className: "text-button" });
    heading.append(title, close);
    panel.appendChild(heading);

    const controls = document.createElement("div");
    controls.className = "combatant-inline-control-grid";

    if (modules.conditions && combatant.systemId === "dnd5e") {
      const conditionLabel = document.createElement("label");
      conditionLabel.className = "compact-control";
      const conditionLabelText = document.createElement("span");
      conditionLabelText.textContent = "Add 5E Condition";
      const conditionSelect = document.createElement("select");
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Choose condition…";
      conditionSelect.appendChild(placeholder);

      const activeConditions = Array.isArray(combatant.dnd5eConditions)
        ? combatant.dnd5eConditions
        : [];
      for (const condition of ENC.DND5E_CONDITIONS) {
        if (activeConditions.includes(condition)) continue;
        const option = document.createElement("option");
        option.value = condition;
        option.textContent = condition;
        conditionSelect.appendChild(option);
      }
      conditionSelect.addEventListener("change", async () => {
        const condition = conditionSelect.value;
        if (!condition) return;
        if (!Array.isArray(combatant.dnd5eConditions)) {
          combatant.dnd5eConditions = [];
        }
        if (!combatant.dnd5eConditions.includes(condition)) {
          combatant.dnd5eConditions.push(condition);
        }
        await this.save();
        this.render();
      });
      conditionLabel.append(conditionLabelText, conditionSelect);
      controls.appendChild(conditionLabel);

      const exhaustionLabel = document.createElement("label");
      exhaustionLabel.className = "compact-control";
      const exhaustionText = document.createElement("span");
      exhaustionText.textContent = "Exhaustion";
      const exhaustionSelect = document.createElement("select");
      for (
        let level = ENC.DND5E_EXHAUSTION_MIN;
        level <= ENC.DND5E_EXHAUSTION_MAX;
        level += 1
      ) {
        const option = document.createElement("option");
        option.value = String(level);
        option.textContent = level === 0 ? "None" : `Level ${level}`;
        exhaustionSelect.appendChild(option);
      }
      exhaustionSelect.value = String(combatant.dnd5eExhaustion ?? 0);
      exhaustionSelect.addEventListener("change", async () => {
        combatant.dnd5eExhaustion =
          Number.parseInt(exhaustionSelect.value, 10) || 0;
        await this.save();
        this.render();
      });
      exhaustionLabel.append(exhaustionText, exhaustionSelect);
      controls.appendChild(exhaustionLabel);
    }

    const profile = ENC.getSystemProfile(
      combatant.systemId,
      combatant.customProfile,
    );
    if (modules.conditions && profile.usesConditionTrack) {
      const conditionTrackLabel = document.createElement("label");
      conditionTrackLabel.className = "compact-control";
      const label = document.createElement("span");
      label.textContent = "Condition Track";
      const select = document.createElement("select");
      for (const value of ["Normal", "-1", "-2", "-5", "-10", "Helpless"]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      }
      select.value = combatant.conditionTrack;
      select.addEventListener("change", async () => {
        combatant.conditionTrack = select.value;
        await this.save();
        this.render();
      });
      conditionTrackLabel.append(label, select);
      controls.appendChild(conditionTrackLabel);
    }

    if (modules.status) {
      controls.appendChild(
        this.createField(
          "Visible Status",
          combatant.visibleStatus,
          async (value) => {
            combatant.visibleStatus = value.trim();
            await this.save();
            this.render();
          },
        ),
      );
    }

    panel.appendChild(controls);

    if (combatant.systemId === "dnd5e" && combatant.dnd5eConditions?.length) {
      const tags = document.createElement("div");
      tags.className = "dnd5e-condition-tags compact-condition-tags";
      for (const condition of combatant.dnd5eConditions) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "dnd5e-condition-chip";
        chip.textContent = `${condition} ×`;
        chip.title = `Remove ${condition}`;
        chip.addEventListener("click", async () => {
          combatant.dnd5eConditions = combatant.dnd5eConditions.filter(
            (activeCondition) => activeCondition !== condition,
          );
          await this.save();
          this.render();
        });
        tags.appendChild(chip);
      }
      panel.appendChild(tags);
    }

    return panel;
  },

  renderAdvancedDetails(combatant) {
    const modules = this.modules();
    const detail = document.createElement("div");
    detail.className = "combatant-expanded-detail";

    const editGrid = document.createElement("div");
    editGrid.className = "combatant-detail-grid";
    editGrid.appendChild(
      this.createField(
        "Initiative",
        combatant.initiative,
        async (value) => {
          combatant.initiative = Number(value || 0);
          ENC.sortCombatants(this.encounter.combatants);
          await this.save();
          this.render();
        },
        "number",
      ),
    );

    if (modules.hp) {
      editGrid.appendChild(
        this.createField(
          "Current HP",
          combatant.hp,
          async (value) => {
            combatant.hp = value;
            await this.save();
            this.render();
          },
          "number",
        ),
      );
    }

    const stats = document.createElement("div");
    stats.className = "combatant-detail-summary";
    stats.innerHTML = `<span>System</span><strong>${ENC.getSystemLabel(
      combatant.systemId,
      combatant.customProfile,
    )}</strong><small>${this.statSummary(combatant) || "No system stats"}</small>`;
    editGrid.appendChild(stats);
    detail.appendChild(editGrid);

    const actionGroups = document.createElement("div");
    actionGroups.className = "combatant-secondary-actions";

    if (modules.combatControls && modules.hp) {
      actionGroups.append(
        this.createActionButton("Damage…", () => this.customHp(combatant, false)),
        this.createActionButton("Heal…", () => this.customHp(combatant, true)),
      );
    }

    if (modules.combatControls) {
      actionGroups.append(
        this.createActionButton("Delay", () => this.setState(combatant, "delayed")),
        this.createActionButton("Ready", () => this.setState(combatant, "ready")),
        this.createActionButton("Defeated", () => this.setState(combatant, "defeated")),
        this.createActionButton("Inactive", () => this.setState(combatant, "inactive")),
        this.createActionButton(
          combatant.delayed || combatant.ready ? "Trigger / Resume" : "Restore Active",
          () => this.resumeCombatant(
            combatant,
            combatant.delayed || combatant.ready,
          ),
        ),
      );
    }

    if (modules.hiddenCombatants) {
      actionGroups.appendChild(
        this.createActionButton(
          combatant.hidden ? "Reveal to Players" : "Hide from Players",
          async () => {
            combatant.hidden = !combatant.hidden;
            await this.save();
            this.render();
          },
        ),
      );
    }

    const remove = this.createActionButton(
      "Remove from Encounter",
      async () => {
        if (
          !confirm(
            `Remove ${combatant.name} from this encounter? The permanent library entry is not affected.`,
          )
        )
          return;
        this.encounter.combatants = this.encounter.combatants.filter(
          (c) => c.id !== combatant.id,
        );
        this.expandedCombatantIds.delete(combatant.id);
        this.conditionEditorIds.delete(combatant.id);
        if (this.encounter.currentId === combatant.id)
          this.encounter.currentId = null;
        await this.save("combatant removed");
        this.render();
      },
      { className: "danger-outline" },
    );
    actionGroups.appendChild(remove);
    detail.appendChild(actionGroups);

    if (modules.notes && combatant.notes) {
      const notes = document.createElement("div");
      notes.className = "combatant-detail-notes";
      const strong = document.createElement("strong");
      strong.textContent = "DM Notes";
      const text = document.createElement("div");
      text.textContent = combatant.notes;
      notes.append(strong, text);
      detail.appendChild(notes);
    }

    this.renderAbilities(detail, combatant);
    this.renderResources(detail, combatant);
    return detail;
  },

  renderCombatant(combatant) {
    const modules = this.modules();
    const card = document.createElement("article");
    card.className = `combatant-card combatant-row ${combatant.combatState || "active"}`;
    if (combatant.id === this.encounter.currentId) card.classList.add("current");
    if (this.expandedCombatantIds.has(combatant.id)) card.classList.add("expanded");

    const summary = document.createElement("div");
    summary.className = "combatant-summary-grid";

    const identity = document.createElement("div");
    identity.className = "combatant-identity-cell";
    identity.appendChild(this.portraitElement(combatant));
    const identityText = document.createElement("div");
    identityText.className = "combatant-identity-text";
    const name = document.createElement("strong");
    name.className = "combatant-display-name";
    name.textContent = combatant.name;
    const meta = document.createElement("span");
    meta.className = "combatant-meta-line";
    meta.textContent = `${ENC.getSystemLabel(
      combatant.systemId,
      combatant.customProfile,
    )} · ${combatant.type}`;
    identityText.append(name, meta);
    identity.appendChild(identityText);
    summary.appendChild(identity);

    const initiative = document.createElement("div");
    initiative.className = "combatant-initiative-cell";
    const initValue = document.createElement("strong");
    initValue.textContent = combatant.initiative;
    initiative.appendChild(initValue);
    if (combatant.id === this.encounter.currentId) {
      const current = document.createElement("span");
      current.textContent = "TURN";
      initiative.appendChild(current);
    }
    summary.appendChild(initiative);

    summary.appendChild(modules.hp ? this.renderHpCell(combatant) : document.createElement("div"));
    summary.appendChild(this.renderDefenseCell(combatant));
    summary.appendChild(this.renderStatusCell(combatant));

    const detailToggle = this.createActionButton(
      this.expandedCombatantIds.has(combatant.id) ? "▴" : "⋯",
      () => {
        if (this.expandedCombatantIds.has(combatant.id)) {
          this.expandedCombatantIds.delete(combatant.id);
        } else {
          this.expandedCombatantIds.add(combatant.id);
        }
        this.render();
      },
      {
        className: "combatant-more-button",
        title: this.expandedCombatantIds.has(combatant.id)
          ? "Collapse details"
          : "More combatant controls",
      },
    );
    summary.appendChild(detailToggle);
    card.appendChild(summary);

    const quickActions = document.createElement("div");
    quickActions.className = "combatant-quick-actions";

    const setTurn = this.createActionButton(
      combatant.id === this.encounter.currentId ? "Current Turn" : "Set Turn",
      () => this.resumeCombatant(combatant, true),
      {
        className:
          combatant.id === this.encounter.currentId
            ? "combatant-action-current"
            : "combatant-action-primary",
        disabled: combatant.id === this.encounter.currentId,
      },
    );
    quickActions.appendChild(setTurn);

    if (modules.combatControls && modules.hp) {
      for (const delta of [-10, -1, 1, 10]) {
        quickActions.appendChild(
          this.createActionButton(
            delta > 0 ? `+${delta}` : String(delta).replace("-", "−"),
            () => this.changeHp(combatant, delta),
            {
              className: delta < 0 ? "hp-action damage" : "hp-action heal",
              title: delta < 0 ? `Apply ${Math.abs(delta)} damage` : `Heal ${delta} HP`,
            },
          ),
        );
      }
    }

    if (modules.conditions || modules.status) {
      let conditionLabel = "Status";
      if (combatant.systemId === "dnd5e") {
        const count = combatant.dnd5eConditions?.length || 0;
        conditionLabel = count ? `Conditions ${count}` : "Conditions";
      } else if (
        ENC.getSystemProfile(combatant.systemId, combatant.customProfile)
          .usesConditionTrack
      ) {
        conditionLabel = `Condition ${combatant.conditionTrack || "Normal"}`;
      }

      quickActions.appendChild(
        this.createActionButton(conditionLabel, () => {
          if (this.conditionEditorIds.has(combatant.id)) {
            this.conditionEditorIds.delete(combatant.id);
          } else {
            this.conditionEditorIds.add(combatant.id);
          }
          this.render();
        }, {
          className: this.conditionEditorIds.has(combatant.id)
            ? "combatant-action-toggle active"
            : "combatant-action-toggle",
        }),
      );
    }

    if (modules.conditions && combatant.systemId === "dnd5e") {
      const exhaustion = Number(combatant.dnd5eExhaustion) || 0;
      quickActions.appendChild(
        this.createActionButton(
          exhaustion ? `Exhaustion ${exhaustion}` : "Exhaustion",
          () => {
            this.conditionEditorIds.add(combatant.id);
            this.render();
          },
          { className: exhaustion ? "combatant-action-toggle exhaustion" : "combatant-action-toggle" },
        ),
      );
    }

    card.appendChild(quickActions);

    if (this.conditionEditorIds.has(combatant.id)) {
      card.appendChild(this.renderConditionEditor(combatant));
    }

    if (this.expandedCombatantIds.has(combatant.id)) {
      card.appendChild(this.renderAdvancedDetails(combatant));
    }

    return card;
  },

  render() {
    if (!this.encounter) return;
    document.getElementById("encounterName").value = this.encounter.name;
    document.getElementById("encounterSystem").value = this.encounter.systemId;
    document.getElementById("roundNumber").textContent = this.encounter.round;
    document
      .getElementById("backgroundControls")
      .classList.toggle("hidden", !this.modules().backgrounds);

    const list = document.getElementById("combatantList");
    list.innerHTML = "";
    ENC.sortCombatants(this.encounter.combatants);
    for (const combatant of this.encounter.combatants)
      list.appendChild(this.renderCombatant(combatant));

    const combatantCount = this.encounter.combatants.length;
    const countBadge = document.getElementById("encounterRosterCount");
    if (countBadge) countBadge.textContent = String(combatantCount);
    document
      .getElementById("combatantTableHeader")
      ?.classList.toggle("hidden", combatantCount === 0);
    document
      .getElementById("emptyEncounter")
      .classList.toggle("hidden", combatantCount > 0);
    this.renderLibrarySelect();
    this.renderPresetControls();
    ENC.encounterUI?.renderPhase?.();
  },

  renderLibrarySelect() {
    const select = document.getElementById("encounterLibrarySelect");
    const current = select.value;
    select.innerHTML = '<option value="">Choose saved character…</option>';
    const matches = (ENC.libraryUI?.entries || []).filter(
      (entry) => entry.systemId === this.encounter.systemId,
    );
    for (const entry of matches) {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = `${entry.name} — ${entry.type}`;
      select.appendChild(option);
    }
    if ([...select.options].some((option) => option.value === current))
      select.value = current;
  },

  async renderPresetControls() {
    const select = document.getElementById("presetSelect");
    const modules = this.modules();
    document
      .getElementById("savePresetBtn")
      .classList.toggle("hidden", !modules.encounterPresets);
    select.classList.toggle("hidden", !modules.encounterPresets);
    document
      .getElementById("loadPresetBtn")
      .classList.toggle("hidden", !modules.encounterPresets);
    if (!modules.encounterPresets) return;
    const presets = await ENC.db.getPresets();
    select.innerHTML = '<option value="">Load preset…</option>';
    for (const preset of presets) {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = `${preset.name} — ${ENC.getSystemLabel(preset.systemId, preset.customProfile)}`;
      select.appendChild(option);
    }
  },

  async savePreset() {
    const name = prompt("Preset name:", this.encounter.name);
    if (!name?.trim()) return;
    if (ENC.app?.getPreparedTimerConfig) {
      this.encounter.timer = ENC.app.getPreparedTimerConfig();
    }
    await ENC.db.savePreset(this.encounter, name.trim());
    ENC.backup.scheduleExternalBackup();
    await this.renderPresetControls();
    ENC.app.toast("Encounter preset saved.");
  },

  async loadPreset() {
    const id = document.getElementById("presetSelect").value;
    if (!id) return;
    const preset = await ENC.db.get("encounters", id);
    if (!preset) return;
    if (
      !confirm(
        `Load preset “${preset.name}”? Current encounter will be replaced.`,
      )
    )
      return;
    this.encounter = ENC.deepClone(preset);
    this.encounter.id = "active";
    this.encounter.kind = "active";
    this.encounter.round = 1;
    this.encounter.currentId = null;
    this.encounter.combatants = (preset.combatants || []).map((c) =>
      ENC.normalizeCombatant(
        ENC.resetCombatantTransientState({
          ...c,
          id: ENC.makeId("cmb"),
          initiative: 10,
          hidden: false,
          createdOrder: Date.now() + Math.random(),
        }),
        preset.systemId,
        preset.customProfile,
      ),
    );
    ENC.app?.applyPreparedTimerConfig?.(this.encounter.timer, {
      broadcast: false,
    });
    await this.save("preset loaded");
    ENC.app?.broadcastTimerState?.();
    this.render();
    ENC.app?.refreshEncounterMediaControls?.();
    ENC.soundscapeUI?.render?.();
  },

  async newEncounter() {
    if (
      !confirm(
        "Start a new encounter? Permanent library data will not be deleted.",
      )
    )
      return;

    const previousEncounter = this.encounter
      ? ENC.deepClone(this.encounter)
      : null;
    if (ENC.isMeaningfulEncounter(previousEncounter)) {
      await ENC.db.addSnapshot(
        previousEncounter,
        "before new encounter",
        this.settings().snapshotLimit || 20,
      );
    }

    const systemId =
      this.encounter?.systemId || this.settings().systemId || "generic";
    const customProfile = ENC.deepClone(
      this.encounter?.customProfile ||
        this.settings().customProfile ||
        ENC.DEFAULT_SETTINGS.customProfile,
    );

    ENC.audio?.stopAll(250);
    this.encounter = ENC.createDefaultEncounter();
    this.encounter.systemId = systemId;
    this.encounter.customProfile = customProfile;
    this.encounter.phase = "prepared";
    this.encounter.playerDisplayMode = "standby";
    ENC.app.playerDisplayMode = "standby";
    ENC.app.playerDisplayPaused = true;
    ENC.app?.applyPreparedTimerConfig?.(this.encounter.timer, {
      broadcast: false,
    });

    await this.save();
    ENC.app?.renderSnapshots?.();

    this.render();
    ENC.app?.refreshEncounterMediaControls?.();
    ENC.soundscapeUI?.render?.();
    ENC.app?.broadcastDisplayState?.();
    ENC.app?.broadcastTimerState?.();
    ENC.app?.toast("New encounter ready.");
  },

  bind() {
    document
      .getElementById("nextTurnBtn")
      .addEventListener("click", () => this.moveTurn(1));
    document
      .getElementById("previousTurnBtn")
      .addEventListener("click", () => this.moveTurn(-1));
    document
      .getElementById("encounterName")
      .addEventListener("change", async (event) => {
        this.encounter.name = event.target.value.trim() || "Encounter";
        await this.save();
        this.render();
      });
    document
      .getElementById("encounterSystem")
      .addEventListener("change", async (event) => {
        this.encounter.systemId = event.target.value;
        this.encounter.customProfile = ENC.deepClone(
          ENC.settingsUI.settings.customProfile,
        );
        await this.save("system changed");
        this.render();
      });
    document
      .getElementById("addLibraryCombatantBtn")
      .addEventListener("click", async () => {
        const id = document.getElementById("encounterLibrarySelect").value;
        const entry = ENC.libraryUI.entries.find((item) => item.id === id);
        if (!entry) return ENC.app.toast("Choose a saved library entry first.");
        const initiative = Number(
          document.getElementById("libraryInitiative").value || 10,
        );
        await this.addLibraryEntry(entry, initiative);
      });
    document
      .getElementById("quickAddBtn")
      .addEventListener("click", () => this.quickAdd());
    document
      .getElementById("toggleAddCombatantBtn")
      ?.addEventListener("click", (event) => {
        const panel = document.getElementById("encounterAddPanel");
        if (!panel) return;
        const isHidden = panel.classList.toggle("hidden");
        event.currentTarget.setAttribute("aria-expanded", String(!isHidden));
        event.currentTarget.textContent = isHidden ? "+ Add Combatant" : "Close Add Combatant";
      });
    document
      .getElementById("newEncounterBtn")
      .addEventListener("click", () => this.newEncounter());
    document
      .getElementById("savePresetBtn")
      .addEventListener("click", () => this.savePreset());
    document
      .getElementById("loadPresetBtn")
      .addEventListener("click", () => this.loadPreset());
    document
      .getElementById("backgroundSelect")
      .addEventListener("change", async (event) => {
        this.encounter.background = event.target.value;
        this.encounter.display = this.encounter.display || {};
        this.encounter.display.combatImage = event.target.value;
        await this.save();
        this.render();
      });
    document
      .getElementById("sceneImageSelect")
      ?.addEventListener("change", async (event) => {
        this.encounter.display = this.encounter.display || {};
        this.encounter.display.sceneImage = event.target.value;
        await this.save();
        this.render();
      });
    document
      .getElementById("uploadBackgroundBtn")
      .addEventListener("click", async () => {
        const file = document.getElementById("backgroundUpload").files[0];
        if (!file) return ENC.app.toast("Choose a background image first.");
        try {
          const result = await ENC.assets.upload(file, "backgrounds/custom");
          this.encounter.background = result.url;
          this.encounter.display = this.encounter.display || {};
          this.encounter.display.combatImage = result.url;
          ENC.app?.refreshEncounterMediaControls?.();
          await this.save();
          this.render();
          ENC.app.toast("Background imported.");
        } catch (error) {
          ENC.app.toast(error.message);
        }
      });
  },
};
