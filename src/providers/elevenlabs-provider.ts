import type { CreateVoiceSessionInput, CreateVoiceSessionResult, VoiceSessionConfig } from "../contracts/session";
import type { VoiceConnection, VoiceSessionProvider } from "./voice-session-provider";

type ElevenLabsSignedUrlResponse = {
  signed_url?: string;
  conversation_id?: string;
};

type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
  }
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

export class ElevenLabsProvider implements VoiceSessionProvider {
  readonly name = "elevenlabs";

  constructor(
    private readonly apiKey: string | undefined = process.env.ELEVENLABS_API_KEY,
    private readonly agentId: string | undefined = process.env.ELEVENLABS_AGENT_ID,
    private readonly baseUrl = "https://api.elevenlabs.io/v1",
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  async createSession(input: CreateVoiceSessionInput, config: VoiceSessionConfig): Promise<CreateVoiceSessionResult> {
    if (!this.apiKey) {
      throw new Error("ELEVENLABS_API_KEY is required when VOICE_AGENT_PROVIDER=elevenlabs");
    }
    if (!this.agentId) {
      throw new Error("ELEVENLABS_AGENT_ID is required when VOICE_AGENT_PROVIDER=elevenlabs");
    }

    const url = `${this.baseUrl}/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(
      this.agentId
    )}&include_conversation_id=true`;
    const response = await this.fetchImpl(url, {
      method: "GET",
      headers: {
        "xi-api-key": this.apiKey
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ElevenLabs signed URL request failed with ${response.status}: ${text}`);
    }

    const data = (await response.json()) as ElevenLabsSignedUrlResponse;
    if (!data.signed_url) {
      throw new Error("ElevenLabs signed URL response did not include signed_url");
    }

    return {
      sessionId: data.conversation_id ?? `elevenlabs_pending_${Date.now()}`,
      clientSecret: data.signed_url,
      expiresAt: new Date(Date.now() + config.expiresInSeconds * 1000).toISOString(),
      config
    };
  }

  async connect(sessionId: string): Promise<VoiceConnection> {
    return {
      sessionId,
      providerSessionId: sessionId,
      events: []
    };
  }

  async updateSession(): Promise<void> {
    return;
  }

  async endSession(): Promise<void> {
    return;
  }
}
