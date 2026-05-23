import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("release manifest script records production-critical version fields", () => {
  const script = readFileSync("scripts/release-manifest.cjs", "utf8");

  assert.equal(script.includes("promptVersion"), true);
  assert.equal(script.includes("modelId"), true);
  assert.equal(script.includes("provider"), true);
  assert.equal(script.includes("sessionStore"), true);
  assert.equal(script.includes("rollback"), true);
  assert.equal(script.includes("releaseGates"), true);
});
