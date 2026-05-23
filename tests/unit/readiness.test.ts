import test from "node:test";
import assert from "node:assert/strict";
import { loadRuntimeConfig } from "../../src/config/voice-config";
import { getReadiness } from "../../src/health/readiness";
import { InMemorySessionStore } from "../../src/session/session-store";

test("readiness passes for mock provider with matching memory store", () => {
  const config = loadRuntimeConfig({ VOICE_AGENT_PROVIDER: "mock-openai", VOICE_AGENT_SESSION_STORE: "memory" });
  const readiness = getReadiness(config, new InMemorySessionStore());

  assert.equal(readiness.ok, true);
});

test("readiness fails for live OpenAI provider without server key", () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "";
  const config = loadRuntimeConfig({ VOICE_AGENT_PROVIDER: "openai", VOICE_AGENT_SESSION_STORE: "memory" });
  const readiness = getReadiness(config, new InMemorySessionStore());
  process.env.OPENAI_API_KEY = previous;

  assert.equal(readiness.ok, false);
  assert.equal(readiness.checks.find((check) => check.name === "openai_credentials")?.ok, false);
});
