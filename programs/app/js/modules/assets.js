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
        meta.append(name, category);

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

        row.append(icon, info, audio);
        return row;
    },

    createOtherRow(item) {
        const row = document.createElement("article");
        row.className = "asset-file-row";
        const name = document.createElement("strong");
        name.textContent = item.name;
        const category = document.createElement("span");
        category.textContent = this.categoryLabel(item.category);
        row.append(name, category);
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
