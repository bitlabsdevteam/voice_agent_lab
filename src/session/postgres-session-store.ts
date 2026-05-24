import type { StoredVoiceSession } from "../contracts/session";
import type { SqlDatabase } from "../db/postgres";
import type { SessionStore } from "./session-store";

type VoiceSessionRow = {
  session_id: string;
  tenant_id: string;
  user_id: string;
  channel: StoredVoiceSession["channel"];
  provider: StoredVoiceSession["provider"];
  model_id: string;
  voice_id: string;
  prompt_version: string;
  started_at: Date | string;
  ended_at?: Date | string | null;
  consent_state: StoredVoiceSession["consentState"];
  retention_policy: StoredVoiceSession["retentionPolicy"];
  status: StoredVoiceSession["status"];
  failure_reason?: string | null;
};

export class PostgresSessionStore implements SessionStore {
  readonly kind = "postgres";

  constructor(private readonly db: SqlDatabase) {}

  async save(session: StoredVoiceSession): Promise<void> {
    await this.db.query(
      `insert into voice_sessions (
        session_id, tenant_id, user_id, channel, provider, model_id, voice_id, prompt_version,
        started_at, ended_at, consent_state, retention_policy, status, failure_reason, updated_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, now()
      )
      on conflict (session_id) do update set
        tenant_id = excluded.tenant_id,
        user_id = excluded.user_id,
        channel = excluded.channel,
        provider = excluded.provider,
        model_id = excluded.model_id,
        voice_id = excluded.voice_id,
        prompt_version = excluded.prompt_version,
        started_at = excluded.started_at,
        ended_at = excluded.ended_at,
        consent_state = excluded.consent_state,
        retention_policy = excluded.retention_policy,
        status = excluded.status,
        failure_reason = excluded.failure_reason,
        updated_at = now()`,
      [
        session.sessionId,
        session.tenantId,
        session.userId,
        session.channel,
        session.provider,
        session.modelId,
        session.voiceId,
        session.promptVersion,
        session.startedAt,
        session.endedAt ?? null,
        session.consentState,
        session.retentionPolicy,
        session.status,
        session.failureReason ?? null
      ]
    );
  }

  async get(sessionId: string): Promise<StoredVoiceSession | undefined> {
    const result = await this.db.query<VoiceSessionRow>("select * from voice_sessions where session_id = $1", [sessionId]);
    return result.rows[0] ? fromRow(result.rows[0]) : undefined;
  }

  async list(): Promise<StoredVoiceSession[]> {
    const result = await this.db.query<VoiceSessionRow>("select * from voice_sessions order by started_at desc limit 1000");
    return result.rows.map(fromRow);
  }

  async markEnded(sessionId: string): Promise<void> {
    await this.db.query("update voice_sessions set status = 'ended', ended_at = now(), updated_at = now() where session_id = $1", [
      sessionId
    ]);
  }
}

function fromRow(row: VoiceSessionRow): StoredVoiceSession {
  return {
    sessionId: row.session_id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    channel: row.channel,
    provider: row.provider,
    modelId: row.model_id,
    voiceId: row.voice_id,
    promptVersion: row.prompt_version,
    startedAt: toIso(row.started_at),
    endedAt: row.ended_at ? toIso(row.ended_at) : undefined,
    consentState: row.consent_state,
    retentionPolicy: row.retention_policy,
    status: row.status,
    failureReason: row.failure_reason ?? undefined
  };
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}
