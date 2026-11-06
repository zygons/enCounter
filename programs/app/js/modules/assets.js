/*
 * Copyright (C) 2026 Zygons
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

ENC.assets = {
    items: [],

    async refresh() {
        try {
            const response = await fetch("/api/assets", { cache: "no-store" });
            if (!response.ok) throw new Error("Unable to read asset folders.");
            const payload = await response.json();
            this.items = payload.assets || [];
        } catch (error) {
            console.warn("Asset API unavailable", error);
            this.items = [];
        }
        return this.items;
    },

    byPrefix(prefix) {
        return this.items.filter((item) => item.category.startsWith(prefix));
    },

    isImage(item) {
        return /\.(png|jpe?g|webp)$/i.test(item?.name || "");
    },

    isAudio(item) {
        return /\.(mp3|ogg|wav|flac)$/i.test(item?.name || "");
    },

    categoryLabel(category = "") {
        const value = String(category || "");
        const labels = {
            "backgrounds/custom": "Background",
            "portraits/players": "Player Portrait",
            "portraits/npcs": "NPC Portrait",
            "portraits/enemies": "Enemy Portrait",
            "portraits/custom": "Portrait",
            tokens: "Token",
            "icons/conditions": "Condition Icon",
            "sounds/music": "Music",
            "sounds/ambience": "Ambience",
            "sounds/sfx": "Sound Effect",
            "sounds/custom": "Audio",
        };
        if (labels[value]) return labels[value];
        const last = value.split("/").filter(Boolean).pop() || "Asset";
        return last.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    },

    filtered(prefix = "", query = "") {
        const normalizedQuery = String(query || "").trim().toLowerCase();
        return (prefix ? this.byPrefix(prefix) : this.items).filter((item) => {
            if (!normalizedQuery) return true;
            return `${item.name || ""} ${item.category || ""}`.toLowerCase().includes(normalizedQuery);
        });
    },

    fillSelect(select, prefix, selected = "") {
        select.innerHTML = '<option value="">— None —</option>';
        for (const item of this.byPrefix(prefix)) {
            const option = document.createElement("option");
            option.value = item.url;
            option.textContent = `${item.category.replace(prefix, "").replace(/^\//, "")} ${item.name}`.trim();
            if (item.url === selected) option.selected = true;
            select.appendChild(option);
        }
    },


    normalizeAssetUrl(value) {
        const text = String(value || "").trim();
        if (!text) return "";
        try {
            const parsed = new URL(text, window.location.origin);
            return decodeURIComponent(parsed.pathname);
        } catch (_error) {
            try {
                return decodeURIComponent(text.split("?")[0].split("#")[0]);
            } catch (_decodeError) {
                return text.split("?")[0].split("#")[0];
            }
        }
    },

    objectContainsAssetUrl(value, targetUrl, seen = new Set()) {
        if (typeof value === "string") {
            return this.normalizeAssetUrl(value) === targetUrl;
        }
        if (!value || typeof value !== "object") return false;
        if (seen.has(value)) return false;
        seen.add(value);

        if (Array.isArray(value)) {
            return value.some((item) => this.objectContainsAssetUrl(item, targetUrl, seen));
        }
        return Object.values(value).some((item) => this.objectContainsAssetUrl(item, targetUrl, seen));
    },

    async findReferences(url) {
        const targetUrl = this.normalizeAssetUrl(url);
        if (!targetUrl) return [];

        const references = [];
        const [library, encounters, snapshots] = await Promise.all([
            ENC.db.getAll("library").catch(() => []),
            ENC.db.getAll("encounters").catch(() => []),
            ENC.db.getAll("snapshots").catch(() => []),
        ]);

        for (const entry of library || []) {
            if (this.objectContainsAssetUrl(entry, targetUrl)) {
                references.push(`Character Library: ${entry.name || "Unnamed entry"}`);
            }
        }

        for (const encounter of encounters || []) {
            if (!this.objectContainsAssetUrl(encounter, targetUrl)) continue;
            let label = "Saved Encounter";
            if (encounter.id === "active" || encounter.kind === "active") label = "Active Encounter";
            else if (encounter.saveMode === "state") label = "Saved Encounter State";
            else if (encounter.kind === "preset") label = "Encounter Preset";
            else if (encounter.saveMode === "template" || encounter.kind === "saved") label = "Encounter Template";
            references.push(`${label}: ${encounter.name || "Unnamed encounter"}`);
        }

        const liveEncounter = ENC.combat?.encounter;
        if (liveEncounter && this.objectContainsAssetUrl(liveEncounter, targetUrl)) {
            references.push(`Current Run Encounter: ${liveEncounter.name || "Unnamed encounter"}`);
        }

        for (const snapshot of snapshots || []) {
            if (!this.objectContainsAssetUrl(snapshot?.encounter, targetUrl)) continue;
            const date = snapshot.createdAt ? new Date(snapshot.createdAt).toLocaleString() : "Unknown date";
            references.push(`Recovery Snapshot: ${snapshot?.encounter?.name || "Encounter"} (${date})`);
        }

        return [...new Set(references)];
    },

    async requestDelete(item) {
        if (!item?.url) return;
        const references = await this.findReferences(item.url);
        if (references.length) {
            const shown = references.slice(0, 8);
            const remainder = references.length - shown.length;
            const detail = shown.map((reference) => `• ${reference}`).join("\n");
            const extra = remainder > 0 ? `\n• …and ${remainder} more reference${remainder === 1 ? "" : "s"}.` : "";
            alert(
                `Cannot delete “${item.name}” because it is still in use.\n\n${detail}${extra}\n\nRemove or replace those references first, then delete the asset.`
            );
            ENC.app?.toast?.("Asset kept because it is still referenced by enCounter data.");
            return;
        }

        const confirmed = confirm(
            `Permanently delete “${item.name}” from the Asset Library?\n\nThis deletes the file from disk and cannot be undone.`
        );
        if (!confirmed) return;

        try {
            await this.deleteAsset(item.url);
            if (typeof ENC.app?.refreshAssetUI === "function") ENC.app.refreshAssetUI();
            else {
                this.renderGrid(
                    document.getElementById("assetGrid"),
                    document.getElementById("assetFilter")?.value || "",
                );
            }
            ENC.app?.toast?.(`Deleted asset: ${item.name}`);
        } catch (error) {
            ENC.app?.toast?.(`Asset could not be deleted: ${error.message}`);
        }
    },

    createDeleteButton(item) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "asset-delete-button danger-outline";
        button.textContent = "Delete";
        button.title = `Delete ${item.name}`;
        button.setAttribute("aria-label", `Delete ${item.name}`);
        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.requestDelete(item);
        });
        return button;
    },

    async deleteAsset(url) {
        if (!url || !String(url).startsWith("/assets/")) {
            throw new Error("Only local enCounter assets can be deleted.");
        }
        const params = new URLSearchParams({ url });
        const response = await fetch(`/api/assets/delete?${params.toString()}`, { method: "DELETE" });
        if (!response.ok) {
            const message = await response.text();
            throw new Error(message || "Asset deletion failed.");
        }
        const payload = await response.json();
        await this.refresh();
        return payload;
    },

    async upload(file, category) {
        if (!file) throw new Error("Choose a file first.");
        const isAudioCategory = String(category || "").startsWith("sounds/");
        const imageTypes = ["image/png", "image/jpeg", "image/webp"];
        const audioTypes = ["audio/mpeg", "audio/ogg", "audio/wav", "audio/x-wav", "audio/flac", "audio/x-flac"];
        const allowed = isAudioCategory ? audioTypes : imageTypes;
        if (!allowed.includes(file.type)) {
            throw new Error(isAudioCategory
                ? "Only MP3, OGG, WAV, and FLAC audio files are supported."
                : "Only PNG, JPEG, and WebP images are supported.");
        }
        const maxBytes = isAudioCategory ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxBytes) throw new Error(isAudioCategory ? "The audio file is larger than 50 MB." : "The image is larger than 10 MB.");

        const params = new URLSearchParams({ category, name: file.name });
        const response = await fetch(`/api/assets/upload?${params.toString()}`, {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file
        });
        if (!response.ok) {
            const message = await response.text();
            throw new Error(message || "Upload failed.");
        }
        const payload = await response.json();
        await this.refresh();
        return payload;
    },

    createImageCard(item) {
        const card = document.createElement("article");
        card.className = "asset-visual-card";

        const preview = document.createElement("div");
        preview.className = "asset-visual-preview";
        const img = document.createElement("img");
        img.src = item.url;
        img.alt = item.name || "Asset preview";
        img.loading = "lazy";
        preview.appendChild(img);

        const meta = document.createElement("div");
        meta.className = "asset-visual-meta";
        const name = document.createElement("strong");
        name.textContent = item.name;
        name.title = item.name;
        const category = document.createElement("span");
        category.className = "asset-type-pill";
        category.textContent = this.categoryLabel(item.category);
        const actions = document.createElement("div");
        actions.className = "asset-item-actions";
        actions.append(category, this.createDeleteButton(item));
        meta.append(name, actions);

        card.append(preview, meta);
        return card;
    },

    createAudioRow(item) {
        const row = document.createElement("article");
        row.className = "asset-audio-row";

        const icon = document.createElement("div");
        icon.className = "asset-audio-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = "♪";

        const info = document.createElement("div");
        info.className = "asset-audio-info";
        const name = document.createElement("strong");
        name.textContent = item.name;
        name.title = item.name;
        const category = document.createElement("span");
        category.textContent = this.categoryLabel(item.category);
        info.append(name, category);

        const audio = document.createElement("audio");
        audio.controls = true;
        audio.preload = "metadata";
        audio.src = item.url;
        audio.setAttribute("aria-label", `Preview ${item.name}`);

        const actions = document.createElement("div");
        actions.className = "asset-item-actions";
        actions.appendChild(this.createDeleteButton(item));

        row.append(icon, info, audio, actions);
        return row;
    },

    createOtherRow(item) {
        const row = document.createElement("article");
        row.className = "asset-file-row";
        const name = document.createElement("strong");
        name.textContent = item.name;
        const category = document.createElement("span");
        category.textContent = this.categoryLabel(item.category);
        const actions = document.createElement("div");
        actions.className = "asset-item-actions";
        actions.append(category, this.createDeleteButton(item));
        row.append(name, actions);
        return row;
    },

    createSection(title, count, className = "") {
        const section = document.createElement("section");
        section.className = `asset-media-section ${className}`.trim();
        const heading = document.createElement("div");
        heading.className = "asset-media-heading";
        const h3 = document.createElement("h3");
        h3.textContent = title;
        const badge = document.createElement("span");
        badge.className = "asset-section-count";
        badge.textContent = String(count);
        heading.append(h3, badge);
        section.appendChild(heading);
        return section;
    },

    renderGrid(container, prefix = "", query = null) {
        if (!container) return;
        const effectiveQuery = query === null
            ? (document.getElementById("assetSearch")?.value || "")
            : query;
        const matches = this.filtered(prefix, effectiveQuery);
        container.innerHTML = "";

        const count = document.getElementById("assetResultCount");
        if (count) count.textContent = `${matches.length} ${matches.length === 1 ? "asset" : "assets"}`;

        if (!matches.length) {
            const empty = document.createElement("div");
            empty.className = "empty-state asset-empty-state";
            empty.textContent = effectiveQuery
                ? "No assets match this search."
                : "No assets found in this category.";
            container.appendChild(empty);
            return;
        }

        const images = matches.filter((item) => this.isImage(item));
        const audio = matches.filter((item) => this.isAudio(item));
        const other = matches.filter((item) => !this.isImage(item) && !this.isAudio(item));

        if (images.length) {
            const section = this.createSection("Visual Assets", images.length, "visual-assets-section");
            const grid = document.createElement("div");
            grid.className = "asset-visual-grid";
            for (const item of images) grid.appendChild(this.createImageCard(item));
            section.appendChild(grid);
            container.appendChild(section);
        }

        if (audio.length) {
            const section = this.createSection("Audio Assets", audio.length, "audio-assets-section");
            const list = document.createElement("div");
            list.className = "asset-audio-list";
            for (const item of audio) list.appendChild(this.createAudioRow(item));
            section.appendChild(list);
            container.appendChild(section);
        }

        if (other.length) {
            const section = this.createSection("Other Assets", other.length, "other-assets-section");
            const list = document.createElement("div");
            list.className = "asset-file-list";
            for (const item of other) list.appendChild(this.createOtherRow(item));
            section.appendChild(list);
            container.appendChild(section);
        }
    }
};
