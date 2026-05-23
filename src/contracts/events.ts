export type ConversationEventType =
  | "session.created"
  | "session.connected"
  | "audio.input.started"
  | "audio.input.stopped"
  | "turn.detected"
  | "transcript.partial"
  | "transcript.final"
  | "agent.response.started"
  | "agent.response.audio.delta"
  | "agent.response.completed"
  | "agent.response.cancelled"
  | "tool.call.requested"
  | "tool.call.completed"
  | "tool.call.failed"
  | "guardrail.triggered"
  | "handoff.requested"
  | "session.ended";

export type ConversationEvent = {
  eventId: string;
  type: ConversationEventType;
  sessionId: string;
  tenantId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export type EventSink = {
  emit(event: ConversationEvent): void;
  list(): ConversationEvent[];
};
