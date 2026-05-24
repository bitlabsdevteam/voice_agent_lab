import { randomUUID } from "node:crypto";
import type { ConversationEvent, EventSink } from "../contracts/events";
import type { AuthContext } from "../contracts/session";
import type { SessionStore } from "../session/session-store";

export type HandoffReason =
  | "user_requested"
  | "agent_failed"
  | "outside_scope"
  | "high_risk"
  | "identity_failed"
  | "safety_policy";

export type HandoffPacket = {
  handoffId: string;
  sessionId: string;
  tenantId: string;
  userId: string;
  reason: HandoffReason;
  summary: string;
  verifiedIdentity: boolean;
  toolActions: Array<Record<string, unknown>>;
  openQuestions: string[];
  riskFlags: string[];
  transcriptExcerpt: Array<Pick<ConversationEvent, "type" | "occurredAt" | "payload">>;
  createdAt: string;
};

export class HandoffService {
  constructor(
    private readonly store: SessionStore,
    private readonly eventSink: EventSink
  ) {}

  async requestHandoff(input: {
    sessionId: string;
    reason: HandoffReason;
    summary: string;
    verifiedIdentity: boolean;
    openQuestions?: string[];
    riskFlags?: string[];
  }, auth: AuthContext): Promise<HandoffPacket> {
    const session = await this.store.get(input.sessionId);
    if (!session) {
      throw new Error("Unknown session");
    }
    if (session.tenantId !== auth.tenantId || session.userId !== auth.userId) {
      throw new Error("Cross-tenant or cross-user handoff denied");
    }

    const sessionEvents = (await this.eventSink.list())
      .filter((event) => event.sessionId === input.sessionId)
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
    const toolActions = sessionEvents
      .filter((event) => event.type === "tool.call.completed" || event.type === "tool.call.failed")
      .map((event) => event.payload);
    const packet: HandoffPacket = {
      handoffId: `handoff_${randomUUID()}`,
      sessionId: input.sessionId,
      tenantId: auth.tenantId,
      userId: auth.userId,
      reason: input.reason,
      summary: input.summary,
      verifiedIdentity: input.verifiedIdentity,
      toolActions,
      openQuestions: input.openQuestions ?? [],
      riskFlags: input.riskFlags ?? [],
      transcriptExcerpt: sessionEvents.slice(-10).map((event) => ({
        type: event.type,
        occurredAt: event.occurredAt,
        payload: event.payload
      })),
      createdAt: new Date().toISOString()
    };

    await this.eventSink.emit({
      eventId: randomUUID(),
      type: "handoff.requested",
      sessionId: input.sessionId,
      tenantId: auth.tenantId,
      occurredAt: packet.createdAt,
      payload: {
        handoffId: packet.handoffId,
        reason: packet.reason,
        riskFlags: packet.riskFlags
      }
    });

    return packet;
  }
}
