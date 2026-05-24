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

export type EventRetentionPurgeInput = {
  cutoffIso: string;
  ephemeralSessionIds: string[];
};

export type EventSink = {
  readonly kind: "memory" | "file" | "postgres";
  emit(event: ConversationEvent): Promise<void>;
  list(): Promise<ConversationEvent[]>;
  replaceAll?(events: ConversationEvent[]): Promise<void>;
  purgeExpiredEvents?(input: EventRetentionPurgeInput): Promise<number>;
};
