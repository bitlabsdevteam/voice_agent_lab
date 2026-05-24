const fs = require("node:fs");
const { loadEnvFile } = require("../dist/src/config/env-file.js");
const { loadRuntimeConfig, toSessionConfig } = require("../dist/src/config/voice-config.js");
const { OpenAIRealtimeProvider } = require("../dist/src/providers/openai-realtime-provider.js");
const { ElevenLabsProvider } = require("../dist/src/providers/elevenlabs-provider.js");

loadEnvFile();

const providerName = process.argv[2];

async function main() {
  if (providerName === "openai") {
    await smokeOpenAI();
    return;
  }

  if (providerName === "elevenlabs") {
    await smokeElevenLabs();
    return;
  }

  throw new Error("Usage: node scripts/live-provider-smoke.cjs <openai|elevenlabs>");
}

async function smokeOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    printSkipped("openai", "OPENAI_API_KEY missing");
    return;
  }

  const config = toSessionConfig(
    loadRuntimeConfig({
      VOICE_AGENT_PROVIDER: "openai",
      VOICE_AGENT_MODEL: process.env.VOICE_AGENT_MODEL || "gpt-realtime-2",
      VOICE_AGENT_VOICE: process.env.VOICE_AGENT_VOICE || "marin",
      VOICE_AGENT_PROMPT_VERSION: process.env.VOICE_AGENT_PROMPT_VERSION || "voice-agent-v1",
      VOICE_AGENT_EPHEMERAL_TTL_SECONDS: "60"
    })
  );
  const session = await new OpenAIRealtimeProvider(process.env.OPENAI_API_KEY).createSession(
    {
      channel: "test",
      tenantId: "tenant_live_smoke",
      userId: "user_live_smoke",
      consentState: "denied"
    },
    config
  );

  assertClientSecret(session.clientSecret);
  printOk("openai", {
    sessionId: session.sessionId,
    modelId: session.config.modelId,
    expiresAt: session.expiresAt
  });
}

async function smokeElevenLabs() {
  if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_AGENT_ID) {
    printSkipped("elevenlabs", "ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID missing");
    return;
  }

  const config = toSessionConfig(
    loadRuntimeConfig({
      VOICE_AGENT_PROVIDER: "elevenlabs",
      VOICE_AGENT_MODEL: process.env.VOICE_AGENT_MODEL || "eleven-v3",
      VOICE_AGENT_VOICE: process.env.VOICE_AGENT_VOICE || "default",
      VOICE_AGENT_PROMPT_VERSION: process.env.VOICE_AGENT_PROMPT_VERSION || "voice-agent-v1",
      VOICE_AGENT_EPHEMERAL_TTL_SECONDS: "60",
      ELEVENLABS_AGENT_ID: process.env.ELEVENLABS_AGENT_ID
    })
  );
  const session = await new ElevenLabsProvider(process.env.ELEVENLABS_API_KEY, process.env.ELEVENLABS_AGENT_ID).createSession(
    {
      channel: "test",
      tenantId: "tenant_live_smoke",
      userId: "user_live_smoke",
      consentState: "denied"
    },
    config
  );

  if (!session.clientSecret.startsWith("wss://")) {
    throw new Error("ElevenLabs signed URL did not return a WebSocket URL");
  }
  printOk("elevenlabs", {
    sessionId: session.sessionId,
    transport: session.config.transport,
    expiresAt: session.expiresAt
  });
}

function assertClientSecret(value) {
  if (!value || value.startsWith("sk-")) {
    throw new Error("Provider returned an unsafe or empty client secret");
  }
}

function printSkipped(provider, reason) {
  const result = { ok: true, skipped: true, provider, reason, checkedAt: new Date().toISOString() };
  writeEvidence(provider, result);
  console.log(JSON.stringify(result, null, 2));
}

function printOk(provider, details) {
  const result = { ok: true, skipped: false, provider, checkedAt: new Date().toISOString(), ...details };
  writeEvidence(provider, result);
  console.log(JSON.stringify(result, null, 2));
}

function writeEvidence(provider, result) {
  fs.mkdirSync("release", { recursive: true });
  fs.writeFileSync(`release/live-smoke-${provider}.json`, `${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  if (providerName === "openai" || providerName === "elevenlabs") {
    writeEvidence(providerName, {
      ok: false,
      skipped: false,
      provider: providerName,
      checkedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    });
  }
  console.error(error);
  process.exitCode = 1;
});
