import { randomUUID } from "node:crypto";
import type { CreateVoiceSessionInput, CreateVoiceSessionResult, VoiceSessionConfig } from "../contracts/session";
import type { VoiceConnection, VoiceSessionProvider } from "./voice-session-provider";

export class MockOpenAIRealtimeProvider implements VoiceSessionProvider {
  readonly name = "mock-openai";
  private readonly activeSessions = new Set<string>();

  async createSession(input: CreateVoiceSessionInput, config: VoiceSessionConfig): Promise<CreateVoiceSessionResult> {
    const sessionId = `sess_${randomUUID()}`;
    this.activeSessions.add(sessionId);

    return {
      sessionId,
      clientSecret: `eph_openai_${randomUUID()}`,
      expiresAt: new Date(Date.now() + config.expiresInSeconds * 1000).toISOString(),
      config
    };
  }

  async connect(sessionId: string): Promise<VoiceConnection> {
    if (!this.activeSessions.has(sessionId)) {
      throw new Error("Cannot connect unknown OpenAI realtime session");
    }

    return {
      sessionId,
      providerSessionId: `openai_realtime_${sessionId}`,
      events: [
        {
          id: randomUUID(),
          type: "session.created",
          payload: { model: "gpt-realtime-2" }
        }
      ]
    };
  }

  async updateSession(sessionId: string): Promise<void> {
    if (!this.activeSessions.has(sessionId)) {
      throw new Error("Cannot update unknown OpenAI realtime session");
    }
  }

  async endSession(sessionId: string): Promise<void> {
    this.activeSessions.delete(sessionId);
  }
}
