import { randomUUID } from "node:crypto";
import type { EventSink } from "../contracts/events";
import type { AuthContext, CreateVoiceSessionInput, CreateVoiceSessionResult, StoredVoiceSession } from "../contracts/session";
import { toSessionConfig, type RuntimeConfig } from "../config/voice-config";
import type { VoiceSessionProvider } from "../providers/voice-session-provider";
import type { SessionStore } from "./session-store";

export class SessionGateway {
  constructor(
    private readonly provider: VoiceSessionProvider,
    private readonly store: SessionStore,
    private readonly eventSink: EventSink,
    private readonly config: RuntimeConfig
  ) {}

  async createSession(input: CreateVoiceSessionInput, auth: AuthContext): Promise<CreateVoiceSessionResult> {
    assertAuthorized(input, auth);

    const sessionConfig = toSessionConfig(this.config);
    const created = await this.provider.createSession(input, sessionConfig);
    const now = new Date().toISOString();
    const stored: StoredVoiceSession = {
      sessionId: created.sessionId,
      tenantId: input.tenantId,
      userId: input.userId,
      channel: input.channel,
      provider: sessionConfig.provider,
      modelId: sessionConfig.modelId,
      voiceId: sessionConfig.voiceId,
      promptVersion: sessionConfig.promptVersion,
      startedAt: now,
      consentState: input.consentState,
      retentionPolicy: input.consentState === "granted" ? "audio_allowed" : "transcript_only",
      status: "created"
    };

    this.store.save(stored);
    this.eventSink.emit({
      eventId: randomUUID(),
      type: "session.created",
      sessionId: stored.sessionId,
      tenantId: stored.tenantId,
      occurredAt: now,
      payload: {
        channel: stored.channel,
        provider: stored.provider,
        modelId: stored.modelId,
        promptVersion: stored.promptVersion
      }
    });

    return created;
  }

  async connect(sessionId: string, auth: AuthContext): Promise<void> {
    const session = this.store.get(sessionId);
    if (!session) {
      throw new Error("Unknown session");
    }
    if (session.tenantId !== auth.tenantId || session.userId !== auth.userId) {
      throw new Error("Cross-tenant or cross-user session access denied");
    }

    await this.provider.connect(sessionId);
    this.store.save({ ...session, status: "connected" });
    this.eventSink.emit({
      eventId: randomUUID(),
      type: "session.connected",
      sessionId,
      tenantId: auth.tenantId,
      occurredAt: new Date().toISOString(),
      payload: { provider: session.provider }
    });
  }

  async endSession(sessionId: string, auth: AuthContext): Promise<void> {
    const session = this.store.get(sessionId);
    if (!session) {
      throw new Error("Unknown session");
    }
    if (session.tenantId !== auth.tenantId || session.userId !== auth.userId) {
      throw new Error("Cross-tenant or cross-user session access denied");
    }

    await this.provider.endSession(sessionId);
    this.store.markEnded(sessionId);
    this.eventSink.emit({
      eventId: randomUUID(),
      type: "session.ended",
      sessionId,
      tenantId: auth.tenantId,
      occurredAt: new Date().toISOString(),
      payload: {}
    });
  }
}

function assertAuthorized(input: CreateVoiceSessionInput, auth: AuthContext): void {
  if (input.tenantId !== auth.tenantId || input.userId !== auth.userId) {
    throw new Error("Cross-tenant or cross-user session creation denied");
  }
  if (!auth.scopes.includes("voice:session:create")) {
    throw new Error("Missing required scope: voice:session:create");
  }
}
