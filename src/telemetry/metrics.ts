import type { ConversationEvent, EventSink } from "../contracts/events";

export type VoiceAgentMetrics = {
  sessionsCreated: number;
  sessionsConnected: number;
  sessionsEnded: number;
  activeSessions: number;
  toolCallsRequested: number;
  toolCallsCompleted: number;
  toolCallsFailed: number;
  guardrailsTriggered: number;
  handoffsRequested: number;
  realtimeConnectionSuccessRatePercent: number;
  sessionCompletionRatePercent: number;
  toolCallSuccessRatePercent: number;
  timeToFirstAudioP50Milliseconds: number;
  timeToFirstAudioP95Milliseconds: number;
  turnCompletionLatencyP50Milliseconds: number;
  turnCompletionLatencyP95Milliseconds: number;
  bargeInCancellationP95Milliseconds: number;
  sessionDurationP95Milliseconds: number;
};

export async function collectMetrics(eventSink: EventSink): Promise<VoiceAgentMetrics> {
  const events = (await eventSink.list()).slice().sort(compareOccurredAt);
  const sessionsCreated = count(events, "session.created");
  const sessionsConnected = count(events, "session.connected");
  const sessionsEnded = count(events, "session.ended");
  const toolCallsRequested = count(events, "tool.call.requested");
  const toolCallsCompleted = count(events, "tool.call.completed");
  const toolCallsFailed = count(events, "tool.call.failed");
  const latencies = collectLatencySamples(events);
  return {
    sessionsCreated,
    sessionsConnected,
    sessionsEnded,
    activeSessions: Math.max(sessionsConnected - sessionsEnded, 0),
    toolCallsRequested,
    toolCallsCompleted,
    toolCallsFailed,
    guardrailsTriggered: count(events, "guardrail.triggered"),
    handoffsRequested: count(events, "handoff.requested"),
    realtimeConnectionSuccessRatePercent: percentage(sessionsConnected, sessionsCreated),
    sessionCompletionRatePercent: percentage(sessionsEnded, sessionsCreated),
    toolCallSuccessRatePercent: percentage(toolCallsCompleted, toolCallsRequested),
    timeToFirstAudioP50Milliseconds: percentile(latencies.timeToFirstAudio, 0.5),
    timeToFirstAudioP95Milliseconds: percentile(latencies.timeToFirstAudio, 0.95),
    turnCompletionLatencyP50Milliseconds: percentile(latencies.turnCompletion, 0.5),
    turnCompletionLatencyP95Milliseconds: percentile(latencies.turnCompletion, 0.95),
    bargeInCancellationP95Milliseconds: percentile(latencies.bargeInCancellation, 0.95),
    sessionDurationP95Milliseconds: percentile(latencies.sessionDuration, 0.95)
  };
}

