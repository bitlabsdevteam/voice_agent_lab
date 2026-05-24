import test from "node:test";
import assert from "node:assert/strict";
import { PostgresSessionStore } from "../../src/session/postgres-session-store";
import { MockSqlDatabase } from "../helpers/mock-sql";

test("postgres session store upserts and reads voice sessions", async () => {
  const db = new MockSqlDatabase([
    [],
    [
      {
        session_id: "sess_pg",
        tenant_id: "tenant_pg",
        user_id: "user_pg",
        channel: "web",
        provider: "openai",
        model_id: "gpt-realtime-2",
        voice_id: "marin",
        prompt_version: "voice-agent-v1",
        started_at: "2026-05-23T00:00:00.000Z",
        ended_at: null,
        consent_state: "denied",
        retention_policy: "transcript_only",
        status: "created",
        failure_reason: null
      }
    ]
  ]);
  const store = new PostgresSessionStore(db);

  await store.save({
    sessionId: "sess_pg",
    tenantId: "tenant_pg",
    userId: "user_pg",
    channel: "web",
    provider: "openai",
    modelId: "gpt-realtime-2",
    voiceId: "marin",
    promptVersion: "voice-agent-v1",
    startedAt: "2026-05-23T00:00:00.000Z",
    consentState: "denied",
    retentionPolicy: "transcript_only",
    status: "created"
  });
  const session = await store.get("sess_pg");

  assert.equal(db.queries[0].text.includes("insert into voice_sessions"), true);
  assert.equal(db.queries[1].text.includes("select * from voice_sessions"), true);
  assert.equal(session?.sessionId, "sess_pg");
  assert.equal(session?.tenantId, "tenant_pg");
});

test("postgres session store marks sessions ended", async () => {
  const db = new MockSqlDatabase();
  const store = new PostgresSessionStore(db);

  await store.markEnded("sess_pg");

  assert.equal(db.queries[0].text.includes("status = 'ended'"), true);
  assert.deepEqual(db.queries[0].values, ["sess_pg"]);
});
