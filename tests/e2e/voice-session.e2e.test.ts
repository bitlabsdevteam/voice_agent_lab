import test from "node:test";
import assert from "node:assert/strict";
import { createTestGateway, testAuth } from "../helpers";

test("web voice session happy path uses client-safe ephemeral credential", async () => {
  const { gateway } = createTestGateway();
  const session = await gateway.createSession(
    { channel: "web", tenantId: testAuth.tenantId, userId: testAuth.userId, consentState: "denied" },
    testAuth
  );

  assert.equal(session.config.transport, "webrtc");
  assert.equal(session.config.modelId, "gpt-realtime-2");
  assert.equal(session.clientSecret.includes("OPENAI_API_KEY"), false);
  assert.equal(session.clientSecret.startsWith("eph_openai_"), true);
});

test("microphone denial maps to transcript-only retention and keeps session creatable", async () => {
  const { gateway, store } = createTestGateway();
  const session = await gateway.createSession(
    { channel: "web", tenantId: testAuth.tenantId, userId: testAuth.userId, consentState: "denied" },
    testAuth
  );

  assert.equal((await store.get(session.sessionId))?.retentionPolicy, "transcript_only");
});
