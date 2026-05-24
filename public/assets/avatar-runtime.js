(function initAvatarRuntime(globalScope, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
    return;
  }

  globalScope.AvatarRuntime = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function buildAvatarRuntime() {
  "use strict";

  const CONTROL_NAMES = {
    blinkLeft: ["blinkLeft", "blinkleft", "eyeBlinkLeft", "eyeblinkleft", "leftEyeBlink", "lefteyeblink", "eyeLidCloseLeft", "eyelidcloseleft", "blinkL", "blink_l"],
    blinkRight: ["blinkRight", "blinkright", "eyeBlinkRight", "eyeblinkright", "rightEyeBlink", "righteyeblink", "eyeLidCloseRight", "eyelidcloseright", "blinkR", "blink_r"],
    mouthOpen: ["jawOpen", "jawopen", "mouthOpen", "mouthopen", "jawDrop", "jawdrop", "openMouth", "openmouth", "jaw_open", "mouth_open"]
  };

  function clampValue(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeName(value) {
    return String(value || "")
      .replace(/[^a-z0-9]+/gi, "")
      .toLowerCase();
  }

  function traverseNodes(root, visitor) {
    if (!root) {
      return;
    }

    if (typeof root.traverse === "function") {
      root.traverse(visitor);
      return;
    }

    const stack = [root];
    while (stack.length > 0) {
      const node = stack.pop();
      visitor(node);
      if (node && Array.isArray(node.children)) {
        node.children.forEach((child) => {
          stack.push(child);
        });
      }
    }
  }

  function isNamedControl(targetName, aliases) {
    const normalized = normalizeName(targetName);
    return aliases.some((alias) => normalized === normalizeName(alias));
  }

  function visemeKeyForTarget(targetName) {
    const normalized = normalizeName(targetName);
    if (!normalized.startsWith("viseme")) {
      return undefined;
    }
    return targetName;
  }

  function detectFacialControls(root) {
    const controls = {
      blinkLeft: [],
      blinkRight: [],
      mouthOpen: [],
      visemes: {}
    };

    traverseNodes(root, (node) => {
      if (!node || !node.morphTargetDictionary || !Array.isArray(node.morphTargetInfluences)) {
        return;
      }

      Object.entries(node.morphTargetDictionary).forEach(([targetName, index]) => {
        const binding = {
          mesh: node,
          index: Number(index),
          targetName
        };

        if (isNamedControl(targetName, CONTROL_NAMES.blinkLeft)) {
          controls.blinkLeft.push(binding);
          return;
        }

        if (isNamedControl(targetName, CONTROL_NAMES.blinkRight)) {
          controls.blinkRight.push(binding);
          return;
        }

        if (isNamedControl(targetName, CONTROL_NAMES.mouthOpen)) {
          controls.mouthOpen.push(binding);
          return;
        }

        const visemeKey = visemeKeyForTarget(targetName);
        if (visemeKey) {
          controls.visemes[visemeKey] = controls.visemes[visemeKey] || [];
          controls.visemes[visemeKey].push(binding);
        }
      });
    });

    return controls;
  }

  function applyControlValue(bindings, value) {
    if (!bindings) {
      return;
    }

    const targetValue = clampValue(value, 0, 1);
    const items = Array.isArray(bindings) ? bindings : [bindings];
    items.forEach((binding) => {
      if (
        binding &&
        binding.mesh &&
        Array.isArray(binding.mesh.morphTargetInfluences) &&
        typeof binding.index === "number" &&
        binding.index >= 0
      ) {
        binding.mesh.morphTargetInfluences[binding.index] = targetValue;
      }
    });
  }

  function randomBetween(min, max, random) {
    return min + (max - min) * random();
  }

  function createFacialAnimationState(options) {
    const state = {
      reducedMotion: Boolean(options && options.reducedMotion),
      random: (options && options.random) || Math.random,
      mouthPhase: ((options && options.random) || Math.random)() * Math.PI * 2,
      mouthOpen: 0,
      nextBlinkAtMs: 0,
      blinkStartedAtMs: -1,
      blinkDurationMs: 0
    };

    scheduleNextBlink(state, 0);
    return state;
  }

  function scheduleNextBlink(state, nowMs) {
    const minGapMs = state.reducedMotion ? 5200 : 2600;
    const maxGapMs = state.reducedMotion ? 8600 : 4800;
    state.nextBlinkAtMs = nowMs + randomBetween(minGapMs, maxGapMs, state.random);
  }

  function startBlink(state, nowMs) {
    state.blinkStartedAtMs = nowMs;
    state.blinkDurationMs = state.reducedMotion ? 140 : 180;
  }

  function stepBlink(state, nowMs) {
    if (state.blinkStartedAtMs < 0 && nowMs >= state.nextBlinkAtMs) {
      startBlink(state, nowMs);
    }

    if (state.blinkStartedAtMs < 0) {
      return 0;
    }

    const elapsedMs = nowMs - state.blinkStartedAtMs;
    const progress = elapsedMs / Math.max(state.blinkDurationMs, 1);
    if (progress >= 1) {
      state.blinkStartedAtMs = -1;
      scheduleNextBlink(state, nowMs);
      return 0;
    }

    const closeAmount = Math.sin(progress * Math.PI);
    const maxClosure = state.reducedMotion ? 0.72 : 1;
    return closeAmount * maxClosure;
  }

  function visemeWeight(name, phase, mouthOpen) {
    const normalized = normalizeName(name);
    const amplitude = mouthOpen * 0.85;
    if (normalized.includes("aa") || normalized.includes("ah")) {
      return amplitude * ((Math.sin(phase) + 1) / 2);
    }
    if (normalized.includes("ee") || normalized.includes("ih")) {
      return amplitude * ((Math.sin(phase + 2.1) + 1) / 2);
    }
    if (normalized.includes("oh") || normalized.includes("oo")) {
      return amplitude * ((Math.sin(phase + 4.2) + 1) / 2);
    }
    return amplitude * 0.35 * ((Math.sin(phase + 1.1) + 1) / 2);
  }

  function stepFacialAnimation(options) {
    const animationState = options.animationState;
    animationState.reducedMotion = Boolean(options.reducedMotion);

    const deltaSeconds = Math.max(0, Number(options.deltaSeconds) || 0);
    const nowMs = Math.max(0, Number(options.nowMs) || 0);
    const speaking = options.avatarState === "speaking";

    const blink = stepBlink(animationState, nowMs);
    const phaseRate = animationState.reducedMotion ? 7 : 12;
    animationState.mouthPhase += deltaSeconds * phaseRate;

    let targetMouth = 0;
    if (speaking) {
      if (typeof options.speechAmplitude === "number") {
        targetMouth = clampValue(options.speechAmplitude, 0, 1);
      } else {
        const base = animationState.reducedMotion ? 0.12 : 0.2;
        const span = animationState.reducedMotion ? 0.18 : 0.56;
        targetMouth = base + span * ((Math.sin(animationState.mouthPhase) + 1) / 2);
      }
    }

    const smoothing = clampValue(deltaSeconds * (speaking ? 12 : 10), 0, 1);
    animationState.mouthOpen += (targetMouth - animationState.mouthOpen) * smoothing;
    animationState.mouthOpen = clampValue(animationState.mouthOpen, 0, 1);

    const visemes = {};
    (options.visemeNames || []).forEach((name) => {
      visemes[name] = speaking ? visemeWeight(name, animationState.mouthPhase, animationState.mouthOpen) : 0;
    });

    return {
      blinkLeft: blink,
      blinkRight: blink,
      mouthOpen: animationState.mouthOpen,
      visemes
    };
  }

  return {
    applyControlValue,
    clampValue,
    createFacialAnimationState,
    detectFacialControls,
    stepFacialAnimation
  };
});
