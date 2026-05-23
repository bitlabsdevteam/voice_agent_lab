import { randomUUID } from "node:crypto";
import type { CreateVoiceSessionInput, CreateVoiceSessionResult, VoiceSessionConfig } from "../contracts/session";
import type { VoiceConnection, VoiceSessionProvider } from "./voice-session-provider";

export class MockElevenLabsProvider implements VoiceSessionProvider {
  readonly name = "mock-elevenlabs";
  private readonly activeSessions = new Set<string>();

  async createSession(input: CreateVoiceSessionInput, config: VoiceSessionConfig): Promise<CreateVoiceSessionResult> {
    const sessionId = `sess_${randomUUID()}`;
    this.activeSessions.add(sessionId);

    return {
      sessionId,
      clientSecret: `signed_elevenlabs_${randomUUID()}`,
      expiresAt: new Date(Date.now() + config.expiresInSeconds * 1000).toISOString(),
      config
    };
  }

  async connect(sessionId: string): Promise<VoiceConnection> {
    if (!this.activeSessions.has(sessionId)) {
      throw new Error("Cannot connect unknown ElevenLabs session");
    }

    return {
      sessionId,
      providerSessionId: `elevenlabs_agent_${sessionId}`,
      events: [
        {
          id: randomUUID(),
          type: "conversation_initiation_metadata",
          payload: { voice: "eleven-v3" }
        }
      ]
    };
  }

  async updateSession(sessionId: string): Promise<void> {
    if (!this.activeSessions.has(sessionId)) {
      throw new Error("Cannot update unknown ElevenLabs session");
    }
  }

  async endSession(sessionId: string): Promise<void> {
    this.activeSessions.delete(sessionId);
  }
}
