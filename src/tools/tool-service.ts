import { randomUUID } from "node:crypto";
import type { EventSink } from "../contracts/events";
import type { ToolContext, ToolResult, VoiceAgentTool } from "../contracts/tools";

export class ToolService {
  private readonly tools = new Map<string, VoiceAgentTool>();
  private readonly completedCalls = new Map<string, ToolResult>();

  constructor(
    tools: VoiceAgentTool[],
    private readonly eventSink: EventSink
  ) {
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }

  async callTool(input: {
    name: string;
    args: unknown;
    context: Omit<ToolContext, "idempotencyKey"> & { idempotencyKey?: string };
  }): Promise<ToolResult> {
    const tool = this.tools.get(input.name);
    if (!tool) {
      throw new Error(`Unknown tool: ${input.name}`);
    }

    const context: ToolContext = {
      ...input.context,
      idempotencyKey: input.context.idempotencyKey ?? randomUUID()
    };
    const idempotencyCacheKey = `${context.sessionId}:${tool.name}:${context.idempotencyKey}`;
    const cached = this.completedCalls.get(idempotencyCacheKey);
    if (cached) {
      return cached;
    }

    await this.eventSink.emit({
      eventId: randomUUID(),
      type: "tool.call.requested",
      sessionId: context.sessionId,
      tenantId: context.tenantId,
      occurredAt: new Date().toISOString(),
      payload: { toolName: tool.name, risk: tool.risk, mutatesState: tool.mutatesState }
    });

    try {
      const result = await tool.execute(input.args, context);
      await this.eventSink.emit({
        eventId: randomUUID(),
        type: "tool.call.completed",
        sessionId: context.sessionId,
        tenantId: context.tenantId,
        occurredAt: new Date().toISOString(),
        payload: { toolName: tool.name, ok: result.ok }
      });
      this.completedCalls.set(idempotencyCacheKey, result);
      return result;
    } catch (error) {
      await this.eventSink.emit({
        eventId: randomUUID(),
        type: "tool.call.failed",
        sessionId: context.sessionId,
        tenantId: context.tenantId,
        occurredAt: new Date().toISOString(),
        payload: {
          toolName: tool.name,
          message: error instanceof Error ? error.message : "Unknown tool error"
        }
      });
      throw error;
    }
  }
}
