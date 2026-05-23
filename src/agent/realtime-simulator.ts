import { randomUUID } from "node:crypto";
import type { EventSink } from "../contracts/events";

export class RealtimeTurnSimulator {
  private readonly processedProviderEventIds = new Set<string>();
  private speaking = false;

  constructor(
    private readonly sessionId: string,
    private readonly tenantId: string,
    private readonly eventSink: EventSink
  ) {}

  startResponse(): void {
    this.speaking = true;
    this.record("agent.response.started", {});
  }

  interrupt(): void {
    if (!this.speaking) {
      return;
    }
    this.speaking = false;
    this.record("agent.response.cancelled", { reason: "barge_in" });
  }

  completeResponse(): void {
    if (!this.speaking) {
      return;
    }
    this.speaking = false;
    this.record("agent.response.completed", {});
  }

  receiveProviderEvent(providerEventId: string, eventType: string): boolean {
    if (this.processedProviderEventIds.has(providerEventId)) {
      return false;
    }
    this.processedProviderEventIds.add(providerEventId);
    this.record("turn.detected", { providerEventId, eventType });
    return true;
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  private record(type: "agent.response.started" | "agent.response.cancelled" | "agent.response.completed" | "turn.detected", payload: Record<string, unknown>): void {
    this.eventSink.emit({
      eventId: randomUUID(),
      type,
      sessionId: this.sessionId,
      tenantId: this.tenantId,
      occurredAt: new Date().toISOString(),
      payload
    });
  }
}
