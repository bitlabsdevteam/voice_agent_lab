import test from "node:test";
import assert from "node:assert/strict";
import { createAppDependencies } from "../../src/app";
import { loadRuntimeConfig } from "../../src/config/voice-config";

function createMockDependencies() {
  return createAppDependencies({
    config: loadRuntimeConfig({
      VOICE_AGENT_PROVIDER: "mock-openai",
      VOICE_AGENT_SESSION_STORE: "memory",
      VOICE_AGENT_EVENT_SINK: "memory",
      VOICE_AGENT_DATA_DIR: ".voice-agent-data/test-smoke-readiness"
    })
  });
}

test("smoke dependencies can create, connect, and end a test session", async () => {
  const deps = createMockDependencies();
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

  const eventTypes = (await deps.eventSink.list()).map((event) => event.type);
  assert.equal(eventTypes.includes("session.created"), true);
  assert.equal(eventTypes.includes("session.connected"), true);
  assert.equal(eventTypes.includes("session.ended"), true);
});

test("metrics endpoint dependencies expose counters after session activity", async () => {
  const deps = createMockDependencies();
  const auth = {
    tenantId: "tenant_metrics_test",
    userId: "user_metrics_test",
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

  const events = await deps.eventSink.list();
  assert.equal(events.filter((event) => event.type === "session.created").length, 1);
  assert.equal(events.filter((event) => event.type === "session.connected").length, 1);
});
