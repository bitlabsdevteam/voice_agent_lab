import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("ci workflow runs release and local deployment verification gates", () => {
  const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

  assert.equal(workflow.includes("npm run test:release"), true);
  assert.equal(workflow.includes("npm run smoke:local"), true);
  assert.equal(workflow.includes("npm run deploy:verify:local"), true);
  assert.equal(workflow.includes("npm run deploy:check"), true);
});

test("deployment canary workflow verifies remote deployment and live smoke", () => {
  const workflow = readFileSync(".github/workflows/deployment-canary.yml", "utf8");

  assert.equal(workflow.includes("DEPLOYMENT_BASE_URL"), true);
  assert.equal(workflow.includes("npm run deploy:canary:${{ inputs.provider }}"), true);
  assert.equal(workflow.includes("npm run deploy:check:production"), true);
  assert.equal(workflow.includes("workflow_dispatch"), true);
});
