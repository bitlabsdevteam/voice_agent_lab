import type { RuntimeConfig } from "../config/voice-config";
import type { SessionStore } from "../session/session-store";
import type { EventSink } from "../contracts/events";

export type ReadinessResult = {
  ok: boolean;
  checks: Array<{
    name: string;
    ok: boolean;
    message: string;
  }>;
};

export function getReadiness(config: RuntimeConfig, store: SessionStore, eventSink?: EventSink): ReadinessResult {
  const checks = [
    {
      name: "session_store",
      ok: store.kind === config.sessionStore,
      message: `configured=${config.sessionStore}; active=${store.kind}`
    },
    {
      name: "event_sink",
      ok: eventSink ? eventSink.kind === config.eventSink : true,
      message: eventSink ? `configured=${config.eventSink}; active=${eventSink.kind}` : "not provided"
    },
    {
      name: "prompt_version",
      ok: config.promptVersion.trim().length > 0,
      message: config.promptVersion
    },
    {
      name: "model",
      ok: config.modelId.trim().length > 0,
      message: config.modelId
    },
    {
      name: "database_url",
      ok: config.sessionStore === "postgres" || config.eventSink === "postgres" ? Boolean(config.databaseUrl) : true,
      message:
        config.sessionStore === "postgres" || config.eventSink === "postgres"
          ? config.databaseUrl
            ? "configured"
            : "DATABASE_URL missing"
          : "not required"
    },
    providerCredentialCheck(config)
  ];

  return {
    ok: checks.every((check) => check.ok),
    checks
  };
}

function providerCredentialCheck(config: RuntimeConfig): ReadinessResult["checks"][number] {
  if (config.provider === "openai") {
    return {
      name: "openai_credentials",
      ok: Boolean(process.env.OPENAI_API_KEY),
      message: process.env.OPENAI_API_KEY ? "server key configured" : "OPENAI_API_KEY missing"
    };
  }

  if (config.provider === "elevenlabs") {
    const ok = Boolean(process.env.ELEVENLABS_API_KEY && config.elevenLabsAgentId);
    return {
      name: "elevenlabs_credentials",
      ok,
      message: ok ? "server key and agent id configured" : "ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID missing"
    };
  }

  return {
    name: "mock_provider",
    ok: true,
    message: config.provider
  };
}
