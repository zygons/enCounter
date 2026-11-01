/*
 * Copyright (C) 2026 Zygons
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

ENC.dmWorkspace = {
  currentPage: "characters",

  normalizeCharacterType(value) {
    if (value === "player" || value === "npc" || value === "enemy-creature") {
      return value;
    }
    if (value === "enemy" || value === "creature") return "enemy-creature";
    return "all";
  },

  showPage(page = "characters") {
    const target = String(page || "characters");
    const panel = document.querySelector(`[data-dm-page-panel="${target}"]`);
    if (!panel) return false;

    this.currentPage = target;

    for (const button of document.querySelectorAll(".dm-nav-button")) {
      button.classList.toggle("active", button.dataset.dmPage === target);
    }

    for (const item of document.querySelectorAll(".dm-page")) {
      item.classList.toggle(
        "active-dm-page",
        item.dataset.dmPagePanel === target,
      );
    }

    return true;
  },

  setCharacterType(value = "all") {
    const filter = this.normalizeCharacterType(value);
    const select = document.getElementById("libraryTypeFilter");
    if (select) select.value = filter;

    for (const button of document.querySelectorAll("[data-library-type]")) {
      button.classList.toggle("active", button.dataset.libraryType === filter);
    }

    ENC.libraryUI?.render?.();
  },

  setAssetFilter(value = "") {
    const filter = String(value ?? "");
    const select = document.getElementById("assetFilter");
    if (select) {
      select.value = filter;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }

    for (const button of document.querySelectorAll("[data-asset-filter]")) {
      button.classList.toggle("active", button.dataset.assetFilter === filter);
    }
  },

  open(page = "characters", options = {}) {
    const dmButton = document.querySelector('[data-section="dmSection"]');
    if (dmButton && !dmButton.classList.contains("active")) {
      dmButton.click();
    }

    this.showPage(page);

    if (page === "characters" && options.characterType !== undefined) {
      this.setCharacterType(options.characterType);
    }

    if (page === "assets" && options.assetFilter !== undefined) {
      this.setAssetFilter(options.assetFilter);
    }

    window.scrollTo({ top: 0, behavior: options.instant ? "auto" : "smooth" });
  },

  bind() {
    for (const button of document.querySelectorAll(".dm-nav-button")) {
      button.addEventListener("click", () => this.showPage(button.dataset.dmPage));
    }

    for (const button of document.querySelectorAll("[data-library-type]")) {
      button.addEventListener("click", () => {
        this.setCharacterType(button.dataset.libraryType);
      });
    }

    for (const button of document.querySelectorAll("[data-asset-filter]")) {
      button.addEventListener("click", () => {
        this.setAssetFilter(button.dataset.assetFilter || "");
      });
    }

    document
      .getElementById("openDmEncountersBtn")
      ?.addEventListener("click", () => this.open("encounters"));

    document
      .getElementById("openDmCharactersBtn")
      ?.addEventListener("click", () => this.open("characters"));

    document
      .getElementById("openDmCompendiumBtn")
      ?.addEventListener("click", () => this.open("compendium"));
  },

  initialize() {
    this.bind();
    this.showPage(this.currentPage);
    this.setCharacterType(document.getElementById("libraryTypeFilter")?.value || "all");
    this.setAssetFilter(document.getElementById("assetFilter")?.value || "");
  },
};
