import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { FileEventSink } from "../../src/telemetry/file-event-sink";

test("file event sink persists events across instances", async () => {
  const dataDir = join(".voice-agent-data", `events-test-${randomUUID()}`);
  const first = new FileEventSink(dataDir);
  await first.emit({
    eventId: "event_file",
    type: "session.created",
    sessionId: "sess_file_events",
    tenantId: "tenant_file_events",
    occurredAt: new Date().toISOString(),
    payload: { provider: "mock-openai" }
  });

  const second = new FileEventSink(dataDir);
  const events = await second.list();
  assert.equal(events.length, 1);
  assert.equal(events[0].eventId, "event_file");
});

test("file event sink purges expired and ephemeral session events", async () => {
  const dataDir = join(".voice-agent-data", `events-purge-test-${randomUUID()}`);
  const sink = new FileEventSink(dataDir);
  await sink.emit({
    eventId: "event_keep",
    type: "session.created",
    sessionId: "sess_keep",
    tenantId: "tenant_file_events",
    occurredAt: "2026-05-23T00:00:00.000Z",
    payload: {}
  });
  await sink.emit({
    eventId: "event_old",
    type: "session.created",
    sessionId: "sess_old",
    tenantId: "tenant_file_events",
    occurredAt: "2026-01-01T00:00:00.000Z",
    payload: {}
  });
  await sink.emit({
    eventId: "event_ephemeral",
    type: "session.created",
    sessionId: "sess_ephemeral",
    tenantId: "tenant_file_events",
    occurredAt: "2026-05-23T00:00:00.000Z",
    payload: {}
  });

  const removed = await sink.purgeExpiredEvents({
    cutoffIso: "2026-05-01T00:00:00.000Z",
    ephemeralSessionIds: ["sess_ephemeral"]
  });
  const events = await sink.list();

  assert.equal(removed, 2);
  assert.equal(events.length, 1);
  assert.equal(events[0].eventId, "event_keep");
});
