/*
 * Copyright (C) 2026 Zygons
 * SPDX-License-Identifier: MIT
 * This file is part of enCounter. See LICENSE for the full license terms.
 */

window.ENC = window.ENC || {};

(function (ENC) {
  "use strict";

  const active = new Map();
  const cuePlayers = new Set();
  let mode = "stopped";
  let resumeSceneAfterCombat = false;
  let soundscape = ENC.createDefaultSoundscape();
  let stateListener = null;

  function emit(reason = "updated") {
    if (typeof stateListener === "function") {
      stateListener({ mode, soundscape: ENC.deepClone(soundscape), reason });
    }
  }

  function effectiveVolume(track, multiplier = 1) {
    return Math.min(
      1,
      Math.max(0, Number(track?.volume || 0) * Number(soundscape.masterVolume || 0) * multiplier),
    );
  }

  function createPlayer(key, track, targetVolume) {
    if (!track?.asset) return null;
    const audio = new Audio(track.asset);
    audio.preload = "auto";
    audio.loop = track.loop !== false;
    audio.volume = 0;
    active.set(key, { audio, track: ENC.deepClone(track), targetVolume });
    return audio;
  }

  function fadeAudio(audio, from, to, durationMs, onDone = null) {
    const duration = Math.max(0, Number(durationMs || 0));
    const start = performance.now();
    audio.volume = Math.min(1, Math.max(0, from));

    if (!duration) {
      audio.volume = Math.min(1, Math.max(0, to));
      onDone?.();
      return;
    }

    const tick = (now) => {
      const ratio = Math.min(1, (now - start) / duration);
      audio.volume = Math.min(1, Math.max(0, from + (to - from) * ratio));
      if (ratio < 1) requestAnimationFrame(tick);
      else onDone?.();
    };
    requestAnimationFrame(tick);
  }

  async function startTrack(key, track, volumeMultiplier = 1, fadeMs = null) {
    if (!track?.asset) return null;
    stopTrack(key, 0);
    const targetVolume = effectiveVolume(track, volumeMultiplier);
    const audio = createPlayer(key, track, targetVolume);
    if (!audio) return null;

    try {
      await audio.play();
      fadeAudio(audio, 0, targetVolume, fadeMs ?? soundscape.fadeMs);
      return audio;
    } catch (error) {
      active.delete(key);
      console.warn("Audio playback could not start:", track.asset, error);
      throw new Error("Audio could not start. Click the audio control again and check the selected output device.");
    }
  }

  function stopTrack(key, fadeMs = null) {
    const entry = active.get(key);
    if (!entry) return;
    active.delete(key);
    const { audio } = entry;
    const finish = () => {
      audio.pause();
      audio.currentTime = 0;
    };
    fadeAudio(audio, audio.volume, 0, fadeMs ?? soundscape.fadeMs, finish);
  }

  function stopGroup(prefix, fadeMs = null) {
    for (const key of [...active.keys()]) {
      if (key.startsWith(prefix)) stopTrack(key, fadeMs);
    }
  }

  function setTrackVolume(key, volume, fadeMs = null) {
    const entry = active.get(key);
    if (!entry) return;
    entry.targetVolume = Math.min(1, Math.max(0, volume));
    fadeAudio(entry.audio, entry.audio.volume, entry.targetVolume, fadeMs ?? soundscape.fadeMs);
  }

  async function playScene() {
    stopGroup("combat:");
    stopGroup("scene:");

    const tasks = [];
    if (soundscape.scene.music?.asset) {
      tasks.push(startTrack("scene:music", soundscape.scene.music));
    }
    soundscape.scene.ambience.forEach((track, index) => {
      if (track.asset) tasks.push(startTrack(`scene:amb:${index}`, track));
    });
    await Promise.allSettled(tasks);
    mode = "scene";
    emit("scene-started");
  }

  async function playCombat() {
    resumeSceneAfterCombat = mode === "scene";
    // Scene music always yields to combat music.
    stopTrack("scene:music");

    soundscape.scene.ambience.forEach((track, index) => {
      const key = `scene:amb:${index}`;
      if (!active.has(key)) return;
      if (track.combatBehavior === "continue") {
        setTrackVolume(key, effectiveVolume(track));
      } else if (track.combatBehavior === "duck") {
        setTrackVolume(key, Math.min(1, Math.max(0, Number(track.combatVolume || 0.15) * soundscape.masterVolume)));
      } else {
        stopTrack(key);
      }
    });

    stopGroup("combat:");
    const tasks = [];
    if (soundscape.combat.music?.asset) {
      tasks.push(startTrack("combat:music", soundscape.combat.music));
    }
    soundscape.combat.ambience.forEach((track, index) => {
      if (track.asset) tasks.push(startTrack(`combat:amb:${index}`, track));
    });
    await Promise.allSettled(tasks);
    mode = "combat";
    emit("combat-started");
  }

  async function returnToScene() {
    stopGroup("combat:");
    if (resumeSceneAfterCombat) {
      await playScene();
    } else {
      stopAll();
    }
    resumeSceneAfterCombat = false;
  }

  function stopAll(fadeMs = null) {
    for (const key of [...active.keys()]) stopTrack(key, fadeMs);
    for (const audio of cuePlayers) {
      audio.pause();
      audio.currentTime = 0;
    }
    cuePlayers.clear();
    mode = "stopped";
    resumeSceneAfterCombat = false;
    emit("stopped");
  }

  async function playCue(cue) {
    const normalized = ENC.normalizeAudioTrack(cue, { name: "Cue", volume: 0.8 });
    if (!normalized.asset) return;
    const audio = new Audio(normalized.asset);
    audio.preload = "auto";
    audio.loop = false;
    audio.volume = effectiveVolume(normalized);
    cuePlayers.add(audio);
    const cleanup = () => cuePlayers.delete(audio);
    audio.addEventListener("ended", cleanup, { once: true });
    try {
      await audio.play();
    } catch (error) {
      cleanup();
      throw new Error("Sound cue could not start.");
    }
  }

  function setSoundscape(next) {
    const wasPlaying = mode;
    soundscape = ENC.normalizeSoundscape(next);
    if (wasPlaying !== "stopped") {
      // Keep current audio stable until DM explicitly restarts/changes mode.
      for (const entry of active.values()) {
        entry.audio.volume = Math.min(1, entry.audio.volume);
      }
    }
    emit("configuration-updated");
  }

  function setMasterVolume(value) {
    soundscape.masterVolume = Math.min(1, Math.max(0, Number(value || 0)));
    for (const [key, entry] of active.entries()) {
      let multiplier = 1;
      if (mode === "combat" && key.startsWith("scene:amb:") && entry.track.combatBehavior === "duck") {
        const index = Number(key.split(":").pop());
        const configured = soundscape.scene.ambience[index];
        const volume = Number(configured?.combatVolume || 0.15) * soundscape.masterVolume;
        setTrackVolume(key, volume, 150);
        continue;
      }
      setTrackVolume(key, effectiveVolume(entry.track, multiplier), 150);
    }
    emit("master-volume");
  }

  ENC.audio = {
    get mode() {
      return mode;
    },
    get soundscape() {
      return ENC.deepClone(soundscape);
    },
    setSoundscape,
    setMasterVolume,
    playScene,
    playCombat,
    returnToScene,
    stopAll,
    playCue,
    onStateChange(listener) {
      stateListener = typeof listener === "function" ? listener : null;
    },
    getState() {
      return { mode, soundscape: ENC.deepClone(soundscape) };
    },
  };
})(window.ENC);
