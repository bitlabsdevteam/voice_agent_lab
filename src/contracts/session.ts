export type VoiceProviderName = "mock-openai" | "mock-elevenlabs" | "openai" | "elevenlabs";
export type VoiceChannel = "web" | "mobile" | "phone" | "sip" | "test";
export type ConsentState = "not_required" | "requested" | "granted" | "denied";

export type AuthContext = {
  tenantId: string;
  userId: string;
  scopes: string[];
};

export type CreateVoiceSessionInput = {
  channel: VoiceChannel;
  tenantId: string;
  userId: string;
  consentState: ConsentState;
};

export type VoiceSessionConfig = {
  provider: VoiceProviderName;
  modelId: string;
  voiceId: string;
  promptVersion: string;
  transport: "webrtc" | "websocket" | "sip";
  expiresInSeconds: number;
};

export type CreateVoiceSessionResult = {
  sessionId: string;
  clientSecret: string;
  expiresAt: string;
  config: VoiceSessionConfig;
};

export type StoredVoiceSession = {
  sessionId: string;
  tenantId: string;
  userId: string;
  channel: VoiceChannel;
  provider: VoiceProviderName;
  modelId: string;
  voiceId: string;
  promptVersion: string;
  startedAt: string;
  endedAt?: string;
  consentState: ConsentState;
  retentionPolicy: "transcript_only" | "audio_allowed" | "ephemeral";
  status: "created" | "connected" | "ended" | "failed";
  failureReason?: string;
};
