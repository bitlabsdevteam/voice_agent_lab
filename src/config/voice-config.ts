import type { VoiceProviderName, VoiceSessionConfig } from "../contracts/session";
import { loadEnvFile } from "./env-file";

export const OPENAI_REALTIME_MODEL = "gpt-realtime-2";
export const DEFAULT_PROMPT_VERSION = "voice-agent-v1";

export type RuntimeConfig = {
  provider: VoiceProviderName;
  modelId: string;
  voiceId: string;
  promptVersion: string;
  ephemeralTtlSeconds: number;
  sessionStore: "memory" | "file" | "postgres";
  eventSink: "memory" | "file" | "postgres";
  dataDir: string;
  databaseUrl?: string;
  elevenLabsAgentId?: string;
  transcriptRetentionDays: number;
};

export function loadRuntimeConfig(env: Record<string, string | undefined> = process.env): RuntimeConfig {
  if (env === process.env) {
    loadEnvFile();
  }

  return {
    provider: parseProvider(env.VOICE_AGENT_PROVIDER ?? "mock-openai"),
    modelId: env.VOICE_AGENT_MODEL ?? OPENAI_REALTIME_MODEL,
    voiceId: env.VOICE_AGENT_VOICE ?? "marin",
    promptVersion: env.VOICE_AGENT_PROMPT_VERSION ?? DEFAULT_PROMPT_VERSION,
    ephemeralTtlSeconds: Number(env.VOICE_AGENT_EPHEMERAL_TTL_SECONDS ?? "300"),
    sessionStore: parseSessionStore(env.VOICE_AGENT_SESSION_STORE ?? "memory"),
    eventSink: parseEventSink(env.VOICE_AGENT_EVENT_SINK ?? "memory"),
    dataDir: env.VOICE_AGENT_DATA_DIR ?? ".voice-agent-data",
    databaseUrl: env.DATABASE_URL,
    elevenLabsAgentId: env.ELEVENLABS_AGENT_ID,
    transcriptRetentionDays: Number(env.VOICE_AGENT_TRANSCRIPT_RETENTION_DAYS ?? "30")
  };
}

export function toSessionConfig(config: RuntimeConfig): VoiceSessionConfig {
  return {
    provider: config.provider,
    modelId: config.modelId,
    voiceId: config.voiceId,
    promptVersion: config.promptVersion,
    transport: config.provider === "elevenlabs" || config.provider === "mock-elevenlabs" ? "websocket" : "webrtc",
    expiresInSeconds: config.ephemeralTtlSeconds
  };
}

function parseProvider(value: string): VoiceProviderName {
  if (value === "mock-openai" || value === "mock-elevenlabs" || value === "openai" || value === "elevenlabs") {
    return value;
  }

  throw new Error(`Unsupported voice provider: ${value}`);
}

function parseSessionStore(value: string): "memory" | "file" | "postgres" {
  if (value === "memory" || value === "file" || value === "postgres") {
    return value;
  }

  throw new Error(`Unsupported session store: ${value}`);
}

function parseEventSink(value: string): "memory" | "file" | "postgres" {
  if (value === "memory" || value === "file" || value === "postgres") {
    return value;
  }

  throw new Error(`Unsupported event sink: ${value}`);
}
