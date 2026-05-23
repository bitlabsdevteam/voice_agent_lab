import { randomUUID } from "node:crypto";
import type { ConversationEvent, ConversationEventType, EventSink } from "../contracts/events";

export class InMemoryEventSink implements EventSink {
  private readonly events: ConversationEvent[] = [];

  emit(event: ConversationEvent): void {
    this.events.push(event);
  }

  record(input: {
    type: ConversationEventType;
    sessionId: string;
    tenantId: string;
    payload?: Record<string, unknown>;
  }): ConversationEvent {
    const event: ConversationEvent = {
      eventId: randomUUID(),
      type: input.type,
      sessionId: input.sessionId,
      tenantId: input.tenantId,
      occurredAt: new Date().toISOString(),
      payload: input.payload ?? {}
    };
    this.emit(event);
    return event;
  }

  list(): ConversationEvent[] {
    return [...this.events];
  }
}