export function renderPrometheusMetrics(metrics: VoiceAgentMetrics): string {
  return [
    "# HELP voice_agent_sessions_created_total Total voice sessions created.",
    "# TYPE voice_agent_sessions_created_total counter",
    `voice_agent_sessions_created_total ${metrics.sessionsCreated}`,
    "# HELP voice_agent_sessions_connected_total Total voice sessions connected.",
    "# TYPE voice_agent_sessions_connected_total counter",
    `voice_agent_sessions_connected_total ${metrics.sessionsConnected}`,
    "# HELP voice_agent_sessions_ended_total Total voice sessions ended.",
    "# TYPE voice_agent_sessions_ended_total counter",
    `voice_agent_sessions_ended_total ${metrics.sessionsEnded}`,
    "# HELP voice_agent_active_sessions Current connected sessions that have not ended.",
    "# TYPE voice_agent_active_sessions gauge",
    `voice_agent_active_sessions ${metrics.activeSessions}`,
    "# HELP voice_agent_tool_calls_requested_total Total tool calls requested.",
    "# TYPE voice_agent_tool_calls_requested_total counter",
    `voice_agent_tool_calls_requested_total ${metrics.toolCallsRequested}`,
    "# HELP voice_agent_tool_calls_completed_total Total tool calls completed.",
    "# TYPE voice_agent_tool_calls_completed_total counter",
    `voice_agent_tool_calls_completed_total ${metrics.toolCallsCompleted}`,
    "# HELP voice_agent_tool_calls_failed_total Total tool calls failed.",
    "# TYPE voice_agent_tool_calls_failed_total counter",
    `voice_agent_tool_calls_failed_total ${metrics.toolCallsFailed}`,
    "# HELP voice_agent_guardrails_triggered_total Total guardrail triggers.",
    "# TYPE voice_agent_guardrails_triggered_total counter",
    `voice_agent_guardrails_triggered_total ${metrics.guardrailsTriggered}`,
    "# HELP voice_agent_handoffs_requested_total Total handoff requests.",
    "# TYPE voice_agent_handoffs_requested_total counter",
    `voice_agent_handoffs_requested_total ${metrics.handoffsRequested}`,
    "# HELP voice_agent_realtime_connection_success_rate_percent Percentage of created sessions that connected successfully.",
    "# TYPE voice_agent_realtime_connection_success_rate_percent gauge",
    `voice_agent_realtime_connection_success_rate_percent ${format(metrics.realtimeConnectionSuccessRatePercent)}`,
    "# HELP voice_agent_session_completion_rate_percent Percentage of created sessions that ended cleanly.",
    "# TYPE voice_agent_session_completion_rate_percent gauge",
    `voice_agent_session_completion_rate_percent ${format(metrics.sessionCompletionRatePercent)}`,
    "# HELP voice_agent_tool_call_success_rate_percent Percentage of requested tool calls that completed successfully.",
    "# TYPE voice_agent_tool_call_success_rate_percent gauge",
    `voice_agent_tool_call_success_rate_percent ${format(metrics.toolCallSuccessRatePercent)}`,
    "# HELP voice_agent_time_to_first_audio_p50_milliseconds P50 proxy for time from turn detection to first assistant audio or response start.",
    "# TYPE voice_agent_time_to_first_audio_p50_milliseconds gauge",
    `voice_agent_time_to_first_audio_p50_milliseconds ${format(metrics.timeToFirstAudioP50Milliseconds)}`,
    "# HELP voice_agent_time_to_first_audio_p95_milliseconds P95 proxy for time from turn detection to first assistant audio or response start.",
    "# TYPE voice_agent_time_to_first_audio_p95_milliseconds gauge",
    `voice_agent_time_to_first_audio_p95_milliseconds ${format(metrics.timeToFirstAudioP95Milliseconds)}`,
    "# HELP voice_agent_turn_completion_latency_p50_milliseconds P50 time from turn detection to completed assistant response.",
    "# TYPE voice_agent_turn_completion_latency_p50_milliseconds gauge",
    `voice_agent_turn_completion_latency_p50_milliseconds ${format(metrics.turnCompletionLatencyP50Milliseconds)}`,
    "# HELP voice_agent_turn_completion_latency_p95_milliseconds P95 time from turn detection to completed assistant response.",
    "# TYPE voice_agent_turn_completion_latency_p95_milliseconds gauge",
    `voice_agent_turn_completion_latency_p95_milliseconds ${format(metrics.turnCompletionLatencyP95Milliseconds)}`,
    "# HELP voice_agent_barge_in_cancellation_p95_milliseconds P95 time from assistant response start to cancellation.",
    "# TYPE voice_agent_barge_in_cancellation_p95_milliseconds gauge",
    `voice_agent_barge_in_cancellation_p95_milliseconds ${format(metrics.bargeInCancellationP95Milliseconds)}`,
    "# HELP voice_agent_session_duration_p95_milliseconds P95 time from session creation to session end.",
    "# TYPE voice_agent_session_duration_p95_milliseconds gauge",
    `voice_agent_session_duration_p95_milliseconds ${format(metrics.sessionDurationP95Milliseconds)}`,
    ""
  ].join("\n");
}

