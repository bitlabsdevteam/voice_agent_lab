import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { FileSessionStore } from "../../src/session/file-session-store";

test("file session store persists sessions across instances", () => {
  const dataDir = join(".voice-agent-data", `test-${randomUUID()}`);
  const first = new FileSessionStore(dataDir);
  first.save({
    sessionId: "sess_file",
    tenantId: "tenant_file",
    userId: "user_file",
    channel: "test",
    provider: "mock-openai",
    modelId: "gpt-realtime-2",
    voiceId: "marin",
    promptVersion: "voice-agent-v1",
    startedAt: new Date().toISOString(),
    consentState: "denied",
    retentionPolicy: "transcript_only",
    status: "created"
  });

  const second = new FileSessionStore(dataDir);
  assert.equal(second.get("sess_file")?.tenantId, "tenant_file");
});
