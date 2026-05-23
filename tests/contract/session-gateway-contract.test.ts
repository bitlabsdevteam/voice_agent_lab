import test from "node:test";
import assert from "node:assert/strict";
import { createTestGateway, testAuth } from "../helpers";

test("session gateway rejects missing voice session create scope", async () => {
  const { gateway } = createTestGateway();

  await assert.rejects(
    () =>
      gateway.createSession(
        { channel: "web", tenantId: testAuth.tenantId, userId: testAuth.userId, consentState: "denied" },
        { ...testAuth, scopes: [] }
      ),
    /voice:session:create/
  );
});

test("session gateway rejects cross-tenant session creation", async () => {
  const { gateway } = createTestGateway();

  await assert.rejects(
    () =>
      gateway.createSession(
        { channel: "web", tenantId: "tenant_other", userId: testAuth.userId, consentState: "denied" },
        testAuth
      ),
    /Cross-tenant/
  );
});
