import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

const runtime = require(join(process.cwd(), "public", "assets", "avatar-runtime.js")) as {
  applyControlValue: (bindings: Array<{ mesh: { morphTargetInfluences: number[] }; index: number }> | undefined, value: number) => void;
  createFacialAnimationState: (options?: { random?: () => number; reducedMotion?: boolean }) => {
    mouthOpen: number;
    nextBlinkAtMs: number;
  };
  detectFacialControls: (root: unknown) => {
    blinkLeft: Array<{ index: number }>;
    blinkRight: Array<{ index: number }>;
    mouthOpen: Array<{ index: number }>;
    visemes: Record<string, Array<{ index: number }>>;
  };
  stepFacialAnimation: (options: {
    animationState: unknown;
    avatarState: string;
    deltaSeconds: number;
    nowMs: number;
    reducedMotion: boolean;
    speechAmplitude?: number;
    visemeNames?: string[];
  }) => {
    blinkLeft: number;
    blinkRight: number;
    mouthOpen: number;
    visemes: Record<string, number>;
  };
};

test("detects blink, mouth, and viseme morph targets from a dropped avatar", () => {
  const mesh = {
    morphTargetDictionary: {
      blinkLeft: 0,
      blinkRight: 1,
      jawOpen: 2,
      viseme_aa: 3,
      viseme_oh: 4
    },
    morphTargetInfluences: [0, 0, 0, 0, 0]
  };

  const controls = runtime.detectFacialControls({
    traverse(visitor: (node: unknown) => void) {
      visitor(mesh);
    }
  });

  assert.equal(controls.blinkLeft.length, 1);
  assert.equal(controls.blinkRight.length, 1);
  assert.equal(controls.mouthOpen.length, 1);
  assert.deepEqual(Object.keys(controls.visemes).sort(), ["viseme_aa", "viseme_oh"]);
});

test("returns an empty facial-control contract when a model has no morph targets", () => {
  const controls = runtime.detectFacialControls({
    traverse(visitor: (node: unknown) => void) {
      visitor({ name: "plain-mesh" });
    }
  });

  assert.deepEqual(controls, {
    blinkLeft: [],
    blinkRight: [],
    mouthOpen: [],
    visemes: {}
  });
});

test("applies morph target values through the shared facial-control bindings", () => {
  const mesh = {
    morphTargetInfluences: [0, 0, 0]
  };

  runtime.applyControlValue([{ mesh, index: 2 }], 0.64);
  assert.equal(mesh.morphTargetInfluences[2], 0.64);
});

test("speaking animation drives mouth motion and keeps blink timers active", () => {
  const animationState = runtime.createFacialAnimationState({
    random: () => 0,
    reducedMotion: false
  });

  runtime.stepFacialAnimation({
    animationState,
    avatarState: "speaking",
    deltaSeconds: 0.016,
    nowMs: 2600,
    reducedMotion: false,
    visemeNames: ["viseme_aa"]
  });

  const blinkFrame = runtime.stepFacialAnimation({
    animationState,
    avatarState: "speaking",
    deltaSeconds: 0.016,
    nowMs: 2690,
    reducedMotion: false,
    visemeNames: ["viseme_aa"]
  });

  assert.ok(blinkFrame.mouthOpen > 0);
  assert.ok(blinkFrame.blinkLeft > 0);
  assert.ok(blinkFrame.visemes.viseme_aa > 0);

  const settledFrame = runtime.stepFacialAnimation({
    animationState,
    avatarState: "listening",
    deltaSeconds: 0.25,
    nowMs: 3200,
    reducedMotion: false,
    visemeNames: ["viseme_aa"]
  });

  assert.equal(settledFrame.visemes.viseme_aa, 0);
  assert.ok(settledFrame.mouthOpen < blinkFrame.mouthOpen);
});

test("reduced-motion speaking animation keeps mouth motion restrained", () => {
  const animationState = runtime.createFacialAnimationState({
    random: () => 0.5,
    reducedMotion: true
  });

  const frame = runtime.stepFacialAnimation({
    animationState,
    avatarState: "speaking",
    deltaSeconds: 0.2,
    nowMs: 1000,
    reducedMotion: true
  });

  assert.ok(frame.mouthOpen < 0.35);
  assert.ok(frame.blinkLeft <= 0.72);
});
