import test from "node:test";
import assert from "node:assert/strict";
import { toSessionConfig, loadRuntimeConfig } from "../../src/config/voice-config";
import { MockElevenLabsProvider } from "../../src/providers/mock-elevenlabs-provider";
import { MockOpenAIRealtimeProvider } from "../../src/providers/mock-openai-realtime-provider";

test("mock OpenAI provider returns ephemeral credential and realtime connection event", async () => {
  const provider = new MockOpenAIRealtimeProvider();
  const config = toSessionConfig(loadRuntimeConfig({ VOICE_AGENT_PROVIDER: "mock-openai" }));
  const session = await provider.createSession(
    { channel: "web", tenantId: "tenant", userId: "user", consentState: "denied" },
    config
  );
  const connection = await provider.connect(session.sessionId);

  assert.equal(session.config.modelId, "gpt-realtime-2");
  assert.equal(session.clientSecret.startsWith("eph_openai_"), true);
  assert.equal(connection.events[0].type, "session.created");
});

test("mock ElevenLabs provider returns signed credential and agent event", async () => {
  const provider = new MockElevenLabsProvider();
  const config = toSessionConfig(loadRuntimeConfig({ VOICE_AGENT_PROVIDER: "mock-elevenlabs" }));
  const session = await provider.createSession(
    { channel: "web", tenantId: "tenant", userId: "user", consentState: "denied" },
    config
  );
  const connection = await provider.connect(session.sessionId);

  assert.equal(session.clientSecret.startsWith("signed_elevenlabs_"), true);
  assert.equal(connection.events[0].type, "conversation_initiation_metadata");
});
