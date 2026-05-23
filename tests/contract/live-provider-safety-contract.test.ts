import test from "node:test";
import assert from "node:assert/strict";
import { loadRuntimeConfig, toSessionConfig } from "../../src/config/voice-config";
import { ElevenLabsProvider } from "../../src/providers/elevenlabs-provider";
import { OpenAIRealtimeProvider } from "../../src/providers/openai-realtime-provider";

test("live OpenAI provider refuses to run without server-side API key", async () => {
  const provider = new OpenAIRealtimeProvider(undefined);
  const config = toSessionConfig(loadRuntimeConfig({ VOICE_AGENT_PROVIDER: "openai" }));

  await assert.rejects(
    () =>
      provider.createSession(
        { channel: "web", tenantId: "tenant", userId: "user", consentState: "denied" },
        config
      ),
    /OPENAI_API_KEY/
  );
});

test("live OpenAI provider requests client secret with configured realtime session", async () => {
  let capturedUrl = "";
  let capturedBody = "";
  const provider = new OpenAIRealtimeProvider("server_key", "https://api.openai.test/v1", async (url, init) => {
    capturedUrl = url;
    capturedBody = init?.body ?? "";
    return {
      ok: true,
      status: 200,
      async text() {
        return "";
      },
      async json() {
        return {
          id: "sess_live_test",
          client_secret: {
            value: "ek_test",
            expires_at: 2000000000
          }
        };
      }
    };
  });
  const config = toSessionConfig(
    loadRuntimeConfig({
      VOICE_AGENT_PROVIDER: "openai",
      VOICE_AGENT_MODEL: "gpt-realtime-2",
      VOICE_AGENT_EPHEMERAL_TTL_SECONDS: "300"
    })
  );

  const session = await provider.createSession(
    { channel: "web", tenantId: "tenant", userId: "user", consentState: "denied" },
    config
  );
  const body = JSON.parse(capturedBody) as {
    expires_after: { anchor: string; seconds: number };
    session: { type: string; model: string; audio: { output: { voice: string } } };
  };

  assert.equal(capturedUrl, "https://api.openai.test/v1/realtime/client_secrets");
  assert.equal(body.expires_after.anchor, "created_at");
  assert.equal(body.expires_after.seconds, 300);
  assert.equal(body.session.type, "realtime");
  assert.equal(body.session.model, "gpt-realtime-2");
  assert.equal(session.clientSecret, "ek_test");
});

test("live ElevenLabs provider refuses to run without server-side API key", async () => {
  const provider = new ElevenLabsProvider(undefined);
  const config = toSessionConfig(loadRuntimeConfig({ VOICE_AGENT_PROVIDER: "elevenlabs" }));

  await assert.rejects(
    () =>
      provider.createSession(
        { channel: "web", tenantId: "tenant", userId: "user", consentState: "denied" },
        config
      ),
    /ELEVENLABS_API_KEY/
  );
});

test("live ElevenLabs provider requests signed URL with configured agent id", async () => {
  let capturedUrl = "";
  let capturedKey = "";
  const provider = new ElevenLabsProvider("eleven_key", "agent_123", "https://api.elevenlabs.test/v1", async (url, init) => {
    capturedUrl = url;
    capturedKey = init?.headers?.["xi-api-key"] ?? "";
    return {
      ok: true,
      status: 200,
      async text() {
        return "";
      },
      async json() {
        return {
          signed_url: "wss://api.elevenlabs.test/v1/convai/conversation?token=signed",
          conversation_id: "conv_123"
        };
      }
    };
  });
  const config = toSessionConfig(loadRuntimeConfig({ VOICE_AGENT_PROVIDER: "elevenlabs" }));

  const session = await provider.createSession(
    { channel: "web", tenantId: "tenant", userId: "user", consentState: "denied" },
    config
  );

  assert.equal(
    capturedUrl,
    "https://api.elevenlabs.test/v1/convai/conversation/get-signed-url?agent_id=agent_123&include_conversation_id=true"
  );
  assert.equal(capturedKey, "eleven_key");
  assert.equal(session.sessionId, "conv_123");
  assert.equal(session.clientSecret.startsWith("wss://"), true);
  assert.equal(session.config.transport, "websocket");
});
