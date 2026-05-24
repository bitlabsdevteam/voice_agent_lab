import type { EventSink } from "../contracts/events";
import type { SessionStore } from "../session/session-store";

export type RetentionResult = {
  removedEvents: number;
  retainedEvents: number;
};

export class RetentionService {
  constructor(
    private readonly store: SessionStore,
    private readonly eventSink: EventSink
  ) {}

  async purgeExpiredEvents(now: Date, retentionDays: number): Promise<RetentionResult> {
    const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
    const sessions = new Map((await this.store.list()).map((session) => [session.sessionId, session]));
    const ephemeralSessionIds = [...sessions.values()]
      .filter((session) => session.retentionPolicy === "ephemeral")
      .map((session) => session.sessionId);

    if (this.eventSink.purgeExpiredEvents) {
      const removedEvents = await this.eventSink.purgeExpiredEvents({
        cutoffIso: new Date(cutoff).toISOString(),
        ephemeralSessionIds
      });
      return {
        removedEvents,
        retainedEvents: (await this.eventSink.list()).length
      };
    }

    if (!this.eventSink.replaceAll) {
      return {
        removedEvents: 0,
        retainedEvents: (await this.eventSink.list()).length
      };
    }

    const original = await this.eventSink.list();
    const ephemeralSessionIdSet = new Set(ephemeralSessionIds);
    const retained = original.filter((event) => {
      if (ephemeralSessionIdSet.has(event.sessionId)) {
        return false;
      }
      return new Date(event.occurredAt).getTime() >= cutoff;
    });

    await this.eventSink.replaceAll(retained);
    return {
      removedEvents: original.length - retained.length,
      retainedEvents: retained.length
    };
  }
}
