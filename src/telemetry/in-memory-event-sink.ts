import { randomUUID } from "node:crypto";
import type { ConversationEvent, ConversationEventType, EventRetentionPurgeInput, EventSink } from "../contracts/events";

export class InMemoryEventSink implements EventSink {
  readonly kind = "memory";
  private readonly events: ConversationEvent[] = [];

  async emit(event: ConversationEvent): Promise<void> {
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
    void this.emit(event);
    return event;
  }

  async list(): Promise<ConversationEvent[]> {
    return [...this.events];
  }

  async replaceAll(events: ConversationEvent[]): Promise<void> {
    this.events.length = 0;
    this.events.push(...events);
  }

  async purgeExpiredEvents(input: EventRetentionPurgeInput): Promise<number> {
    const cutoff = Date.parse(input.cutoffIso);
    const ephemeralSessionIds = new Set(input.ephemeralSessionIds);
    const originalLength = this.events.length;
    const retained = this.events.filter((event) => {
      if (ephemeralSessionIds.has(event.sessionId)) {
        return false;
      }
      return Date.parse(event.occurredAt) >= cutoff;
    });
    this.events.length = 0;
    this.events.push(...retained);
    return originalLength - retained.length;
  }
}
