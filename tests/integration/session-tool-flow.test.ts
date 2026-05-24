import test from "node:test";
import assert from "node:assert/strict";
import { lookupPolicyTool } from "../../src/tools/policy-tool";
import { ToolService } from "../../src/tools/tool-service";
import { createTestGateway, testAuth } from "../helpers";

test("creates session, connects, executes read-only tool, and audits events", async () => {
  const { gateway, store, eventSink } = createTestGateway();
  const session = await gateway.createSession(
    { channel: "web", tenantId: testAuth.tenantId, userId: testAuth.userId, consentState: "denied" },
    testAuth
  );
  await gateway.connect(session.sessionId, testAuth);

  const service = new ToolService([lookupPolicyTool], eventSink);
  const result = await service.callTool({
    name: "lookup_policy",
    args: { topic: "privacy" },
    context: {
      sessionId: session.sessionId,
      tenantId: testAuth.tenantId,
      userId: testAuth.userId,
      scopes: testAuth.scopes,
      idempotencyKey: "idem_integration"
    }
  });

  assert.equal(result.ok, true);
  const events = await eventSink.list();
  assert.equal((await store.get(session.sessionId))?.status, "connected");
  assert.ok(events.find((event) => event.type === "session.created"));
  assert.ok(events.find((event) => event.type === "session.connected"));
  assert.ok(events.find((event) => event.type === "tool.call.completed"));
});

test("ending a session persists terminal state and emits event", async () => {
  const { gateway, store, eventSink } = createTestGateway();
  const session = await gateway.createSession(
    { channel: "web", tenantId: testAuth.tenantId, userId: testAuth.userId, consentState: "denied" },
    testAuth
  );

  await gateway.endSession(session.sessionId, testAuth);

  assert.equal((await store.get(session.sessionId))?.status, "ended");
  assert.ok((await eventSink.list()).find((event) => event.type === "session.ended"));
});
