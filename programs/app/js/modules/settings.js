/*
 * Copyright (C) 2026 enCounter contributors
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

ENC.settingsUI = {
    settings: null,

    async load() {
        this.settings = await ENC.db.getSettings();
        return this.settings;
    },

    applyMode(mode) {
        if (ENC.MODE_PRESETS[mode]) {
            this.settings.mode = mode;
            this.settings.modules = { ...ENC.MODE_PRESETS[mode] };
        }
    },

    async save() {
        this.settings = ENC.normalizeSettings(this.settings);
        await ENC.db.saveSettings(this.settings);
        ENC.sync.broadcast("settings-updated", { settings: this.settings });
        ENC.backup.scheduleExternalBackup();
    },

    render() {
        const modeSelect = document.getElementById("settingsMode");
        modeSelect.value = this.settings.mode || "standard";

        const moduleContainer = document.getElementById("moduleCheckboxes");
        moduleContainer.innerHTML = "";
        const labels = {
            hp: "HP Tracking",
            status: "Visible Status Effects",
            conditions: "Conditions / Condition Track",
            systemStats: "System Statistics",
            abilities: "Abilities",
            resources: "Resources",
            notes: "Private DM Notes",
            hiddenCombatants: "Hidden Combatants",
            combatControls: "Damage / Healing & Combat Controls",
            backgrounds: "Encounter Backgrounds",
            encounterPresets: "Encounter Presets"
        };

        for (const [key, labelText] of Object.entries(labels)) {
            const label = document.createElement("label");
            label.className = "check-row";
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.dataset.module = key;
            checkbox.checked = Boolean(this.settings.modules?.[key]);
            checkbox.addEventListener("change", async () => {
                this.settings.modules[key] = checkbox.checked;
                this.settings.mode = "custom";
                modeSelect.value = "custom";
                await this.save();
                ENC.combat?.render?.();
            });
            label.append(checkbox, document.createTextNode(labelText));
            moduleContainer.appendChild(label);
        }

        document.getElementById("externalBackupEnabled").checked = Boolean(this.settings.externalBackup);
    },

    bind() {
        document.getElementById("settingsMode").addEventListener("change", async (event) => {
            const mode = event.target.value;
            if (mode !== "custom") this.applyMode(mode);
            else this.settings.mode = "custom";
            await this.save();
            this.render();
            ENC.combat?.render?.();
        });

        document.getElementById("externalBackupEnabled").addEventListener("change", async (event) => {
            this.settings.externalBackup = event.target.checked;
            await this.save();
        });
    }
};
