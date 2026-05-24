import type { AuthContext } from "../contracts/session";
import type { ToolResult } from "../contracts/tools";
import type { SessionStore } from "../session/session-store";
import { ToolService } from "../tools/tool-service";

export type RealtimeToolRequest = {
  sessionId: string;
  callId: string;
  name: string;
  args: unknown;
};

export type RealtimeToolResponse = {
  callId: string;
  ok: boolean;
  speech: string;
  data?: Record<string, unknown>;
};

export class RealtimeToolHandler {
  constructor(
    private readonly store: SessionStore,
    private readonly toolService: ToolService
  ) {}

  async handleToolRequest(request: RealtimeToolRequest, auth: AuthContext): Promise<RealtimeToolResponse> {
    assertRealtimeToolRequest(request);
    const session = await this.store.get(request.sessionId);
    if (!session) {
      throw new Error("Unknown session");
    }
    if (session.tenantId !== auth.tenantId || session.userId !== auth.userId) {
      throw new Error("Cross-tenant or cross-user tool access denied");
    }

    const result: ToolResult = await this.toolService.callTool({
      name: request.name,
      args: request.args,
      context: {
        sessionId: request.sessionId,
        tenantId: auth.tenantId,
        userId: auth.userId,
        scopes: auth.scopes,
        idempotencyKey: request.callId
      }
    });

    return {
      callId: request.callId,
      ok: result.ok,
      speech: result.speech,
      data: result.data
    };
  }
}

export function assertRealtimeToolRequest(value: unknown): asserts value is RealtimeToolRequest {
  if (!isRecord(value)) {
    throw new Error("Realtime tool request must be an object");
  }
  for (const field of ["sessionId", "callId", "name"]) {
    if (typeof value[field] !== "string" || value[field].trim().length === 0) {
      throw new Error(`Realtime tool request requires ${field}`);
    }
  }
  if (!("args" in value)) {
    throw new Error("Realtime tool request requires args");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
