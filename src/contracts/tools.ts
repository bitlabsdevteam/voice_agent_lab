export type ToolRisk = "low" | "medium" | "high" | "critical";

export type ToolContext = {
  sessionId: string;
  tenantId: string;
  userId: string;
  scopes: string[];
  idempotencyKey: string;
};

export type ToolResult = {
  ok: boolean;
  speech: string;
  data?: Record<string, unknown>;
  audit: Record<string, unknown>;
};

export type VoiceAgentTool = {
  name: string;
  description: string;
  risk: ToolRisk;
  mutatesState: boolean;
  requiredScopes: string[];
  requiresUserConfirmation: boolean;
  timeoutMs: number;
  validate(input: unknown): Record<string, unknown>;
  execute(input: unknown, context: ToolContext): Promise<ToolResult>;
};
