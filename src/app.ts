import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadRuntimeConfig, toSessionConfig, type RuntimeConfig } from "./config/voice-config";
import type { AuthContext, CreateVoiceSessionInput } from "./contracts/session";
import { createVoiceProvider } from "./providers/provider-factory";
import { InMemoryEventSink } from "./telemetry/in-memory-event-sink";
import { FileEventSink } from "./telemetry/file-event-sink";
import { PostgresEventSink } from "./telemetry/postgres-event-sink";
import { collectMetrics, renderPrometheusMetrics } from "./telemetry/metrics";
import { FileSessionStore } from "./session/file-session-store";
import { InMemorySessionStore, type SessionStore } from "./session/session-store";
import { PostgresSessionStore } from "./session/postgres-session-store";
import { SessionGateway } from "./session/session-gateway";
import { getReadiness } from "./health/readiness";
import { lookupPolicyTool } from "./tools/policy-tool";
import { ToolService } from "./tools/tool-service";
import { RealtimeToolHandler, type RealtimeToolRequest } from "./agent/realtime-tool-handler";
import { HandoffService, type HandoffReason } from "./handoff/handoff-service";
import { RetentionService } from "./retention/retention-service";
import type { EventSink } from "./contracts/events";
import { PostgresDatabase } from "./db/postgres";

export type AppDependencies = {
  gateway: SessionGateway;
  eventSink: EventSink;
  store: SessionStore;
  config: RuntimeConfig;
  realtimeToolHandler: RealtimeToolHandler;
  handoffService: HandoffService;
  retentionService: RetentionService;
};

export type AppDependencyOptions = {
  config?: RuntimeConfig;
};

export function createAppDependencies(options: AppDependencyOptions = {}): AppDependencies {
  const config = options.config ?? loadRuntimeConfig();
  const database = config.sessionStore === "postgres" || config.eventSink === "postgres" ? createPostgresDatabase(config) : undefined;
  const eventSink =
    config.eventSink === "postgres"
      ? new PostgresEventSink(requiredDatabase(database))
      : config.eventSink === "file"
        ? new FileEventSink(config.dataDir)
        : new InMemoryEventSink();
  const store =
    config.sessionStore === "postgres"
      ? new PostgresSessionStore(requiredDatabase(database))
      : config.sessionStore === "file"
        ? new FileSessionStore(config.dataDir)
        : new InMemorySessionStore();
  const provider = createVoiceProvider(config.provider);
  const gateway = new SessionGateway(provider, store, eventSink, config);
  const toolService = new ToolService([lookupPolicyTool], eventSink);
  const realtimeToolHandler = new RealtimeToolHandler(store, toolService);
  const handoffService = new HandoffService(store, eventSink);
  const retentionService = new RetentionService(store, eventSink);
  return { gateway, eventSink, store, config, realtimeToolHandler, handoffService, retentionService };
}

function createPostgresDatabase(config: RuntimeConfig): PostgresDatabase {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is required when using postgres session store or event sink");
  }
  return new PostgresDatabase(config.databaseUrl);
}

function requiredDatabase(database: PostgresDatabase | undefined): PostgresDatabase {
  if (!database) {
    throw new Error("Postgres database was not initialized");
  }
  return database;
}

export function createApp(dependencies = createAppDependencies()) {
  return createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/health") {
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === "GET" && request.url === "/ready") {
        const readiness = getReadiness(dependencies.config, dependencies.store, dependencies.eventSink);
        sendJson(response, readiness.ok ? 200 : 503, readiness);
        return;
      }

      if (request.method === "GET" && request.url === "/api/voice/config") {
        sendJson(response, 200, {
          config: toSessionConfig(dependencies.config),
          warning: "Client config is safe to expose. Provider API keys never leave the backend."
        });
        return;
      }

      if (request.method === "GET" && request.url === "/api/voice/events") {
        sendJson(response, 200, { events: await dependencies.eventSink.list() });
        return;
      }

      if (request.method === "GET" && request.url === "/metrics") {
        sendText(response, 200, "text/plain; version=0.0.4", renderPrometheusMetrics(await collectMetrics(dependencies.eventSink)));
        return;
      }

      if (request.method === "POST" && request.url === "/api/voice/session") {
        const body = await readJson<CreateVoiceSessionInput>(request);
        const auth = parseAuth(request);
        const result = await dependencies.gateway.createSession(body, auth);
        sendJson(response, 201, result);
        return;
      }

      if (request.method === "POST" && request.url === "/api/realtime/tool") {
        const body = await readJson<RealtimeToolRequest>(request);
        const auth = parseAuth(request);
        const result = await dependencies.realtimeToolHandler.handleToolRequest(body, auth);
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && request.url === "/api/handoff") {
        const body = await readJson<{
          sessionId: string;
          reason: HandoffReason;
          summary: string;
          verifiedIdentity: boolean;
          openQuestions?: string[];
          riskFlags?: string[];
        }>(request);
        const auth = parseAuth(request);
        const result = await dependencies.handoffService.requestHandoff(body, auth);
        sendJson(response, 201, result);
        return;
      }

      if (request.method === "POST" && request.url === "/admin/retention/purge") {
        const auth = parseAuth(request);
        assertAdmin(auth);
        const result = await dependencies.retentionService.purgeExpiredEvents(
          new Date(),
          dependencies.config.transcriptRetentionDays
        );
        sendJson(response, 200, result);
        return;
      }

      const staticResult = tryServeStatic(request, response);
      if (staticResult) {
        return;
      }

      sendJson(response, 404, { error: "not_found" });
    } catch (error) {
      sendJson(response, 400, {
        error: "bad_request",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}

function assertAdmin(auth: AuthContext): void {
  if (!auth.scopes.includes("admin:retention")) {
    throw new Error("Missing required scope: admin:retention");
  }
}

function tryServeStatic(request: IncomingMessage, response: ServerResponse): boolean {
  if (request.method !== "GET") {
    return false;
  }

  const path = request.url === "/" ? "/index.html" : request.url;
  if (!path || !["/index.html", "/app.js", "/styles.css"].includes(path)) {
    return false;
  }

  const filePath = join(process.cwd(), "public", path.slice(1));
  if (!existsSync(filePath)) {
    return false;
  }

  response.statusCode = 200;
  response.setHeader("content-type", contentTypeFor(path));
  response.end(readFileSync(filePath, "utf8"));
  return true;
}

function contentTypeFor(path: string): string {
  if (path.endsWith(".js")) {
    return "application/javascript";
  }
  if (path.endsWith(".css")) {
    return "text/css";
  }
  return "text/html";
}

function parseAuth(request: IncomingMessage): AuthContext {
  const tenantId = singleHeader(request.headers["x-tenant-id"]);
  const userId = singleHeader(request.headers["x-user-id"]);
  const scopes = singleHeader(request.headers["x-scopes"]);

  if (!tenantId || !userId) {
    throw new Error("Missing tenant or user header");
  }

  return {
    tenantId,
    userId,
    scopes: scopes ? scopes.split(" ").filter(Boolean) : []
  };
}

function singleHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
}

function sendText(response: ServerResponse, statusCode: number, contentType: string, body: string): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", contentType);
  response.end(body);
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: string[] = [];
  request.on("data", (chunk: unknown) => {
    chunks.push(String(chunk));
  });

  return new Promise<T>((resolve, reject) => {
    request.on("end", () => {
      try {
        resolve(JSON.parse(chunks.join("") || "{}") as T);
      } catch (error) {
        reject(error);
      }
    });
  });
}
