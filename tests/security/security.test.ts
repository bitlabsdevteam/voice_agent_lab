import test from "node:test";
import assert from "node:assert/strict";
import { createTestGateway, testAuth } from "../helpers";

test("cross-tenant connect is denied", async () => {
  const { gateway } = createTestGateway();
  const session = await gateway.createSession(
    { channel: "web", tenantId: testAuth.tenantId, userId: testAuth.userId, consentState: "denied" },
    testAuth
  );

  await assert.rejects(
    () =>
      gateway.connect(session.sessionId, {
        ...testAuth,
        tenantId: "tenant_attacker"
      }),
    /Cross-tenant/
  );
});

test("ephemeral client secret does not expose provider API key shape", async () => {
  const { gateway } = createTestGateway();
  const session = await gateway.createSession(
    { channel: "web", tenantId: testAuth.tenantId, userId: testAuth.userId, consentState: "denied" },
    testAuth
  );

  assert.equal(session.clientSecret.startsWith("sk-"), false);
  assert.equal(session.clientSecret.includes("OPENAI"), false);
});
