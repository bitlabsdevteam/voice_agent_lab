import test from "node:test";
import assert from "node:assert/strict";
import { loadRuntimeConfig } from "../../src/config/voice-config";
import { getReadiness } from "../../src/health/readiness";
import { InMemorySessionStore } from "../../src/session/session-store";
import { InMemoryEventSink } from "../../src/telemetry/in-memory-event-sink";

test("readiness passes for mock provider with matching memory store", () => {
  const config = loadRuntimeConfig({ VOICE_AGENT_PROVIDER: "mock-openai", VOICE_AGENT_SESSION_STORE: "memory" });
  const readiness = getReadiness(config, new InMemorySessionStore(), new InMemoryEventSink());

  assert.equal(readiness.ok, true);
});

test("readiness fails for live OpenAI provider without server key", () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "";
  const config = loadRuntimeConfig({ VOICE_AGENT_PROVIDER: "openai", VOICE_AGENT_SESSION_STORE: "memory" });
  const readiness = getReadiness(config, new InMemorySessionStore(), new InMemoryEventSink());
  process.env.OPENAI_API_KEY = previous;

  assert.equal(readiness.ok, false);
  assert.equal(readiness.checks.find((check) => check.name === "openai_credentials")?.ok, false);
});

test("readiness fails when configured event sink does not match active event sink", () => {
  const config = loadRuntimeConfig({ VOICE_AGENT_PROVIDER: "mock-openai", VOICE_AGENT_EVENT_SINK: "file" });
  const readiness = getReadiness(config, new InMemorySessionStore(), new InMemoryEventSink());

  assert.equal(readiness.ok, false);
  assert.equal(readiness.checks.find((check) => check.name === "event_sink")?.ok, false);
});

test("readiness fails when postgres persistence is selected without database url", () => {
  const config = loadRuntimeConfig({ VOICE_AGENT_SESSION_STORE: "postgres", VOICE_AGENT_EVENT_SINK: "postgres" });
  const readiness = getReadiness(config, new InMemorySessionStore(), new InMemoryEventSink());

  assert.equal(readiness.ok, false);
  assert.equal(readiness.checks.find((check) => check.name === "database_url")?.ok, false);
});
