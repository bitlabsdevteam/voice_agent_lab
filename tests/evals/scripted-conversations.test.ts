import test from "node:test";
import assert from "node:assert/strict";
import { lookupPolicyTool } from "../../src/tools/policy-tool";
import { testAuth } from "../helpers";

test("golden path eval: returns policy answer from approved source", async () => {
  const result = await lookupPolicyTool.execute(
    { topic: "returns" },
    {
      sessionId: "sess_eval",
      tenantId: testAuth.tenantId,
      userId: testAuth.userId,
      scopes: testAuth.scopes,
      idempotencyKey: "idem_eval"
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.data?.sourceId, "policy:returns");
  assert.equal(result.speech.includes("30 days"), true);
});

test("refusal eval: unsupported policy topic avoids hallucinated answer", async () => {
  const result = await lookupPolicyTool.execute(
    { topic: "wire transfer" },
    {
      sessionId: "sess_eval",
      tenantId: testAuth.tenantId,
      userId: testAuth.userId,
      scopes: testAuth.scopes,
      idempotencyKey: "idem_eval"
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.speech.includes("do not have an approved policy"), true);
});
