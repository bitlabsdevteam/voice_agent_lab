import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { createTestGateway, testAuth } from "../helpers";

test("mock session creation stays under local latency budget", async () => {
  const { gateway } = createTestGateway();
  const start = performance.now();
  await gateway.createSession(
    { channel: "web", tenantId: testAuth.tenantId, userId: testAuth.userId, consentState: "denied" },
    testAuth
  );
  const elapsedMs = performance.now() - start;

  assert.equal(elapsedMs < 100, true);
});
