import test from "node:test";
import assert from "node:assert/strict";
import { PostgresEventSink } from "../../src/telemetry/postgres-event-sink";
import { MockSqlDatabase } from "../helpers/mock-sql";

test("postgres event sink inserts and lists conversation events", async () => {
  const db = new MockSqlDatabase([
    [],
    [
      {
        event_id: "event_pg",
        session_id: "sess_pg",
        tenant_id: "tenant_pg",
        event_type: "session.created",
        occurred_at: "2026-05-23T00:00:00.000Z",
        payload: { provider: "openai" }
      }
    ]
  ]);
  const sink = new PostgresEventSink(db);

  await sink.emit({
    eventId: "event_pg",
    sessionId: "sess_pg",
    tenantId: "tenant_pg",
    type: "session.created",
    occurredAt: "2026-05-23T00:00:00.000Z",
    payload: { provider: "openai" }
  });
  const events = await sink.list();

  assert.equal(db.queries[0].text.includes("insert into conversation_events"), true);
  assert.equal(db.queries[1].text.includes("from conversation_events"), true);
  assert.equal(events[0].eventId, "event_pg");
  assert.equal(events[0].payload.provider, "openai");
});

test("postgres event sink deletes expired and ephemeral session events with one query", async () => {
  const db = new MockSqlDatabase([[{ event_id: "event_old" }, { event_id: "event_ephemeral" }]]);
  const sink = new PostgresEventSink(db);

  const removed = await sink.purgeExpiredEvents({
    cutoffIso: "2026-05-01T00:00:00.000Z",
    ephemeralSessionIds: ["sess_ephemeral"]
  });

  assert.equal(removed, 2);
  assert.equal(db.queries[0].text.includes("delete from conversation_events"), true);
  assert.deepEqual(db.queries[0].values, ["2026-05-01T00:00:00.000Z", ["sess_ephemeral"]]);
});
