/*
 * Copyright (C) 2026 Zygons
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

(() => {
  const allowedThemes = new Set(["original", "scifi", "fantasy"]);
  let theme = "scifi";

  try {
    theme = localStorage.getItem("encounter-ui-theme") || "scifi";
  } catch (_) {
    // Browser storage may be unavailable in hardened/private contexts.
  }

  const normalized = allowedThemes.has(theme) ? theme : "scifi";
  const root = document.body;
  if (!root) return;

  root.classList.add(`theme-${normalized}`);
  root.dataset.uiTheme = normalized;
})();
