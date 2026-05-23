import test from "node:test";
import assert from "node:assert/strict";
import { createTestGateway, testAuth } from "../helpers";

test("mock gateway handles concurrent session creation without ID collisions", async () => {
  const { gateway } = createTestGateway();
  const sessions = await Promise.all(
    Array.from({ length: 25 }, () =>
      gateway.createSession(
        { channel: "web", tenantId: testAuth.tenantId, userId: testAuth.userId, consentState: "denied" },
        testAuth
      )
    )
  );

  const ids = new Set(sessions.map((session) => session.sessionId));
  assert.equal(ids.size, sessions.length);
});
