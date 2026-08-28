/*
 * Copyright (C) 2026 enCounter contributors
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

ENC.combat = {
    encounter: null,
    saveTimer: null,

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
                    this.settings().snapshotLimit || 20
                );
            }
            ENC.sync.broadcast("encounter-updated", { encounter: normalizedEncounter });
            ENC.backup.scheduleExternalBackup();
            if (reason) ENC.app?.renderSnapshots?.();
        } finally {
            ENC.app?.setSaveIndicator(false);
        }
    },

    async addLibraryEntry(entry, initiative = 10) {
        const combatant = ENC.normalizeCombatant({
            ...ENC.deepClone(entry),
            id: ENC.makeId("cmb"),
            sourceLibraryId: entry.id,
            initiative,
            hp: entry.maxHp ?? "",
            conditionTrack: "Normal",
            visibleStatus: "",
            combatState: "active",
            hidden: false,
            delayed: false,
            ready: false,
            createdOrder: Date.now() + Math.random()
        }, entry.systemId, entry.customProfile);
        this.encounter.combatants.push(combatant);
        ENC.sortCombatants(this.encounter.combatants);
        if (!this.encounter.currentId) this.encounter.currentId = this.encounter.combatants.find((c) => c.combatState === "active")?.id || combatant.id;
        await this.save("combatant added");
        this.render();
    },

    async quickAdd() {
        const name = document.getElementById("quickName").value.trim();
        if (!name) return ENC.app.toast("Enter a combatant name.");
        const combatant = ENC.normalizeCombatant({
            id: ENC.makeId("cmb"),
            name,
            type: document.getElementById("quickType").value,
            systemId: this.encounter.systemId,
            customProfile: ENC.deepClone(this.encounter.customProfile),
            initiative: Number(document.getElementById("quickInitiative").value || 10),
            createdOrder: Date.now() + Math.random()
        }, this.encounter.systemId, this.encounter.customProfile);
        this.encounter.combatants.push(combatant);
        ENC.sortCombatants(this.encounter.combatants);
        if (!this.encounter.currentId) this.encounter.currentId = combatant.id;
        document.getElementById("quickName").value = "";
        await this.save("quick combatant added");
        this.render();
    },

    getCurrentIndex() {
        return this.encounter.combatants.findIndex((c) => c.id === this.encounter.currentId);
    },

    async moveTurn(direction) {
        const all = this.encounter.combatants;
        if (!all.length) return;

        ENC.sortCombatants(all);
        const transition = ENC.calculateTurnMove(
            all,
            this.encounter.currentId,
            this.encounter.round,
            direction
        );

        if (!transition.moved) {
            return ENC.app.toast("No active combatants are available in normal initiative.");
        }

        const hadCurrent = this.getCurrentIndex() >= 0;
        this.encounter.currentId = transition.currentId;
        this.encounter.round = transition.round;

        await this.save(
            hadCurrent
                ? (direction > 0 ? "next turn" : "previous turn")
                : "turn set"
        );
        this.render();
    },

    async changeHp(combatant, amount) {
        const current = ENC.finiteNumber(combatant.hp, 0);
        const delta = ENC.finiteNumber(amount, 0);
        const max = combatant.maxHp === "" ? null : ENC.finiteNumber(combatant.maxHp, null);
        let next = current + delta;
        if (max !== null && Number.isFinite(max)) next = Math.min(max, next);
        combatant.hp = Math.max(0, Number.isFinite(next) ? next : 0);
        await this.save();
        this.render();
    },

    async customHp(combatant, heal = false) {
        const amount = Number(prompt(heal ? "Healing amount:" : "Damage amount:", "1"));
        if (!Number.isFinite(amount) || amount < 0) return;
        await this.changeHp(combatant, heal ? amount : -amount);
    },

    async setState(combatant, state) {
        combatant.combatState = state;
        combatant.delayed = state === "delayed";
        combatant.ready = state === "ready";
        if (["defeated", "inactive", "delayed", "ready"].includes(state) && this.encounter.currentId === combatant.id) this.encounter.currentId = null;
        await this.save(`state: ${state}`);
        this.render();
    },

    async resumeCombatant(combatant, takeTurn = false) {
        combatant.combatState = "active";
        combatant.delayed = false;
        combatant.ready = false;
        if (takeTurn) this.encounter.currentId = combatant.id;
        await this.save(takeTurn ? "delayed/readied action triggered" : "combatant restored");
        this.render();
    },

    statSummary(combatant) {
        const profile = ENC.getSystemProfile(combatant.systemId, combatant.customProfile);
        return profile.stats.map((stat) => {
            const value = combatant.stats?.[stat.key];
            return value !== "" && value !== undefined ? `${stat.label} ${value}` : null;
        }).filter(Boolean).join(" | ");
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
            uses.textContent = ability.usesMax === "" ? "" : `${ability.usesRemaining}/${ability.usesMax}`;
            const use = document.createElement("button");
            use.textContent = "Use";
            use.disabled = ability.usesMax !== "" && Number(ability.usesRemaining) <= 0;
            use.addEventListener("click", async () => {
                if (ability.usesMax !== "") ability.usesRemaining = Math.max(0, Number(ability.usesRemaining) - 1);
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
                resource.current = Math.min(Number(resource.max), Number(resource.current) + 1);
                await this.save();
                this.render();
            });
            row.append(name, minus, plus);
            box.appendChild(row);
        }
        container.appendChild(box);
    },

    renderCombatant(combatant) {
        const modules = this.modules();
        const card = document.createElement("article");
        card.className = `combatant-card ${combatant.combatState || "active"}`;
        if (combatant.id === this.encounter.currentId) card.classList.add("current");
        card.appendChild(this.portraitElement(combatant));

        const identity = document.createElement("div");
        const nameRow = document.createElement("div");
        nameRow.className = "combatant-name-row";
        const name = document.createElement("h3");
        name.textContent = combatant.name;
        const type = document.createElement("span");
        type.className = "type-pill";
        type.textContent = combatant.type;
        const statePill = document.createElement("span");
        statePill.className = "state-pill";
        statePill.textContent = combatant.combatState;
        nameRow.append(name, type, statePill);
        if (combatant.hidden) {
            const visibilityPill = document.createElement("span");
            visibilityPill.className = "state-pill hidden-from-players-pill";
            visibilityPill.textContent = "Hidden from Players";
            nameRow.appendChild(visibilityPill);
        }
        identity.appendChild(nameRow);
        const system = document.createElement("div");
        system.className = "stat-line";
        system.textContent = ENC.getSystemLabel(combatant.systemId, combatant.customProfile);
        identity.appendChild(system);
        if (modules.systemStats) {
            const stats = document.createElement("div");
            stats.className = "stat-line";
            stats.textContent = this.statSummary(combatant) || "No system stats";
            identity.appendChild(stats);
        }
        if (modules.notes && combatant.notes) {
            const notes = document.createElement("div");
            notes.className = "module-box";
            const strong = document.createElement("strong");
            strong.textContent = "DM Notes";
            const text = document.createElement("div");
            text.className = "stat-line";
            text.textContent = combatant.notes;
            notes.append(strong, text);
            identity.appendChild(notes);
        }
        card.appendChild(identity);

        const fields = document.createElement("div");
        fields.className = "combatant-fields";
        fields.appendChild(this.createField("Initiative", combatant.initiative, async (value) => {
            combatant.initiative = Number(value || 0);
            ENC.sortCombatants(this.encounter.combatants);
            await this.save();
            this.render();
        }, "number"));
        if (modules.hp) fields.appendChild(this.createField("HP", combatant.hp, async (value) => {
            combatant.hp = value;
            await this.save();
        }, "number"));
        if (modules.status) fields.appendChild(this.createField("Visible Status", combatant.visibleStatus, async (value) => {
            combatant.visibleStatus = value.trim();
            await this.save();
            this.render();
        }));
        if (modules.conditions && ENC.getSystemProfile(combatant.systemId, combatant.customProfile).usesConditionTrack) {
            const label = document.createElement("label");
            label.className = "compact-control";
            const span = document.createElement("span");
            span.textContent = "Condition Track";
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
            label.append(span, select);
            fields.appendChild(label);
        }
        card.appendChild(fields);

        const detail = document.createElement("div");
        detail.className = "combatant-detail";
        const actions = document.createElement("div");
        actions.className = "combat-actions";

        const setTurn = document.createElement("button");
        setTurn.textContent = "Set Turn";
        setTurn.addEventListener("click", async () => {
            await this.resumeCombatant(combatant, true);
        });
        actions.appendChild(setTurn);

        if (modules.combatControls && modules.hp) {
            for (const damage of [1, 5, 10]) {
                const button = document.createElement("button");
                button.textContent = `−${damage}`;
                button.addEventListener("click", () => this.changeHp(combatant, -damage));
                actions.appendChild(button);
            }
            const customDamage = document.createElement("button");
            customDamage.textContent = "Damage…";
            customDamage.addEventListener("click", () => this.customHp(combatant, false));
            actions.appendChild(customDamage);
            for (const heal of [1, 5, 10]) {
                const button = document.createElement("button");
                button.textContent = `+${heal}`;
                button.addEventListener("click", () => this.changeHp(combatant, heal));
                actions.appendChild(button);
            }
            const customHeal = document.createElement("button");
            customHeal.textContent = "Heal…";
            customHeal.addEventListener("click", () => this.customHp(combatant, true));
            actions.appendChild(customHeal);
        }

        if (modules.combatControls) {
            const delay = document.createElement("button");
            delay.textContent = "Delay";
            delay.addEventListener("click", () => this.setState(combatant, "delayed"));
            const ready = document.createElement("button");
            ready.textContent = "Ready";
            ready.addEventListener("click", () => this.setState(combatant, "ready"));
            const defeated = document.createElement("button");
            defeated.textContent = "Defeated";
            defeated.addEventListener("click", () => this.setState(combatant, "defeated"));
            const inactive = document.createElement("button");
            inactive.textContent = "Inactive";
            inactive.addEventListener("click", () => this.setState(combatant, "inactive"));
            const restore = document.createElement("button");
            restore.textContent = combatant.delayed || combatant.ready ? "Trigger / Resume" : "Restore";
            restore.addEventListener("click", () => this.resumeCombatant(combatant, combatant.delayed || combatant.ready));
            actions.append(delay, ready, defeated, inactive, restore);
        }

        if (modules.hiddenCombatants) {
            const hidden = document.createElement("button");
            hidden.textContent = combatant.hidden
                ? "Reveal to Players"
                : "Hide from Players";
            hidden.addEventListener("click", async () => {
                combatant.hidden = !combatant.hidden;
                await this.save();
                this.render();
            });
            actions.appendChild(hidden);
        }

        const remove = document.createElement("button");
        remove.textContent = "Remove";
        remove.className = "danger-outline";
        remove.addEventListener("click", async () => {
            if (!confirm(`Remove ${combatant.name} from this encounter? The permanent library entry is not affected.`)) return;
            this.encounter.combatants = this.encounter.combatants.filter((c) => c.id !== combatant.id);
            if (this.encounter.currentId === combatant.id) this.encounter.currentId = null;
            await this.save("combatant removed");
            this.render();
        });
        actions.appendChild(remove);

        detail.appendChild(actions);
        this.renderAbilities(detail, combatant);
        this.renderResources(detail, combatant);
        card.appendChild(detail);
        return card;
    },

    render() {
        if (!this.encounter) return;
        document.getElementById("encounterName").value = this.encounter.name;
        document.getElementById("encounterSystem").value = this.encounter.systemId;
        document.getElementById("roundNumber").textContent = this.encounter.round;
        document.getElementById("backgroundControls").classList.toggle("hidden", !this.modules().backgrounds);

        const list = document.getElementById("combatantList");
        list.innerHTML = "";
        ENC.sortCombatants(this.encounter.combatants);
        for (const combatant of this.encounter.combatants) list.appendChild(this.renderCombatant(combatant));
        document.getElementById("emptyEncounter").classList.toggle("hidden", this.encounter.combatants.length > 0);
        this.renderLibrarySelect();
        this.renderPresetControls();

    },

    renderLibrarySelect() {
        const select = document.getElementById("encounterLibrarySelect");
        const current = select.value;
        select.innerHTML = '<option value="">Choose saved character…</option>';
        const matches = (ENC.libraryUI?.entries || []).filter((entry) => entry.systemId === this.encounter.systemId);
        for (const entry of matches) {
            const option = document.createElement("option");
            option.value = entry.id;
            option.textContent = `${entry.name} — ${entry.type}`;
            select.appendChild(option);
        }
        if ([...select.options].some((option) => option.value === current)) select.value = current;
    },

    async renderPresetControls() {
        const select = document.getElementById("presetSelect");
        const modules = this.modules();
        document.getElementById("savePresetBtn").classList.toggle("hidden", !modules.encounterPresets);
        select.classList.toggle("hidden", !modules.encounterPresets);
        document.getElementById("loadPresetBtn").classList.toggle("hidden", !modules.encounterPresets);
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
        if (!confirm(`Load preset “${preset.name}”? Current encounter will be replaced.`)) return;
        this.encounter = ENC.deepClone(preset);
        this.encounter.id = "active";
        this.encounter.kind = "active";
        this.encounter.round = 1;
        this.encounter.currentId = null;
        this.encounter.combatants = (preset.combatants || []).map((c) => ENC.normalizeCombatant({
            ...c,
            id: ENC.makeId("cmb"),
            initiative: 10,
            hp: c.maxHp ?? c.hp ?? "",
            conditionTrack: "Normal",
            visibleStatus: "",
            combatState: "active",
            hidden: false,
            delayed: false,
            ready: false,
            createdOrder: Date.now() + Math.random()
        }, preset.systemId, preset.customProfile));
        await this.save("preset loaded");
        this.render();
        ENC.assets.fillSelect(document.getElementById("backgroundSelect"), "backgrounds/", this.encounter.background);
    },

    async newEncounter() {
        if (!confirm("Start a new encounter? Permanent library data will not be deleted.")) return;

        const previousEncounter = this.encounter ? ENC.deepClone(this.encounter) : null;
        if (ENC.isMeaningfulEncounter(previousEncounter)) {
            await ENC.db.addSnapshot(
                previousEncounter,
                "before new encounter",
                this.settings().snapshotLimit || 20
            );
        }

        const systemId = this.encounter?.systemId || this.settings().systemId || "generic";
        const customProfile = ENC.deepClone(
            this.encounter?.customProfile ||
            this.settings().customProfile ||
            ENC.DEFAULT_SETTINGS.customProfile
        );

        this.encounter = ENC.createDefaultEncounter();
        this.encounter.systemId = systemId;
        this.encounter.customProfile = customProfile;

        await this.save();
        ENC.app?.renderSnapshots?.();

        this.render();
        ENC.assets.fillSelect(document.getElementById("backgroundSelect"), "backgrounds/", "");
        ENC.app?.toast("New encounter ready.");
    },

    bind() {
        document.getElementById("nextTurnBtn").addEventListener("click", () => this.moveTurn(1));
        document.getElementById("previousTurnBtn").addEventListener("click", () => this.moveTurn(-1));
        document.getElementById("encounterName").addEventListener("change", async (event) => {
            this.encounter.name = event.target.value.trim() || "Encounter";
            await this.save();
            this.render();
        });
        document.getElementById("encounterSystem").addEventListener("change", async (event) => {
            this.encounter.systemId = event.target.value;
            this.encounter.customProfile = ENC.deepClone(ENC.settingsUI.settings.customProfile);
            await this.save("system changed");
            this.render();
        });
        document.getElementById("addLibraryCombatantBtn").addEventListener("click", async () => {
            const id = document.getElementById("encounterLibrarySelect").value;
            const entry = ENC.libraryUI.entries.find((item) => item.id === id);
            if (!entry) return ENC.app.toast("Choose a saved library entry first.");
            const initiative = Number(document.getElementById("libraryInitiative").value || 10);
            await this.addLibraryEntry(entry, initiative);
        });
        document.getElementById("quickAddBtn").addEventListener("click", () => this.quickAdd());
        document.getElementById("newEncounterBtn").addEventListener("click", () => this.newEncounter());
        document.getElementById("savePresetBtn").addEventListener("click", () => this.savePreset());
        document.getElementById("loadPresetBtn").addEventListener("click", () => this.loadPreset());
        document.getElementById("backgroundSelect").addEventListener("change", async (event) => {
            this.encounter.background = event.target.value;
            await this.save();
            this.render();
        });
        document.getElementById("uploadBackgroundBtn").addEventListener("click", async () => {
            const file = document.getElementById("backgroundUpload").files[0];
            if (!file) return ENC.app.toast("Choose a background image first.");
            try {
                const result = await ENC.assets.upload(file, "backgrounds/custom");
                this.encounter.background = result.url;
                ENC.assets.fillSelect(document.getElementById("backgroundSelect"), "backgrounds/", result.url);
                await this.save();
                this.render();
                ENC.app.toast("Background imported.");
            } catch (error) {
                ENC.app.toast(error.message);
            }
        });
        document.getElementById("openDisplayBtn").addEventListener("click", () => window.open("display.html", "enCounterPlayerDisplay", "width=1400,height=900"));
    }
};
