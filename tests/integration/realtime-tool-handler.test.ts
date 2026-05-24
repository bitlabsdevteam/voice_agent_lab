import test from "node:test";
import assert from "node:assert/strict";
import { RealtimeToolHandler } from "../../src/agent/realtime-tool-handler";
import { InMemorySessionStore } from "../../src/session/session-store";
import { InMemoryEventSink } from "../../src/telemetry/in-memory-event-sink";
import { lookupPolicyTool } from "../../src/tools/policy-tool";
import { ToolService } from "../../src/tools/tool-service";
import { testAuth } from "../helpers";

async function createHandler() {
  const store = new InMemorySessionStore();
  const eventSink = new InMemoryEventSink();
  const service = new ToolService([lookupPolicyTool], eventSink);
  await store.save({
    sessionId: "sess_tool_handler",
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
  return { handler: new RealtimeToolHandler(store, service), eventSink };
}

test("server-side realtime tool handler executes approved read-only tool", async () => {
  const { handler, eventSink } = await createHandler();

  const result = await handler.handleToolRequest(
    {
      sessionId: "sess_tool_handler",
      callId: "call_1",
      name: "lookup_policy",
      args: { topic: "returns" }
    },
    testAuth
  );

  assert.equal(result.ok, true);
  assert.equal(result.callId, "call_1");
  assert.equal(result.data?.sourceId, "policy:returns");
  assert.equal((await eventSink.list()).filter((event) => event.type === "tool.call.completed").length, 1);
});

test("server-side realtime tool handler denies cross-tenant access", async () => {
  const { handler } = await createHandler();

  await assert.rejects(
    () =>
      handler.handleToolRequest(
        {
          sessionId: "sess_tool_handler",
          callId: "call_1",
          name: "lookup_policy",
          args: { topic: "returns" }
        },
        { ...testAuth, tenantId: "tenant_other" }
      ),
    /Cross-tenant/
  );
});

test("duplicate realtime tool call id returns cached result without duplicate audit event", async () => {
  const { handler, eventSink } = await createHandler();
  const request = {
    sessionId: "sess_tool_handler",
    callId: "call_duplicate",
    name: "lookup_policy",
    args: { topic: "returns" }
  };

  await handler.handleToolRequest(request, testAuth);
  await handler.handleToolRequest(request, testAuth);

  const events = await eventSink.list();
  assert.equal(events.filter((event) => event.type === "tool.call.requested").length, 1);
  assert.equal(events.filter((event) => event.type === "tool.call.completed").length, 1);
});
