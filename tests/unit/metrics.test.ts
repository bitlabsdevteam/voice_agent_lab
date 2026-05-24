import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { InMemoryEventSink } from "../../src/telemetry/in-memory-event-sink";
import { collectMetrics, renderPrometheusMetrics } from "../../src/telemetry/metrics";

test("metrics aggregate conversation events and render Prometheus counters", async () => {
  const eventSink = new InMemoryEventSink();
  const baseTime = Date.parse("2026-05-24T12:00:00.000Z");
  const emit = async (offsetMs: number, type: Parameters<typeof eventSink.emit>[0]["type"]) => {
    await eventSink.emit({
      eventId: randomUUID(),
      type,
      sessionId: "sess_metrics",
      tenantId: "tenant_metrics",
      occurredAt: new Date(baseTime + offsetMs).toISOString(),
      payload: {}
    });
  };

  await emit(0, "session.created");
  await emit(100, "session.connected");
  await emit(200, "turn.detected");
  await emit(500, "agent.response.started");
  await emit(1100, "agent.response.completed");
  await emit(1200, "tool.call.requested");
  await emit(1400, "tool.call.completed");
  await emit(1800, "session.ended");

  const metrics = await collectMetrics(eventSink);
  const text = renderPrometheusMetrics(metrics);

  assert.equal(metrics.sessionsCreated, 1);
  assert.equal(metrics.sessionsConnected, 1);
  assert.equal(metrics.sessionsEnded, 1);
  assert.equal(metrics.activeSessions, 0);
  assert.equal(metrics.toolCallsCompleted, 1);
  assert.equal(metrics.realtimeConnectionSuccessRatePercent, 100);
  assert.equal(metrics.timeToFirstAudioP50Milliseconds, 300);
  assert.equal(metrics.turnCompletionLatencyP95Milliseconds, 900);
  assert.equal(metrics.sessionDurationP95Milliseconds, 1800);
  assert.equal(text.includes("voice_agent_sessions_created_total 1"), true);
  assert.equal(text.includes("voice_agent_tool_calls_completed_total 1"), true);
  assert.equal(text.includes("voice_agent_realtime_connection_success_rate_percent 100"), true);
  assert.equal(text.includes("voice_agent_time_to_first_audio_p95_milliseconds 300"), true);
  assert.equal(text.includes("voice_agent_turn_completion_latency_p95_milliseconds 900"), true);
});
