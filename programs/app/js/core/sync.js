/*
 * Copyright (C) 2026 Zygons
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

ENC.sync = {
  channel: null,
  listeners: [],
  usingStorageFallback: false,

  deliver(message) {
    if (!message || typeof message !== "object") return;
    for (const listener of this.listeners) {
      try {
        listener(message);
      } catch (error) {
        console.error("enCounter sync listener failed", error);
      }
    }
  },

  start() {
    if (this.channel || this.usingStorageFallback) return;

    if (typeof BroadcastChannel === "function") {
      try {
        this.channel = new BroadcastChannel(ENC.CHANNEL_NAME);
        this.channel.onmessage = (event) => this.deliver(event.data);
        return;
      } catch (error) {
        console.warn("BroadcastChannel unavailable; using localStorage sync fallback.", error);
      }
    }

    this.usingStorageFallback = true;
    window.addEventListener("storage", (event) => {
      if (event.key !== ENC.SYNC_FALLBACK_KEY || !event.newValue) return;
      try {
        const wrapper = JSON.parse(event.newValue);
        this.deliver(wrapper.message);
      } catch (error) {
        console.warn("Ignored invalid enCounter sync message.", error);
      }
    });
  },

  onMessage(listener) {
    if (typeof listener !== "function") return;
    this.listeners.push(listener);
    this.start();
  },

  broadcast(type, payload = {}) {
    this.start();
    const message = { type, ...payload };

    if (this.channel) {
      this.channel.postMessage(message);
      return;
    }

    if (this.usingStorageFallback) {
      try {
        localStorage.setItem(
          ENC.SYNC_FALLBACK_KEY,
          JSON.stringify({
            id: ENC.makeId("sync"),
            sentAt: Date.now(),
            message,
          }),
        );
      } catch (error) {
        console.warn("Unable to send enCounter sync fallback message.", error);
      }
    }
  },
};

ENC.sync.start();
