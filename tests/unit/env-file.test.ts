import test from "node:test";
import assert from "node:assert/strict";
import { unlinkSync, writeFileSync } from "node:fs";
import { loadEnvFile, resetEnvFileStateForTests } from "../../src/config/env-file";

test("env file loader hydrates missing variables without overriding existing ones", () => {
  const path = ".env.test-loader";
  const previousOpenAIKey = process.env.OPENAI_API_KEY;
  const previousProvider = process.env.VOICE_AGENT_PROVIDER;
  const previousVoice = process.env.VOICE_AGENT_VOICE;

  writeFileSync(
    path,
    [
      "OPENAI_API_KEY=test-openai-key",
      "VOICE_AGENT_PROVIDER=openai",
      "VOICE_AGENT_VOICE=\"marin\""
    ].join("\n")
  );

  process.env.OPENAI_API_KEY = "";
  process.env.VOICE_AGENT_PROVIDER = "mock-openai";
  delete process.env.VOICE_AGENT_VOICE;

  resetEnvFileStateForTests();
  loadEnvFile(path);

  assert.equal(process.env.OPENAI_API_KEY, "");
  assert.equal(process.env.VOICE_AGENT_PROVIDER, "mock-openai");
  assert.equal(process.env.VOICE_AGENT_VOICE, "marin");

  unlinkSync(path);
  process.env.OPENAI_API_KEY = previousOpenAIKey;
  process.env.VOICE_AGENT_PROVIDER = previousProvider;
  process.env.VOICE_AGENT_VOICE = previousVoice;
});
