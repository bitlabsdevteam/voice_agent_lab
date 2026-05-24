import test from "node:test";
import assert from "node:assert/strict";
import { HandoffService } from "../../src/handoff/handoff-service";
import { InMemorySessionStore } from "../../src/session/session-store";
import { InMemoryEventSink } from "../../src/telemetry/in-memory-event-sink";
import { testAuth } from "../helpers";

async function setup() {
  const store = new InMemorySessionStore();
  const eventSink = new InMemoryEventSink();
  await store.save({
    sessionId: "sess_handoff",
    tenantId: testAuth.tenantId,
    userId: testAuth.userId,
    channel: "web",
    provider: "mock-openai",
    modelId: "gpt-realtime-2",
    voiceId: "marin",
    promptVersion: "voice-agent-v1",
    startedAt: new Date().toISOString(),
    consentState: "denied",
    retentionPolicy: "transcript_only",
    status: "connected"
  });
  await eventSink.emit({
    eventId: "tool_event",
    type: "tool.call.completed",
    sessionId: "sess_handoff",
    tenantId: testAuth.tenantId,
    occurredAt: new Date().toISOString(),
    payload: { toolName: "lookup_policy", ok: true }
  });
  return { store, eventSink };
}

test("handoff service creates packet with summary, tool actions, and event marker", async () => {
  const { store, eventSink } = await setup();
  const service = new HandoffService(store, eventSink);

  const packet = await service.requestHandoff(
    {
      sessionId: "sess_handoff",
      reason: "user_requested",
      summary: "User asked for a human specialist.",
      verifiedIdentity: false,
      openQuestions: ["What account should the specialist inspect?"],
      riskFlags: ["user_requested"]
    },
    testAuth
  );

  assert.equal(packet.reason, "user_requested");
  assert.equal(packet.toolActions.length, 1);
  assert.equal(packet.transcriptExcerpt.length > 0, true);
  assert.equal((await eventSink.list()).some((event) => event.type === "handoff.requested"), true);
});

test("handoff service denies cross-tenant packet access", async () => {
  const { store, eventSink } = await setup();
  const service = new HandoffService(store, eventSink);

  await assert.rejects(
    () =>
      service.requestHandoff(
        {
          sessionId: "sess_handoff",
          reason: "user_requested",
          summary: "User asked for a human specialist.",
          verifiedIdentity: false
        },
        { ...testAuth, tenantId: "tenant_other" }
      ),
    /Cross-tenant/
  );
});
