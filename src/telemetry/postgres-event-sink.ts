import type { ConversationEvent, EventRetentionPurgeInput, EventSink } from "../contracts/events";
import type { SqlDatabase } from "../db/postgres";

type EventRow = {
  event_id: string;
  session_id: string;
  tenant_id: string;
  event_type: ConversationEvent["type"];
  occurred_at: Date | string;
  payload: Record<string, unknown>;
};

export class PostgresEventSink implements EventSink {
  readonly kind = "postgres";

  constructor(private readonly db: SqlDatabase) {}

  async emit(event: ConversationEvent): Promise<void> {
    await this.db.query(
      `insert into conversation_events (event_id, session_id, tenant_id, event_type, occurred_at, payload)
       values ($1, $2, $3, $4, $5, $6::jsonb)
       on conflict (event_id) do nothing`,
      [
        event.eventId,
        event.sessionId,
        event.tenantId,
        event.type,
        event.occurredAt,
        JSON.stringify(event.payload)
      ]
    );
  }

  async list(): Promise<ConversationEvent[]> {
    const result = await this.db.query<EventRow>(
      "select event_id, session_id, tenant_id, event_type, occurred_at, payload from conversation_events order by occurred_at asc limit 5000"
    );
    return result.rows.map((row) => ({
      eventId: row.event_id,
      sessionId: row.session_id,
      tenantId: row.tenant_id,
      type: row.event_type,
      occurredAt: row.occurred_at instanceof Date ? row.occurred_at.toISOString() : row.occurred_at,
      payload: row.payload
    }));
  }

  async replaceAll(events: ConversationEvent[]): Promise<void> {
    await this.db.query("delete from conversation_events");
    for (const event of events) {
      await this.emit(event);
    }
  }

  async purgeExpiredEvents(input: EventRetentionPurgeInput): Promise<number> {
    const result = await this.db.query<{ event_id: string }>(
      `delete from conversation_events
       where occurred_at < $1
          or session_id = any($2::text[])
       returning event_id`,
      [input.cutoffIso, input.ephemeralSessionIds]
    );
    return result.rows.length;
  }
}
