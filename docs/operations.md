# Operations Runbook

This runbook is the production operations baseline required by `AGENTS.md`. Do not approve a production release until every section below is current for the selected environment.

## Launch Blockers

- No production deploy without `npm run test:release`.
- No production deploy without staging and canary smoke tests.
- No production deploy without `npm run deploy:verify:local` or equivalent hosted-environment evidence.
- No production deploy without `npm run deploy:verify:remote` against the selected staging or production URL.
- No production deploy without `npm run deploy:check`.
- No production deploy without `npm run deploy:canary:<provider>`.
- No production deploy without `npm run deploy:check:production`.
- No production deploy without live provider smoke evidence for the selected provider.
- No production deploy without dashboard and alert artifacts matching the current metrics surface.
- No live provider secrets in browser logs, bundles, or test fixtures.
- No mutating tools until confirmation, idempotency, audit logging, and rollback are implemented.

## On-Call Ownership

- Primary owner: voice platform on-call.
- Secondary owner: application backend on-call.
- Escalation rule: page both owners if session creation, connection success, tenant isolation, or live tool auth regress.
- Severity rule: treat cross-tenant access, duplicate mutating tool execution, and secret exposure as immediate rollback incidents.

## Dashboard Links

- Local Grafana dashboard: `http://localhost:3001/d/voice-agent-production/voice-agent-production`.
- Prometheus query UI: `http://localhost:9090`.
- Dashboard source artifact: `infra/observability/grafana-dashboard.json`.
- Local deployment evidence: `release/deployment-evidence.json`.
- Remote deployment evidence: `release/remote-deployment-evidence.json`.

Track these panels during canary:

- Session creation and connection totals.
- Realtime connection success rate.
- Time-to-first-audio proxy p50/p95.
- Turn completion latency p50/p95.
- Tool call success rate.
- Barge-in cancellation p95.
- Guardrail triggers and handoff requests.

## Alert Definitions

Prometheus loads release-blocking alert rules from `infra/observability/alerts.yml`.

Critical alerts:

- `VoiceAgentInstanceDown`
- `VoiceAgentConnectionSuccessLow`
- `VoiceAgentTimeToFirstAudioHigh`
- `VoiceAgentTurnCompletionLatencyHigh`
- `VoiceAgentBargeInCancellationSlow`
- `VoiceAgentToolSuccessLow`
- `VoiceAgentGuardrailSpike`

Any critical alert firing during canary blocks rollout until the alert is resolved or the release is rolled back.

## Known Provider Failure Modes

OpenAI Realtime:

- Ephemeral client secret minting fails because backend API key is absent or revoked.
- Browser WebRTC session fails because the model, voice, or callback config is invalid.
- Session connects but tool events fail server-side because auth scopes or tenant state are missing.

ElevenLabs:

- Signed URL creation fails because the API key or agent ID is invalid.
- Browser WebSocket opens but upstream audio exchange fails because microphone permissions or agent config are broken.
- Provider-side rate limiting or quota exhaustion causes session startup failures.

Shared failure modes:

- Provider secrets accidentally exposed to the browser.
- Cross-tenant session resume or handoff caused by missing auth checks.
- File-backed local persistence configured in a multi-instance deployment by mistake.

## Live Provider Smoke

Run OpenAI:

```sh
npm run smoke:live:openai
npm run deploy:canary:openai
```

Run ElevenLabs:

```sh
npm run smoke:live:elevenlabs
npm run deploy:canary:elevenlabs
```

For a production release, the selected provider smoke output must include:

- `ok: true`
- `skipped: false`
- provider session ID or signed URL session ID metadata
- no browser-visible standard provider API key

If live smoke fails, do not deploy. If live smoke skips because credentials are absent, the release is not production-approved.

`deploy:canary:<provider>` is the required production proof because it refuses to pass when remote verification or live smoke is skipped.

## Manual Provider Failover

1. Disable new live traffic to the affected provider.
2. Switch `VOICE_AGENT_PROVIDER` to the fallback provider or to text-only/human handoff mode.
3. Redeploy the last known-good build or config artifact.
4. Run `npm run deploy:verify:remote` against the fallback environment.
5. Re-run the selected provider smoke command before restoring traffic.

Do not fail over to `mock-openai` for real users. Use mock mode only for internal smoke and CI.

## Prompt Rollback

1. Select the previous immutable prompt version from release records.
2. Set `VOICE_AGENT_PROMPT_VERSION` to the rollback target.
3. Redeploy without changing the database schema.
4. Run post-deploy smoke and compare latency plus guardrail panels to the prior canary.

## Model Rollback

1. Restore the previous explicit `VOICE_AGENT_MODEL`.
2. Confirm provider compatibility for the selected transport.
3. Redeploy the prior build or configuration artifact.
4. Re-run latency smoke, live provider smoke, and canary dashboard review before continuing rollout.

## Tool Disable

1. Remove tenant access to the affected tool or disable it behind a feature flag.
2. Verify server-side tool execution now rejects the tool call.
3. Check audit logs and `tool.call.failed` metrics for recovery.
4. Keep the provider online only if the remaining tool surface is safe.

## Tenant Disable

1. Remove the tenant from the allowlist or block session creation at auth.
2. Verify `/api/voice/session` denies the tenant.
3. Route active incidents to human handoff.
4. Preserve audit evidence and retention artifacts for investigation.

## Rollback

Rollback order:

1. Disable affected feature flag.
2. Roll back prompt/config version.
3. Roll back app build.
4. Disable affected tool.
5. Route traffic to text fallback or human handoff.
