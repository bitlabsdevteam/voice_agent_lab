import test from "node:test";
import assert from "node:assert/strict";
import { lookupPolicyTool } from "../../src/tools/policy-tool";
import { testAuth } from "../helpers";

test("lookup_policy returns approved policy with audit metadata", async () => {
  const result = await lookupPolicyTool.execute(
    { topic: "returns" },
    {
      sessionId: "sess_test",
      tenantId: testAuth.tenantId,
      userId: testAuth.userId,
      scopes: testAuth.scopes,
      idempotencyKey: "idem_test"
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.data?.sourceId, "policy:returns");
  assert.equal(result.audit.idempotencyKey, "idem_test");
});

test("lookup_policy rejects missing scope", async () => {
  await assert.rejects(
    () =>
      lookupPolicyTool.execute(
        { topic: "returns" },
        {
          sessionId: "sess_test",
          tenantId: testAuth.tenantId,
          userId: testAuth.userId,
          scopes: [],
          idempotencyKey: "idem_test"
        }
      ),
    /Missing required scopes/
  );
});
