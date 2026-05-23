import { loadRuntimeConfig } from "../src/config/voice-config";
import type { AuthContext } from "../src/contracts/session";
import { createVoiceProvider } from "../src/providers/provider-factory";
import { SessionGateway } from "../src/session/session-gateway";
import { InMemorySessionStore } from "../src/session/session-store";
import { InMemoryEventSink } from "../src/telemetry/in-memory-event-sink";

export function createTestGateway() {
  const config = loadRuntimeConfig({
    VOICE_AGENT_PROVIDER: "mock-openai",
    VOICE_AGENT_MODEL: "gpt-realtime-2",
    VOICE_AGENT_PROMPT_VERSION: "voice-agent-v1",
    VOICE_AGENT_EPHEMERAL_TTL_SECONDS: "300"
  });
  const provider = createVoiceProvider(config.provider);
  const store = new InMemorySessionStore();
  const eventSink = new InMemoryEventSink();
  const gateway = new SessionGateway(provider, store, eventSink, config);

  return { gateway, store, eventSink, config };
}

export const testAuth: AuthContext = {
  tenantId: "tenant_test",
  userId: "user_test",
  scopes: ["voice:session:create", "policy:read"]
};
