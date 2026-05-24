import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StoredVoiceSession } from "../contracts/session";
import type { SessionStore } from "./session-store";

type SessionStoreFile = {
  version: 1;
  sessions: StoredVoiceSession[];
};

export class FileSessionStore implements SessionStore {
  readonly kind = "file";
  private readonly filePath: string;

  constructor(private readonly dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.filePath = join(dataDir, "sessions.json");
    if (!existsSync(this.filePath)) {
      this.write({ version: 1, sessions: [] });
    }
  }

  async save(session: StoredVoiceSession): Promise<void> {
    const file = this.read();
    const existingIndex = file.sessions.findIndex((candidate) => candidate.sessionId === session.sessionId);
    if (existingIndex >= 0) {
      file.sessions[existingIndex] = session;
    } else {
      file.sessions.push(session);
    }
    this.write(file);
  }

  async get(sessionId: string): Promise<StoredVoiceSession | undefined> {
    return this.read().sessions.find((session) => session.sessionId === sessionId);
  }

  async list(): Promise<StoredVoiceSession[]> {
    return this.read().sessions;
  }

  async markEnded(sessionId: string): Promise<void> {
    const session = await this.get(sessionId);
    if (!session) {
      return;
    }
    await this.save({
      ...session,
      status: "ended",
      endedAt: new Date().toISOString()
    });
  }

  private read(): SessionStoreFile {
    return JSON.parse(readFileSync(this.filePath, "utf8")) as SessionStoreFile;
  }

  private write(file: SessionStoreFile): void {
    writeFileSync(this.filePath, `${JSON.stringify(file, null, 2)}\n`);
  }
}
