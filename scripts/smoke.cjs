const { createAppDependencies } = require("../dist/src/app.js");

const environment = process.argv[2] || "local";
const deps = createAppDependencies();

async function main() {
  const readiness = require("../dist/src/health/readiness.js").getReadiness(deps.config, deps.store);
  if (!readiness.ok) {
    throw new Error(`Readiness failed: ${JSON.stringify(readiness.checks)}`);
  }

  const auth = {
    tenantId: `tenant_smoke_${environment}`,
    userId: `user_smoke_${environment}`,
    scopes: ["voice:session:create", "policy:read"]
  };

  const session = await deps.gateway.createSession(
    {
      channel: "test",
      tenantId: auth.tenantId,
      userId: auth.userId,
      consentState: "denied"
    },
    auth
  );

  await deps.gateway.connect(session.sessionId, auth);
  await deps.gateway.endSession(session.sessionId, auth);

  const events = deps.eventSink.list().map((event) => event.type);
  const required = ["session.created", "session.connected", "session.ended"];
  const missing = required.filter((eventType) => !events.includes(eventType));

  if (missing.length > 0) {
    throw new Error(`Smoke test missing events: ${missing.join(", ")}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        environment,
        provider: session.config.provider,
        modelId: session.config.modelId,
        promptVersion: session.config.promptVersion,
        sessionStore: deps.store.kind,
        sessionId: session.sessionId
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
