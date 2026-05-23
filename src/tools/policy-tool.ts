import { createHash } from "node:crypto";
import type { ToolContext, ToolResult, VoiceAgentTool } from "../contracts/tools";
import { redactSensitiveText } from "../security/redaction";

const POLICIES: Record<string, string> = {
  returns: "Customers can return eligible items within 30 days with proof of purchase.",
  privacy: "We collect only the information required to resolve the request and follow the configured retention policy.",
  handoff: "A human specialist can join when the request is outside the agent scope or requires manual approval."
};

export const lookupPolicyTool: VoiceAgentTool = {
  name: "lookup_policy",
  description: "Looks up an approved policy answer by topic.",
  risk: "low",
  mutatesState: false,
  requiredScopes: ["policy:read"],
  requiresUserConfirmation: false,
  timeoutMs: 1000,
  validate(input: unknown): Record<string, unknown> {
    if (!isRecord(input) || typeof input.topic !== "string" || input.topic.trim().length === 0) {
      throw new Error("lookup_policy requires a non-empty topic");
    }

    return { topic: input.topic.trim().toLowerCase() };
  },
  async execute(input: unknown, context: ToolContext): Promise<ToolResult> {
    const validated = this.validate(input);
    requireScopes(context.scopes, this.requiredScopes);

    const topic = String(validated.topic);
    const answer = POLICIES[topic] ?? "I do not have an approved policy for that topic. I can hand this to a human specialist.";

    return {
      ok: Boolean(POLICIES[topic]),
      speech: redactSensitiveText(answer),
      data: {
        topic,
        sourceId: `policy:${topic}`,
        answerHash: createHash("sha256").update(answer).digest("hex")
      },
      audit: {
        toolName: this.name,
        tenantId: context.tenantId,
        userId: context.userId,
        sessionId: context.sessionId,
        idempotencyKey: context.idempotencyKey,
        risk: this.risk
      }
    };
  }
};

export function requireScopes(actual: string[], required: string[]): void {
  const missing = required.filter((scope) => !actual.includes(scope));
  if (missing.length > 0) {
    throw new Error(`Missing required scopes: ${missing.join(", ")}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
