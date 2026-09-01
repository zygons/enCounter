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
        const allowed = ["image/png", "image/jpeg", "image/webp"];
        if (!allowed.includes(file.type)) throw new Error("Only PNG, JPEG, and WebP images are supported.");
        if (file.size > 10 * 1024 * 1024) throw new Error("The image is larger than 10 MB.");

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

    renderGrid(container, prefix = "") {
        container.innerHTML = "";
        const matches = prefix ? this.byPrefix(prefix) : this.items;
        if (!matches.length) {
            container.innerHTML = '<div class="empty-state">No assets found in this category.</div>';
            return;
        }
        for (const item of matches) {
            const card = document.createElement("article");
            card.className = "asset-card";
            const isImage = /\.(png|jpe?g|webp)$/i.test(item.name);
            if (isImage) {
                const img = document.createElement("img");
                img.src = item.url;
                img.alt = "";
                card.appendChild(img);
            }
            const name = document.createElement("strong");
            name.textContent = item.name;
            const category = document.createElement("small");
            category.textContent = item.category;
            card.append(name, category);
            container.appendChild(card);
        }
    }
};
