import type { CreateVoiceSessionInput, CreateVoiceSessionResult, VoiceSessionConfig } from "../contracts/session";
import type { VoiceConnection, VoiceSessionProvider } from "./voice-session-provider";

type OpenAIClientSecretResponse = {
  value?: string;
  client_secret?: {
    value?: string;
    expires_at?: number;
  };
  expires_at?: number;
  id?: string;
};

type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

export class OpenAIRealtimeProvider implements VoiceSessionProvider {
  readonly name = "openai";

  constructor(
    private readonly apiKey: string | undefined = process.env.OPENAI_API_KEY,
    private readonly baseUrl = "https://api.openai.com/v1",
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  async createSession(input: CreateVoiceSessionInput, config: VoiceSessionConfig): Promise<CreateVoiceSessionResult> {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is required when VOICE_AGENT_PROVIDER=openai");
    }

    const response = await this.fetchImpl(`${this.baseUrl}/realtime/client_secrets`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        expires_after: {
          anchor: "created_at",
          seconds: config.expiresInSeconds
        },
        session: {
          type: "realtime",
          model: config.modelId,
          audio: {
            output: {
              voice: config.voiceId
            }
          },
          instructions: `Use prompt version ${config.promptVersion}. Follow the server-side voice-agent instructions.`
        }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI realtime client secret request failed with ${response.status}: ${text}`);
    }

    const data = (await response.json()) as OpenAIClientSecretResponse;
    const clientSecret = data.client_secret?.value ?? data.value;
    if (!clientSecret) {
      throw new Error("OpenAI realtime client secret response did not include a usable value");
    }

    const expiresAt = data.client_secret?.expires_at ?? data.expires_at;

    return {
      sessionId: data.id ?? `openai_pending_${Date.now()}`,
      clientSecret,
      expiresAt: expiresAt ? new Date(expiresAt * 1000).toISOString() : new Date(Date.now() + config.expiresInSeconds * 1000).toISOString(),
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
