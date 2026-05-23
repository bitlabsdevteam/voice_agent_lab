import type { CreateVoiceSessionInput, CreateVoiceSessionResult, VoiceSessionConfig } from "../contracts/session";

export type ProviderRealtimeEvent = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
};

export type VoiceConnection = {
  sessionId: string;
  providerSessionId: string;
  events: ProviderRealtimeEvent[];
};

export interface VoiceSessionProvider {
  readonly name: string;
  createSession(input: CreateVoiceSessionInput, config: VoiceSessionConfig): Promise<CreateVoiceSessionResult>;
  connect(sessionId: string): Promise<VoiceConnection>;
  updateSession(sessionId: string, patch: Partial<VoiceSessionConfig>): Promise<void>;
  endSession(sessionId: string): Promise<void>;
}
