import type { StoredVoiceSession } from "../contracts/session";

export interface SessionStore {
  readonly kind: "memory" | "file";
  save(session: StoredVoiceSession): void;
  get(sessionId: string): StoredVoiceSession | undefined;
  list(): StoredVoiceSession[];
  markEnded(sessionId: string): void;
}

export class InMemorySessionStore implements SessionStore {
  readonly kind = "memory";
  private readonly sessions = new Map<string, StoredVoiceSession>();

  save(session: StoredVoiceSession): void {
    this.sessions.set(session.sessionId, session);
  }

  get(sessionId: string): StoredVoiceSession | undefined {
    return this.sessions.get(sessionId);
  }

  list(): StoredVoiceSession[] {
    return [...this.sessions.values()];
  }

  markEnded(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    this.sessions.set(sessionId, {
      ...session,
      status: "ended",
      endedAt: new Date().toISOString()
    });
  }
}
