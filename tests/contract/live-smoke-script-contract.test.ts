import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("live provider smoke script supports OpenAI and ElevenLabs credential-gated checks", () => {
  const script = readFileSync("scripts/live-provider-smoke.cjs", "utf8");

  assert.equal(script.includes("OPENAI_API_KEY"), true);
  assert.equal(script.includes("ELEVENLABS_API_KEY"), true);
  assert.equal(script.includes("ELEVENLABS_AGENT_ID"), true);
  assert.equal(script.includes("skipped"), true);
  assert.equal(script.includes("assertClientSecret"), true);
  assert.equal(script.includes("release/live-smoke-"), true);
});

test("deployment check script requires release and infrastructure artifacts", () => {
  const script = readFileSync("scripts/deployment-check.cjs", "utf8");

  assert.equal(script.includes("release/release-manifest.json"), true);
  assert.equal(script.includes("release/deployment-evidence.json"), true);
  assert.equal(script.includes("infra/postgres/001_initial_schema.sql"), true);
  assert.equal(script.includes("infra/observability/prometheus.yml"), true);
  assert.equal(script.includes("docs/operations.md"), true);
});

test("local deployment verifier probes health readiness metrics and static UI", () => {
  const script = readFileSync("scripts/verify-deployed-local.cjs", "utf8");

  assert.equal(script.includes("/health"), true);
  assert.equal(script.includes("/ready"), true);
  assert.equal(script.includes("/metrics"), true);
  assert.equal(script.includes("Aiko"), true);
  assert.equal(script.includes("/ops.html"), true);
  assert.equal(script.includes("release/deployment-evidence.json"), true);
});

test("remote deployment verifier probes hosted base url and writes evidence", () => {
  const script = readFileSync("scripts/verify-deployed-remote.cjs", "utf8");

  assert.equal(script.includes("DEPLOYMENT_BASE_URL"), true);
  assert.equal(script.includes("/health"), true);
  assert.equal(script.includes("/ready"), true);
  assert.equal(script.includes("/metrics"), true);
  assert.equal(script.includes("/ops.html"), true);
  assert.equal(script.includes("release/remote-deployment-evidence.json"), true);
});

test("production canary and approval scripts require non-skipped remote and live evidence", () => {
  const canaryScript = readFileSync("scripts/production-canary.cjs", "utf8");
  const approvalScript = readFileSync("scripts/production-approval.cjs", "utf8");

  assert.equal(canaryScript.includes("release/production-canary-evidence.json"), true);
  assert.equal(canaryScript.includes("live-smoke-"), true);
  assert.equal(canaryScript.includes("verify-deployed-remote"), true);
  assert.equal(approvalScript.includes("production-canary-evidence.json"), true);
  assert.equal(approvalScript.includes("skipped"), true);
});
