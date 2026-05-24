# Deployment

This service can run as a Node process or container. The default container uses a file-backed session store at `/data` so session metadata survives process restarts when `/data` is mounted to persistent storage.

## Required Production Environment

```text
NODE_ENV=production
PORT=3000
VOICE_AGENT_PROVIDER=openai
VOICE_AGENT_MODEL=gpt-realtime-2
VOICE_AGENT_PROMPT_VERSION=voice-agent-v1
VOICE_AGENT_SESSION_STORE=file
VOICE_AGENT_EVENT_SINK=file
VOICE_AGENT_DATA_DIR=/data
DATABASE_URL=postgres://...
OPENAI_API_KEY=...
```

For ElevenLabs managed-agent mode:

```text
VOICE_AGENT_PROVIDER=elevenlabs
VOICE_AGENT_SESSION_STORE=file
VOICE_AGENT_EVENT_SINK=file
VOICE_AGENT_DATA_DIR=/data
DATABASE_URL=postgres://...
ELEVENLABS_API_KEY=...
ELEVENLABS_AGENT_ID=agent_...
```

## Required Checks

Run before rollout:

```sh
npm run test:release
npm run smoke:local
npm run smoke:live:openai
npm run smoke:live:elevenlabs
npm run deploy:verify:local
npm run deploy:verify:remote
npm run deploy:canary:openai
npm run deploy:canary:elevenlabs
npm run release:manifest
npm run deploy:check
npm run deploy:check:production
```

The live smoke commands skip safely when credentials are not present. For production release evidence, they must run with real provider credentials and report `skipped: false`.

`npm run deploy:verify:local` starts the built service on an ephemeral local port, probes `/health`, `/ready`, `/metrics`, static UI, and client config, then writes `release/deployment-evidence.json`.

`npm run deploy:verify:remote` probes a real deployed base URL when `DEPLOYMENT_BASE_URL` is set and writes `release/remote-deployment-evidence.json`. This is the required hosted-environment evidence path for staging or production.

`npm run deploy:canary:<provider>` is the strict production canary path. It runs the hosted deployment verification plus the selected provider live smoke, then writes `release/production-canary-evidence.json`. This command fails if either step is skipped.

`npm run deploy:check:production` is the strict approval gate. It validates the standard deployment artifacts and refuses production approval unless `release/production-canary-evidence.json`, `release/remote-deployment-evidence.json`, and `release/live-smoke-<provider>.json` all exist with `ok: true` and `skipped: false`.

After deploy, call:

```text
GET /health
GET /ready
```

`/ready` must return `200` before the instance receives traffic.

## Local Production-Like Stack

Run:

```sh
docker compose up --build
```

This starts:

- Voice agent service.
- Postgres with the initial schema from `infra/postgres`.
- Redis for rate limits, idempotency locks, and short-lived event buffers.
- Prometheus scraping `/metrics`.
- Prometheus alert rules from `infra/observability/alerts.yml`.
- Grafana at `http://localhost:3001` with the provisioned `Voice Agent Production` dashboard.

The default container uses file-backed persistence so it can run without external services. For multi-instance production, switch to:

```text
VOICE_AGENT_SESSION_STORE=postgres
VOICE_AGENT_EVENT_SINK=postgres
DATABASE_URL=postgres://...
```

The Postgres schema in `infra/postgres` contains the durable session, event, and tool-audit tables required by the runtime store and event sink.

## Metrics

Prometheus metrics are available at:

```text
GET /metrics
```

The endpoint currently exposes session, tool-call, guardrail, and handoff counters derived from emitted conversation events.
It also exposes derived gauges for connection success rate, tool success rate, time-to-first-audio proxy p50/p95, turn completion p50/p95, barge-in cancellation p95, and session duration p95.

Grafana is provisioned automatically in the local stack and loads its dashboard definition from `infra/observability/grafana-dashboard.json`.

## Retention

Configure transcript/event retention:

```text
VOICE_AGENT_TRANSCRIPT_RETENTION_DAYS=30
```

Run cleanup with an admin-scoped request:

```text
POST /admin/retention/purge
x-scopes: admin:retention
```

File-backed and Postgres-backed event sinks both support retention cleanup now. The Postgres path deletes expired and ephemeral-session events directly in SQL instead of rewriting the whole event table.

## Rollback

Rollback must restore:

- App build.
- Prompt version.
- Provider config.
- Session-store configuration.
- Feature flags.

If live voice traffic fails, switch `VOICE_AGENT_PROVIDER` back to `mock-openai` only for internal smoke testing, not for customer traffic. Customer traffic should be routed to human handoff or text fallback.
