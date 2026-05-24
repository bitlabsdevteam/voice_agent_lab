import test from "node:test";
import assert from "node:assert/strict";
import { loadRuntimeConfig, OPENAI_REALTIME_MODEL, toSessionConfig } from "../../src/config/voice-config";

test("loads OpenAI realtime defaults", () => {
  const config = loadRuntimeConfig({});
  assert.equal(config.provider, "mock-openai");
  assert.equal(config.modelId, OPENAI_REALTIME_MODEL);
  assert.equal(config.promptVersion, "voice-agent-v1");
});

test("converts runtime config into client-safe session config", () => {
  const config = toSessionConfig(loadRuntimeConfig({ VOICE_AGENT_EPHEMERAL_TTL_SECONDS: "120" }));
  assert.equal(config.modelId, "gpt-realtime-2");
  assert.equal(config.transport, "webrtc");
  assert.equal(config.expiresInSeconds, 120);
});

test("loads postgres persistence config", () => {
  const config = loadRuntimeConfig({
    VOICE_AGENT_SESSION_STORE: "postgres",
    VOICE_AGENT_EVENT_SINK: "postgres",
    DATABASE_URL: "postgres://example"
  });

  assert.equal(config.sessionStore, "postgres");
  assert.equal(config.eventSink, "postgres");
  assert.equal(config.databaseUrl, "postgres://example");
});