function count(events: ConversationEvent[], type: ConversationEvent["type"]): number {
  return events.filter((event) => event.type === type).length;
}

function compareOccurredAt(left: ConversationEvent, right: ConversationEvent): number {
  return Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
}

function percentage(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 100;
  }
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function percentile(samples: number[], ratio: number): number {
  if (samples.length === 0) {
    return 0;
  }
  const sorted = samples.slice().sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function collectLatencySamples(events: ConversationEvent[]): {
  timeToFirstAudio: number[];
  turnCompletion: number[];
  bargeInCancellation: number[];
  sessionDuration: number[];
} {
  const stateBySession = new Map<
    string,
    {
      pendingTurns: Array<{ detectedAt: number; firstAudioCaptured: boolean }>;
      activeResponses: number[];
      sessionCreatedAt?: number;
    }
  >();
  const timeToFirstAudio: number[] = [];
  const turnCompletion: number[] = [];
  const bargeInCancellation: number[] = [];
  const sessionDuration: number[] = [];

  for (const event of events) {
    const timestamp = Date.parse(event.occurredAt);
    const state = getSessionState(stateBySession, event.sessionId);
    switch (event.type) {
      case "session.created":
        state.sessionCreatedAt = timestamp;
        break;
      case "session.ended":
        if (typeof state.sessionCreatedAt === "number") {
          sessionDuration.push(timestamp - state.sessionCreatedAt);
        }
        break;
      case "turn.detected":
        state.pendingTurns.push({ detectedAt: timestamp, firstAudioCaptured: false });
        break;
      case "agent.response.started":
        state.activeResponses.push(timestamp);
        captureFirstAudio(state.pendingTurns, timestamp, timeToFirstAudio);
        break;
      case "agent.response.audio.delta":
        captureFirstAudio(state.pendingTurns, timestamp, timeToFirstAudio);
        break;
      case "agent.response.completed":
        completePendingTurn(state.pendingTurns, timestamp, turnCompletion);
        shiftIfPresent(state.activeResponses);
        break;
      case "agent.response.cancelled":
        if (state.activeResponses.length > 0) {
          bargeInCancellation.push(Math.max(timestamp - state.activeResponses[0], 0));
        }
        shiftIfPresent(state.activeResponses);
        shiftIfPresent(state.pendingTurns);
        break;
      default:
        break;
    }
  }

  return { timeToFirstAudio, turnCompletion, bargeInCancellation, sessionDuration };
}

function getSessionState(
  stateBySession: Map<
    string,
    {
      pendingTurns: Array<{ detectedAt: number; firstAudioCaptured: boolean }>;
      activeResponses: number[];
      sessionCreatedAt?: number;
    }
  >,
  sessionId: string
): {
  pendingTurns: Array<{ detectedAt: number; firstAudioCaptured: boolean }>;
  activeResponses: number[];
  sessionCreatedAt?: number;
} {
  const existing = stateBySession.get(sessionId);
  if (existing) {
    return existing;
  }
  const created = { pendingTurns: [], activeResponses: [] };
  stateBySession.set(sessionId, created);
  return created;
}

function captureFirstAudio(
  pendingTurns: Array<{ detectedAt: number; firstAudioCaptured: boolean }>,
  timestamp: number,
  samples: number[]
): void {
  const pendingTurn = pendingTurns[0];
  if (!pendingTurn || pendingTurn.firstAudioCaptured) {
    return;
  }
  pendingTurn.firstAudioCaptured = true;
  samples.push(Math.max(timestamp - pendingTurn.detectedAt, 0));
}

function completePendingTurn(
  pendingTurns: Array<{ detectedAt: number; firstAudioCaptured: boolean }>,
  timestamp: number,
  samples: number[]
): void {
  const pendingTurn = pendingTurns[0];
  if (!pendingTurn) {
    return;
  }
  samples.push(Math.max(timestamp - pendingTurn.detectedAt, 0));
  pendingTurns.shift();
}

function shiftIfPresent<T>(values: T[]): void {
  if (values.length > 0) {
    values.shift();
  }
}
