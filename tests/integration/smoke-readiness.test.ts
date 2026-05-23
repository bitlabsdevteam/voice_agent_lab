import test from "node:test";
import assert from "node:assert/strict";
import { createAppDependencies } from "../../src/app";

test("smoke dependencies can create, connect, and end a test session", async () => {
  const deps = createAppDependencies();
  const auth = {
    tenantId: "tenant_smoke_test",
    userId: "user_smoke_test",
    scopes: ["voice:session:create", "policy:read"]
  };

  const session = await deps.gateway.createSession(
    {
      channel: "test",
      tenantId: auth.tenantId,
      userId: auth.userId,
      consentState: "denied"
    },
    auth
  );
  await deps.gateway.connect(session.sessionId, auth);
  await deps.gateway.endSession(session.sessionId, auth);

  const eventTypes = deps.eventSink.list().map((event) => event.type);
  assert.equal(eventTypes.includes("session.created"), true);
  assert.equal(eventTypes.includes("session.connected"), true);
  assert.equal(eventTypes.includes("session.ended"), true);
});
