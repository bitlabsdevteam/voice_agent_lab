import type { StoredVoiceSession } from "../contracts/session";

export interface SessionStore {
  readonly kind: "memory" | "file" | "postgres";
  save(session: StoredVoiceSession): Promise<void>;
  get(sessionId: string): Promise<StoredVoiceSession | undefined>;
  list(): Promise<StoredVoiceSession[]>;
  markEnded(sessionId: string): Promise<void>;
}

export class InMemorySessionStore implements SessionStore {
  readonly kind = "memory";
  private readonly sessions = new Map<string, StoredVoiceSession>();

  async save(session: StoredVoiceSession): Promise<void> {
    this.sessions.set(session.sessionId, session);
  }

  async get(sessionId: string): Promise<StoredVoiceSession | undefined> {
    return this.sessions.get(sessionId);
  }

  async list(): Promise<StoredVoiceSession[]> {
    return [...this.sessions.values()];
  }

  async markEnded(sessionId: string): Promise<void> {
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
