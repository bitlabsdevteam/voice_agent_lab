import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadRuntimeConfig, toSessionConfig, type RuntimeConfig } from "./config/voice-config";
import type { AuthContext, CreateVoiceSessionInput } from "./contracts/session";
import { createVoiceProvider } from "./providers/provider-factory";
import { InMemoryEventSink } from "./telemetry/in-memory-event-sink";
import { FileSessionStore } from "./session/file-session-store";
import { InMemorySessionStore, type SessionStore } from "./session/session-store";
import { SessionGateway } from "./session/session-gateway";
import { getReadiness } from "./health/readiness";

export type AppDependencies = {
  gateway: SessionGateway;
  eventSink: InMemoryEventSink;
  store: SessionStore;
  config: RuntimeConfig;
};

export function createAppDependencies(): AppDependencies {
  const config = loadRuntimeConfig();
  const eventSink = new InMemoryEventSink();
  const store = config.sessionStore === "file" ? new FileSessionStore(config.dataDir) : new InMemorySessionStore();
  const provider = createVoiceProvider(config.provider);
  const gateway = new SessionGateway(provider, store, eventSink, config);
  return { gateway, eventSink, store, config };
}

export function createApp(dependencies = createAppDependencies()) {
  return createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/health") {
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === "GET" && request.url === "/ready") {
        const readiness = getReadiness(dependencies.config, dependencies.store);
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
        sendJson(response, 200, { events: dependencies.eventSink.list() });
        return;
      }

      if (request.method === "POST" && request.url === "/api/voice/session") {
        const body = await readJson<CreateVoiceSessionInput>(request);
        const auth = parseAuth(request);
        const result = await dependencies.gateway.createSession(body, auth);
        sendJson(response, 201, result);
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
