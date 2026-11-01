/*
 * Copyright (C) 2026 Zygons
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

ENC.libraryUI = {
    entries: [],
    editingId: null,

    async load() {
        this.entries = (await ENC.db.getAll("library")).map(ENC.normalizeLibraryEntry);
        this.entries.sort((a, b) => a.name.localeCompare(b.name));
        return this.entries;
    },

    currentCustomProfile() {
        return ENC.settingsUI.settings?.customProfile || ENC.DEFAULT_SETTINGS.customProfile;
    },

    renderStatFields(values = {}) {
        const systemId = document.getElementById("librarySystem").value;
        const profile = ENC.getSystemProfile(systemId, this.currentCustomProfile());
        const container = document.getElementById("libraryStatFields");
        container.innerHTML = "";
        for (const stat of profile.stats) {
            const label = document.createElement("label");
            const span = document.createElement("span");
            span.textContent = stat.label;
            const input = document.createElement("input");
            input.id = `libraryStat_${stat.key}`;
            input.type = stat.type || "text";
            input.value = values[stat.key] ?? "";
            label.append(span, input);
            container.appendChild(label);
        }
    },

    collectStats() {
        const systemId = document.getElementById("librarySystem").value;
        const profile = ENC.getSystemProfile(systemId, this.currentCustomProfile());
        const stats = {};
        for (const stat of profile.stats) {
            stats[stat.key] = document.getElementById(`libraryStat_${stat.key}`)?.value ?? "";
        }
        return stats;
    },

    fillPortraitSelect(selected = "") {
        ENC.assets.fillSelect(document.getElementById("libraryPortraitSelect"), "portraits/", selected);
    },

    editorPanel() {
        return document.getElementById("libraryEditorPanel");
    },

    showEditor() {
        this.editorPanel()?.classList.remove("hidden");
    },

    hideEditor() {
        this.editorPanel()?.classList.add("hidden");
    },

    currentTypeFilter() {
        return document.getElementById("libraryTypeFilter")?.value || "all";
    },

    defaultTypeForFilter(filter = this.currentTypeFilter()) {
        if (filter === "player" || filter === "npc") return filter;
        if (filter === "enemy-creature") return "enemy";
        return "player";
    },

    typeLabel(type) {
        return {
            player: "Player",
            npc: "NPC",
            enemy: "Enemy",
            creature: "Creature",
        }[type] || "Character";
    },

    updateCreateButton(filter = this.currentTypeFilter()) {
        const button = document.getElementById("newLibraryEntryBtn");
        if (!button) return;
        const label =
            filter === "player"
                ? "Player"
                : filter === "npc"
                  ? "NPC"
                  : filter === "enemy-creature"
                    ? "Enemy / Creature"
                    : "Character";
        button.textContent = `+ New ${label}`;
    },

    resetForm(options = {}) {
        const hideEditor = options.hideEditor !== false;
        this.editingId = null;
        document.getElementById("libraryForm").reset();
        document.getElementById("libraryEditId").value = "";
        document.getElementById("libraryFormTitle").textContent = "New Library Entry";
        document.getElementById("librarySystem").value = ENC.combat?.encounter?.systemId || ENC.settingsUI.settings?.systemId || "generic";
        this.renderStatFields();
        this.fillPortraitSelect();
        if (hideEditor) this.hideEditor();
    },

    openCreate() {
        const type = this.defaultTypeForFilter();
        this.resetForm({ hideEditor: false });
        document.getElementById("libraryType").value = type;
        document.getElementById("libraryFormTitle").textContent = `New ${this.typeLabel(type)}`;
        this.showEditor();
        document.getElementById("libraryName")?.focus();
    },

    edit(entry) {
        this.editingId = entry.id;
        document.getElementById("libraryEditId").value = entry.id;
        document.getElementById("libraryFormTitle").textContent = `Edit: ${entry.name}`;
        document.getElementById("cancelLibraryEditBtn").classList.remove("hidden");
        document.getElementById("libraryName").value = entry.name;
        document.getElementById("libraryType").value = entry.type;
        document.getElementById("librarySystem").value = entry.systemId;
        document.getElementById("libraryMaxHp").value = entry.maxHp ?? "";
        document.getElementById("libraryTags").value = (entry.tags || []).join(", ");
        document.getElementById("libraryNotes").value = entry.notes || "";
        document.getElementById("libraryAbilities").value = ENC.abilitiesToText(entry.abilities);
        document.getElementById("libraryResources").value = ENC.resourcesToText(entry.resources);
        this.renderStatFields(entry.stats || {});
        this.fillPortraitSelect(entry.portrait || "");
        this.showEditor();
        ENC.dmWorkspace?.open?.("characters", {
            characterType: entry.type,
        });
    },

    filteredEntries() {
        const search = document.getElementById("librarySearch").value.trim().toLowerCase();
        const type = document.getElementById("libraryTypeFilter")?.value || "all";
        const system = document.getElementById("librarySystemFilter").value;
        return this.entries.filter((entry) => {
            if (type === "enemy-creature") {
                if (entry.type !== "enemy" && entry.type !== "creature") return false;
            } else if (type !== "all" && entry.type !== type) {
                return false;
            }
            if (system !== "all" && entry.systemId !== system) return false;
            if (search) {
                const haystack = `${entry.name} ${(entry.tags || []).join(" ")} ${entry.notes || ""}`.toLowerCase();
                if (!haystack.includes(search)) return false;
            }
            return true;
        });
    },

    statSummary(entry) {
        const profile = ENC.getSystemProfile(entry.systemId, entry.customProfile || this.currentCustomProfile());
        return profile.stats
            .map((stat) => {
                const value = entry.stats?.[stat.key];
                return value !== "" && value !== undefined ? `${stat.label} ${value}` : null;
            })
            .filter(Boolean)
            .join(" | ");
    },

    render() {
        const container = document.getElementById("libraryCards");
        const empty = document.getElementById("emptyLibrary");
        const count = document.getElementById("libraryResultCount");
        const entries = this.filteredEntries();
        container.innerHTML = "";
        empty.classList.toggle("hidden", entries.length > 0);
        if (count) count.textContent = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
        this.updateCreateButton();

        for (const entry of entries) {
            const row = document.createElement("article");
            row.className = "library-row";
            row.dataset.libraryId = entry.id;

            const identity = document.createElement("div");
            identity.className = "library-row-identity";

            const portrait = document.createElement("div");
            portrait.className = "library-row-portrait";
            if (entry.portrait) {
                const img = document.createElement("img");
                img.src = entry.portrait;
                img.alt = "";
                portrait.appendChild(img);
            } else {
                portrait.textContent = entry.name.charAt(0).toUpperCase();
            }

            const identityText = document.createElement("div");
            identityText.className = "library-row-name-block";
            const title = document.createElement("strong");
            title.textContent = entry.name;
            const meta = document.createElement("div");
            meta.className = "library-row-meta";
            const type = document.createElement("span");
            type.className = `library-type-badge type-${entry.type}`;
            type.textContent = this.typeLabel(entry.type);
            meta.appendChild(type);
            if (entry.tags?.length) {
                const tags = document.createElement("span");
                tags.textContent = entry.tags.slice(0, 2).join(" · ");
                tags.title = entry.tags.join(", ");
                meta.appendChild(tags);
            }
            identityText.append(title, meta);
            identity.append(portrait, identityText);

            const system = document.createElement("div");
            system.className = "library-row-system";
            system.textContent = ENC.getSystemLabel(entry.systemId, entry.customProfile);

            const hp = document.createElement("div");
            hp.className = "library-row-hp";
            hp.textContent = entry.maxHp !== "" && entry.maxHp !== undefined ? entry.maxHp : "—";

            const stats = document.createElement("div");
            stats.className = "library-row-stats";
            stats.textContent = this.statSummary(entry) || "No system stats";
            stats.title = stats.textContent;

            const actions = document.createElement("div");
            actions.className = "library-row-actions";

            const add = document.createElement("button");
            add.type = "button";
            add.textContent = "Add";
            add.className = "primary compact-action";
            add.title = `Add ${entry.name} to the current encounter`;
            add.addEventListener("click", async () => {
                const initiative = Number(prompt(`Initiative for ${entry.name}:`, "10"));
                if (!Number.isFinite(initiative)) return;
                await ENC.combat.addLibraryEntry(entry, initiative);
                document.querySelector('[data-section="encounterSection"]')?.click();
            });

            const edit = document.createElement("button");
            edit.type = "button";
            edit.textContent = "Edit";
            edit.className = "compact-action";
            edit.addEventListener("click", () => this.edit(entry));

            const more = document.createElement("details");
            more.className = "library-row-more";
            const summary = document.createElement("summary");
            summary.textContent = "⋯";
            summary.title = `More actions for ${entry.name}`;
            summary.setAttribute("aria-label", `More actions for ${entry.name}`);

            const menu = document.createElement("div");
            menu.className = "library-row-more-menu";

            const duplicate = document.createElement("button");
            duplicate.type = "button";
            duplicate.textContent = "Duplicate";
            duplicate.addEventListener("click", async () => {
                const copy = ENC.deepClone(entry);
                copy.id = ENC.makeId("lib");
                copy.name = `${entry.name} Copy`;
                copy.createdAt = new Date().toISOString();
                copy.updatedAt = copy.createdAt;
                await ENC.db.put("library", copy);
                ENC.backup.scheduleExternalBackup();
                await this.load();
                this.render();
                ENC.combat.renderLibrarySelect();
                ENC.app.toast("Library entry duplicated.");
            });

            const exportOne = document.createElement("button");
            exportOne.type = "button";
            exportOne.textContent = "Export";
            exportOne.addEventListener("click", () => {
                const safeName = ENC.backup.safeFilename(entry.name, "library-entry");
                ENC.backup.downloadJson(`${safeName}.json`, {
                    app: ENC.APP_NAME,
                    appVersion: ENC.APP_VERSION,
                    schemaVersion: ENC.DB_VERSION,
                    exportType: "library-entry",
                    exportedAt: new Date().toISOString(),
                    entry,
                });
            });

            const del = document.createElement("button");
            del.type = "button";
            del.textContent = "Delete";
            del.className = "danger-outline";
            del.addEventListener("click", async () => {
                if (!confirm(`Delete ${entry.name} from the permanent library?`)) return;
                await ENC.db.delete("library", entry.id);
                ENC.backup.scheduleExternalBackup();
                await this.load();
                this.render();
                ENC.combat.renderLibrarySelect();
                this.hideEditor();
            });

            menu.append(duplicate, exportOne, del);
            more.append(summary, menu);
            actions.append(add, edit, more);
            row.append(identity, system, hp, stats, actions);
            container.appendChild(row);
        }
    },

    async saveForm(event) {
        event.preventDefault();
        const existing = this.editingId ? this.entries.find((entry) => entry.id === this.editingId) : null;
        const systemId = document.getElementById("librarySystem").value;
        const now = new Date().toISOString();
        const entry = ENC.normalizeLibraryEntry({
            ...(existing || {}),
            id: existing?.id || ENC.makeId("lib"),
            name: document.getElementById("libraryName").value.trim(),
            type: document.getElementById("libraryType").value,
            systemId,
            customProfile: ENC.deepClone(this.currentCustomProfile()),
            maxHp: document.getElementById("libraryMaxHp").value,
            portrait: document.getElementById("libraryPortraitSelect").value,
            stats: this.collectStats(),
            tags: document.getElementById("libraryTags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
            notes: document.getElementById("libraryNotes").value.trim(),
            abilities: ENC.parseAbilities(document.getElementById("libraryAbilities").value),
            resources: ENC.parseResources(document.getElementById("libraryResources").value),
            createdAt: existing?.createdAt || now,
            updatedAt: now
        });

        await ENC.db.put("library", entry);
        ENC.backup.scheduleExternalBackup();
        await this.load();
        this.render();
        ENC.combat.renderLibrarySelect();
        this.resetForm();
        ENC.app.toast("Library entry saved.");
    },

    async uploadPortrait() {
        const file = document.getElementById("libraryPortraitUpload").files[0];
        if (!file) return ENC.app.toast("Choose a portrait image first.");
        const type = document.getElementById("libraryType").value;
        const folder = type === "player" ? "players" : type === "npc" ? "npcs" : type === "enemy" ? "enemies" : "custom";
        try {
            const result = await ENC.assets.upload(file, `portraits/${folder}`);
            this.fillPortraitSelect(result.url);
            document.getElementById("libraryPortraitSelect").value = result.url;
            ENC.assets.renderGrid(document.getElementById("assetGrid"), document.getElementById("assetFilter").value);
            ENC.app.toast("Portrait imported.");
        } catch (error) {
            ENC.app.toast(error.message);
        }
    },

    bind() {
        document.getElementById("librarySystem").addEventListener("change", () => this.renderStatFields());
        document.getElementById("libraryForm").addEventListener("submit", (event) => this.saveForm(event));
        document.getElementById("newLibraryEntryBtn")?.addEventListener("click", () => this.openCreate());
        document.getElementById("cancelLibraryEditBtn").addEventListener("click", () => this.resetForm());
        document.getElementById("uploadLibraryPortraitBtn").addEventListener("click", () => this.uploadPortrait());
        for (const id of ["librarySearch", "libraryTypeFilter", "librarySystemFilter"]) {
            const element = document.getElementById(id);
            element?.addEventListener(id === "librarySearch" ? "input" : "change", () => this.render());
        }
    }
};
