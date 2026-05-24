import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ConversationEvent, EventRetentionPurgeInput, EventSink } from "../contracts/events";

type EventFile = {
  version: 1;
  events: ConversationEvent[];
};

export class FileEventSink implements EventSink {
  readonly kind = "file";
  private readonly filePath: string;

  constructor(private readonly dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.filePath = join(dataDir, "events.json");
    if (!existsSync(this.filePath)) {
      this.write({ version: 1, events: [] });
    }
  }

  async emit(event: ConversationEvent): Promise<void> {
    const file = this.read();
    file.events.push(event);
    this.write(file);
  }

  async list(): Promise<ConversationEvent[]> {
    return this.read().events;
  }

  async replaceAll(events: ConversationEvent[]): Promise<void> {
    this.write({ version: 1, events });
  }

  async purgeExpiredEvents(input: EventRetentionPurgeInput): Promise<number> {
    const file = this.read();
    const cutoff = Date.parse(input.cutoffIso);
    const ephemeralSessionIds = new Set(input.ephemeralSessionIds);
    const retained = file.events.filter((event) => {
      if (ephemeralSessionIds.has(event.sessionId)) {
        return false;
      }
      return Date.parse(event.occurredAt) >= cutoff;
    });
    this.write({ version: 1, events: retained });
    return file.events.length - retained.length;
  }

  private read(): EventFile {
    return JSON.parse(readFileSync(this.filePath, "utf8")) as EventFile;
  }

  private write(file: EventFile): void {
    writeFileSync(this.filePath, `${JSON.stringify(file, null, 2)}\n`);
  }
}
