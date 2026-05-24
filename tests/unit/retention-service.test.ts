import test from "node:test";
import assert from "node:assert/strict";
import { InMemorySessionStore } from "../../src/session/session-store";
import { InMemoryEventSink } from "../../src/telemetry/in-memory-event-sink";
import { RetentionService } from "../../src/retention/retention-service";

test("retention service removes expired and ephemeral session events", async () => {
  const store = new InMemorySessionStore();
  const eventSink = new InMemoryEventSink();
  await store.save({
    sessionId: "sess_old",
    tenantId: "tenant",
    userId: "user",
    channel: "test",
    provider: "mock-openai",
    modelId: "gpt-realtime-2",
    voiceId: "marin",
    promptVersion: "voice-agent-v1",
    startedAt: "2026-01-01T00:00:00.000Z",
    consentState: "denied",
    retentionPolicy: "transcript_only",
    status: "ended"
  });
  await store.save({
    sessionId: "sess_ephemeral",
    tenantId: "tenant",
    userId: "user",
    channel: "test",
    provider: "mock-openai",
    modelId: "gpt-realtime-2",
    voiceId: "marin",
    promptVersion: "voice-agent-v1",
    startedAt: "2026-01-01T00:00:00.000Z",
    consentState: "denied",
    retentionPolicy: "ephemeral",
    status: "ended"
  });
  await eventSink.emit({
    eventId: "old",
    type: "session.created",
    sessionId: "sess_old",
    tenantId: "tenant",
    occurredAt: "2026-01-01T00:00:00.000Z",
    payload: {}
  });
  await eventSink.emit({
    eventId: "ephemeral",
    type: "session.created",
    sessionId: "sess_ephemeral",
    tenantId: "tenant",
    occurredAt: "2026-05-01T00:00:00.000Z",
    payload: {}
  });

  const result = await new RetentionService(store, eventSink).purgeExpiredEvents(new Date("2026-05-23T00:00:00.000Z"), 30);

  assert.equal(result.removedEvents, 2);
  assert.equal((await eventSink.list()).length, 0);
});

test("retention service uses native event sink purge when available", async () => {
  const store = new InMemorySessionStore();
  await store.save({
    sessionId: "sess_ephemeral",
    tenantId: "tenant",
    userId: "user",
    channel: "test",
    provider: "mock-openai",
    modelId: "gpt-realtime-2",
    voiceId: "marin",
    promptVersion: "voice-agent-v1",
    startedAt: "2026-01-01T00:00:00.000Z",
    consentState: "denied",
    retentionPolicy: "ephemeral",
    status: "ended"
  });

  const calls: unknown[] = [];
  const sink = {
    kind: "memory" as const,
    async emit() {},
    async list() {
      return [];
    },
    async purgeExpiredEvents(input: { cutoffIso: string; ephemeralSessionIds: string[] }) {
      calls.push(input);
      return 4;
    }
  };

  const result = await new RetentionService(store, sink).purgeExpiredEvents(new Date("2026-05-23T00:00:00.000Z"), 30);

  assert.equal(result.removedEvents, 4);
  assert.equal(result.retainedEvents, 0);
  assert.deepEqual(calls, [
    {
      cutoffIso: "2026-04-23T00:00:00.000Z",
      ephemeralSessionIds: ["sess_ephemeral"]
    }
  ]);
});
