import type { VoiceProviderName } from "../contracts/session";
import { ElevenLabsProvider } from "./elevenlabs-provider";
import { MockElevenLabsProvider } from "./mock-elevenlabs-provider";
import { MockOpenAIRealtimeProvider } from "./mock-openai-realtime-provider";
import { OpenAIRealtimeProvider } from "./openai-realtime-provider";
import type { VoiceSessionProvider } from "./voice-session-provider";

export function createVoiceProvider(name: VoiceProviderName): VoiceSessionProvider {
  if (name === "mock-openai") {
    return new MockOpenAIRealtimeProvider();
  }

  if (name === "openai") {
    return new OpenAIRealtimeProvider();
  }

  if (name === "mock-elevenlabs") {
    return new MockElevenLabsProvider();
  }

  if (name === "elevenlabs") {
    return new ElevenLabsProvider();
  }

  const unreachable: never = name;
  throw new Error(`Unsupported provider: ${unreachable}`);
}
