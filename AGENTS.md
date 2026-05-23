# AGENTS.md

## Purpose

This repository is for designing and building a production-grade voice agent from scratch. The target quality bar is an OpenAI-style production system: low latency, robust turn-taking, clear tool boundaries, strong safety controls, measurable quality, observable runtime behavior, and deployable operational procedures.

Use this document as the source of truth for architecture, implementation standards, provider choices, testing, deployment, and future agent work in this repo.

Last reviewed against public provider docs: 2026-05-24.

## Production Readiness Definition

The final system is production-ready only when it can be deployed, monitored, tested, rolled back, and operated without relying on developer intuition or manual inspection. A working demo is not production-ready.

Production-ready means:

- The voice agent runs in at least `dev`, `staging`, and `production` environments with separate secrets, databases, provider credentials, callback URLs, and telemetry streams.
- Every model, voice, prompt, tool schema, retrieval corpus, and safety policy is versioned and recoverable.
- Every release passes automated unit, integration, contract, end-to-end, safety, latency, load, and regression eval gates.
- Every critical runtime path emits structured events, traces, metrics, and provider request/session IDs.
- Every mutating tool has authorization, validation, idempotency, audit logging, user confirmation rules, and rollback or compensation behavior.
- Every production deploy supports canary rollout, fast rollback, and post-deploy health verification.
- Every incident has enough logs, traces, transcripts, and event history to reconstruct what happened without exposing unnecessary raw audio.
- Every user-facing failure has a safe fallback: retry, clarification, text mode, human handoff, or graceful session termination.

Release-blocking rule: if a behavior cannot be tested automatically or audited from production telemetry, do not treat it as production-ready.

## Product Definition

A voice agent is a realtime or near-realtime conversational system that listens to user speech, understands the user's intent, optionally calls tools or business systems, and responds naturally with speech. The system must feel interruptible, fast, trustworthy, and context-aware.

The first production target should be one of these:

- Customer support agent that can answer policy questions, inspect account/order state through tools, create tickets, and hand off to a human.
- Sales or onboarding agent that qualifies intent, captures structured details, schedules follow-up, and summarizes calls.
- Personal assistant agent that can answer questions, take notes, trigger workflows, and maintain short-lived conversational context.

Do not build a generic demo assistant as the production target. Pick a narrow domain, define success criteria, and keep the agent's tool surface small.

## Source Baseline

Use the provider docs as living references before implementing or changing model/provider behavior:

- OpenAI voice agents: https://developers.openai.com/api/docs/guides/voice-agents
- OpenAI realtime prompting: https://developers.openai.com/api/docs/guides/realtime-models-prompting
- OpenAI models: https://developers.openai.com/api/docs/models
- OpenAI realtime model: https://developers.openai.com/api/docs/models/gpt-realtime-2
- ElevenLabs models: https://elevenlabs.io/docs/overview/models
- ElevenLabs agents: https://elevenlabs.io/docs/eleven-agents/overview
- ElevenLabs WebSocket agents: https://elevenlabs.io/docs/eleven-agents/libraries/web-sockets

Before a release, re-check all model IDs, feature names, rate limits, pricing, and safety requirements. Model availability and provider recommendations change.

## Recommended Model Strategy

### Default OpenAI-First Architecture

Use OpenAI `gpt-realtime-2` through the Realtime API for the default speech-to-speech path. This is the preferred architecture when the goal is a natural, low-latency voice agent with realtime interruption, voice activity detection, live audio input/output, and tool use in one session.

Recommended default:

- Primary realtime model: `gpt-realtime-2`
- SDK path: OpenAI Agents SDK for TypeScript with `RealtimeAgent` and `RealtimeSession`
- Browser transport: WebRTC
- Server-side or telephony transport: WebSocket or SIP, depending on channel
- Client auth: short-lived ephemeral token minted by the backend
- Tool execution: server-side only
- Persistence: transcript, summaries, structured events, tool calls, and evaluation labels

### OpenAI Chained Architecture

Use a chained pipeline when deterministic control is more important than natural speech-to-speech behavior.

Pipeline:

1. Streaming STT
2. Text LLM reasoning and tool planning
3. Streaming TTS
4. Playback with interruption handling

Use this when:

- You already have a mature text agent.
- You need explicit transcript-first compliance review.
- You need deterministic intermediate text transformations.
- You need to combine OpenAI reasoning with a specialized external TTS provider.
- You need provider-level fallback for each stage.

Recommended OpenAI chained choices:

- Reasoning/orchestration model: use the strongest current GPT model for complex agentic decisions, with a cheaper mini model for classification and routing.
- Speech-to-text: use the current OpenAI transcription model listed in docs for the required language, latency, and diarization needs.
- Speech generation: use OpenAI speech generation for simple unified-provider deployment, or ElevenLabs for premium voice quality and voice library needs.

### ElevenLabs-First Voice Layer

Use ElevenLabs when premium speech synthesis, branded voices, multilingual voice assets, or ElevenLabs' managed agent platform are the dominant requirements.

Recommended choices:

- Best expressive TTS: Eleven v3.
- Fast realtime TTS: Eleven Flash v2.5.
- Stable long-form TTS: Eleven Multilingual v2.
- ElevenLabs managed agent path: ElevenAgents.
- Direct low-latency integration path: ElevenLabs WebSocket streaming.

Use ElevenLabs as:

- A standalone managed voice-agent provider through ElevenAgents.
- The TTS component in a chained OpenAI text agent.
- A fallback or premium voice option selected by tenant, language, or channel.

### Provider Selection Matrix

| Requirement | Recommended Path |
| --- | --- |
| Lowest complexity browser voice MVP | OpenAI Agents SDK + `RealtimeAgent` + `gpt-realtime-2` |
| Most natural live speech-to-speech | OpenAI Realtime API with WebRTC |
| Telephony or server-controlled sessions | OpenAI Realtime WebSocket/SIP or ElevenLabs agents with signed URLs |
| Explicit transcript-first control | Chained STT -> LLM -> TTS |
| Premium branded voice | OpenAI LLM + ElevenLabs TTS |
| Highest emotional voice synthesis | Eleven v3 |
| Lowest TTS latency with ElevenLabs | Eleven Flash v2.5 |
| Compliance-heavy workflows | Chained architecture with transcript, review, and human handoff |
| High-volume cost-sensitive routing | Classifier + cheaper model fallback + cached retrieval + constrained tool use |

## Target Architecture

### High-Level Components

The production system must be split into these layers:

- Client application: captures microphone input, plays audio output, renders call state, exposes push-to-talk or hands-free mode, shows fallback text UI, and handles consent.
- Realtime session gateway: creates short-lived session credentials, enforces tenant/user authorization, configures model/session settings, and hides provider secrets from clients.
- Agent runtime: owns instructions, tool definitions, handoffs, guardrails, memory policy, and provider abstraction.
- Tool service layer: exposes typed, auditable, idempotent business actions to the agent.
- Knowledge layer: retrieves approved domain content and returns citations or source IDs to the agent.
- Conversation state service: stores session metadata, structured transcript, tool calls, summaries, consent, and retention state.
- Safety and policy layer: handles content checks, PII rules, tool risk scoring, escalation conditions, and blocked-action behavior.
- Observability layer: traces latency, model events, audio events, tool calls, user outcomes, errors, cost, and quality labels.
- Evaluation layer: runs scripted conversations, regression tests, safety tests, latency tests, and production review sampling.
- Admin and operations layer: manages prompts, tools, release versions, tenant settings, voice profiles, rate limits, dashboards, and incident response.

### Reference Diagram

```text
User
  |
  | microphone / speaker
  v
Client App
  |  WebRTC for browser, WebSocket/SIP for server or telephony
  v
Session Gateway
  |  mints ephemeral credentials, validates tenant/user, applies config
  v
Agent Runtime
  |-- Instructions and voice policy
  |-- Turn-taking and interruption behavior
  |-- Tool registry and handoff logic
  |-- Guardrails and refusal policy
  |
  | realtime audio session
  v
Model Provider
  |-- OpenAI Realtime speech-to-speech
  |-- or chained STT -> LLM -> TTS
  |-- optional ElevenLabs TTS / ElevenAgents
  |
  +--> Tool Service Layer
  |      |-- CRM, ticketing, scheduling, orders, billing
  |      |-- strict schemas, authz, idempotency, audit log
  |
  +--> Knowledge Layer
  |      |-- vector search, keyword search, policy docs
  |      |-- retrieved snippets with source IDs
  |
  +--> Safety Layer
  |      |-- PII controls, action risk gates, escalation
  |
  v
Conversation Store + Event Stream + Metrics
  |
  v
Dashboards, Evals, QA Review, Incident Response
```

### Speech-to-Speech Flow

Use this flow for OpenAI Realtime-first builds:

1. User opens the client and grants microphone permission.
2. Client requests a session from the backend.
3. Backend authenticates the user, checks entitlements, creates an ephemeral OpenAI session credential, stores session metadata, and returns safe client config.
4. Client establishes WebRTC to OpenAI for browser use, or the server establishes WebSocket/SIP for controlled environments.
5. Client streams input audio.
6. Realtime model performs VAD, turn detection, language understanding, response planning, and audio output.
7. Agent calls tools through server-side handlers only.
8. Tool service validates authorization, schema, idempotency key, policy, and side-effect risk.
9. Agent returns spoken response and optionally structured state updates.
10. Event stream records audio lifecycle events, transcript events, tool calls, errors, latency, cost, and final summary.

### Chained Flow

Use this flow when explicit control is required:

1. User audio is streamed to STT.
2. STT partials are buffered for UI display, endpointing, and confidence checks.
3. Final transcript is normalized and passed to the text agent.
4. Text agent retrieves knowledge, calls tools, and generates a response plan.
5. Response is split into short speakable chunks.
6. TTS begins streaming audio from the first safe chunk.
7. Playback manager handles barge-in, cancellation, and audio queue flushing.
8. Conversation store records audio metadata, text transcript, model response, tool calls, and summaries.

## Repository Structure To Build Toward

Prefer this structure unless a framework-specific convention requires a change:

```text
.
|-- AGENTS.md
|-- README.md
|-- docs/
|   |-- architecture.md
|   |-- safety.md
|   |-- evals.md
|   |-- operations.md
|   `-- provider-matrix.md
|-- apps/
|   |-- web/
|   `-- admin/
|-- services/
|   |-- session-gateway/
|   |-- agent-runtime/
|   |-- tool-service/
|   |-- knowledge-service/
|   `-- eval-runner/
|-- packages/
|   |-- agent-config/
|   |-- provider-openai/
|   |-- provider-elevenlabs/
|   |-- audio-client/
|   |-- telemetry/
|   `-- schemas/
|-- prompts/
|   |-- voice-agent.md
|   |-- safety.md
|   `-- handoff.md
|-- evals/
|   |-- scripted-calls/
|   |-- adversarial/
|   |-- latency/
|   `-- fixtures/
|-- infra/
|   |-- docker/
|   |-- terraform/
|   `-- observability/
`-- scripts/
```

## Implementation Standards

### Language And Stack

Default to TypeScript for the first production implementation because browser voice, WebRTC, the OpenAI TypeScript Agents SDK, and frontend/admin tooling are first-class concerns.

Recommended baseline:

- Frontend: Next.js or Vite React with strict TypeScript.
- Backend: Node.js with Fastify, Hono, or Next.js route handlers for early MVP; split services later if needed.
- Runtime validation: Zod or Valibot for all tool schemas and provider event payloads.
- Database: Postgres for durable state.
- Cache/queue: Redis for session coordination, rate limits, and short-lived event buffers.
- Object storage: audio recordings only when explicitly needed and consented.
- Observability: OpenTelemetry traces, structured logs, metrics, and provider event IDs.
- Evals: Vitest/Jest for unit tests, Playwright for browser flows, scripted conversation runner for agent behavior.

Python is acceptable for eval tooling, offline analysis, or ML-heavy audio processing, but keep the realtime app path TypeScript-first unless there is a clear reason not to.

### Coding Rules

- Keep provider SDK calls behind interfaces. Do not scatter OpenAI or ElevenLabs calls through product code.
- Treat all model outputs as untrusted. Validate tool arguments before execution.
- Keep prompts versioned in files or database records with immutable release IDs.
- Use typed event envelopes for all realtime events.
- Make tool calls idempotent when they can mutate state.
- Store enough trace data to replay failures without storing unnecessary sensitive audio.
- Design every tool with authorization, audit logging, and rollback behavior.
- Do not expose provider API keys to the browser. Use ephemeral session credentials or signed URLs.
- Prefer small, composable services over a monolith once the MVP shape is proven.

## Core Domain Contracts

### Session

A session represents one voice interaction.

Required fields:

- `session_id`
- `tenant_id`
- `user_id` or anonymous subject ID
- `channel`: `web`, `mobile`, `phone`, `sip`, or `test`
- `provider`: `openai`, `elevenlabs`, or `hybrid`
- `model_id`
- `voice_id`
- `prompt_version`
- `started_at`
- `ended_at`
- `consent_state`
- `retention_policy`
- `status`
- `failure_reason`

### Conversation Event

Every meaningful runtime action should be logged as an event.

Event types:

- `session.created`
- `session.connected`
- `audio.input.started`
- `audio.input.stopped`
- `turn.detected`
- `transcript.partial`
- `transcript.final`
- `agent.response.started`
- `agent.response.audio.delta`
- `agent.response.completed`
- `agent.response.cancelled`
- `tool.call.requested`
- `tool.call.completed`
- `tool.call.failed`
- `guardrail.triggered`
- `handoff.requested`
- `session.ended`

### Tool Definition

Every tool must define:

- Name and plain-language purpose.
- Strict JSON schema.
- Read-only or mutating classification.
- Required auth scopes.
- Risk level: `low`, `medium`, `high`, or `critical`.
- Timeout.
- Idempotency key behavior.
- User confirmation requirement.
- Audit fields.
- Safe failure message.
- Test fixtures.

Example:

```ts
type ToolRisk = "low" | "medium" | "high" | "critical";

type VoiceAgentTool = {
  name: string;
  description: string;
  inputSchema: unknown;
  risk: ToolRisk;
  mutatesState: boolean;
  requiresUserConfirmation: boolean;
  timeoutMs: number;
  execute: (input: unknown, context: ToolContext) => Promise<ToolResult>;
};
```

## Prompt And Instruction Design

### System Prompt Requirements

The voice agent prompt must include:

- Role and task boundaries.
- Target user experience and tone.
- Domain-specific policy.
- Tool-use rules.
- Confirmation rules before side effects.
- How to handle uncertainty.
- How to escalate.
- How to handle interruptions.
- Privacy and sensitive-data behavior.
- Language and accessibility behavior.
- Concise speaking style.

### Voice Prompt Style

Voice output is not text chat. Optimize for spoken comprehension:

- Use short sentences.
- Ask one question at a time.
- Avoid long enumerations unless requested.
- Confirm critical details by repeating them.
- Do not read raw IDs unless necessary.
- Use natural repair phrases when interrupted.
- Avoid filler, rambling, and excessive apologies.
- Prefer "I can help with that. First..." over a paragraph of explanation.

### Tool Prompt Rules

The agent must:

- Use tools for private, account-specific, or dynamic data.
- Never invent order status, appointment availability, prices, or policy exceptions.
- Confirm before any irreversible or externally visible action.
- Summarize tool results in user-friendly language.
- Hide internal tool names, stack traces, and provider details from users.
- Escalate when policy, confidence, or authorization is insufficient.

## Turn-Taking And Audio Behavior

Turn-taking quality decides whether the system feels production-grade.

Implement and test:

- Barge-in: user can interrupt agent speech and the agent stops promptly.
- Endpointing: agent waits through natural pauses but does not hang indefinitely.
- Backchannels: brief acknowledgements are allowed only when helpful.
- Silence timeout: agent checks in after a configurable period.
- No-input timeout: end or transfer after repeated silence.
- Double-talk handling: avoid speaking over the user.
- Playback cancellation: clear queued TTS/audio when interrupted.
- Noise resilience: detect low-confidence input and ask a concise clarification.
- Latency budget: track time to first audio, full response time, and interruption latency.

Recommended latency targets:

- Time to first audio for realtime path: under 700 ms where network and provider conditions allow.
- Tool-free turn completion: under 2 seconds for common queries.
- Tool-backed turn first acknowledgement: under 1 second, with final answer after tool completion.
- Barge-in stop: under 300 ms from detected interruption.

These are product targets, not guaranteed provider SLAs. Measure in the deployed environment.

## Safety, Privacy, And Compliance

### Data Handling

- Ask for recording consent when storing audio.
- Default to storing transcripts and structured events, not raw audio.
- Redact or tokenize sensitive values where possible.
- Separate tenant data by tenant ID at every persistence boundary.
- Define retention periods for audio, transcripts, summaries, and traces.
- Encrypt data in transit and at rest.
- Restrict production transcript/audio access to audited roles.
- Provide deletion/export workflows if the product requires them.

### User Safety

The agent must not:

- Provide professional advice beyond approved content for medical, legal, financial, or emergency situations.
- Pretend to be human.
- Perform high-risk actions without confirmation and authorization.
- Continue a conversation when the user asks to stop.
- Collect unnecessary sensitive data.
- Bypass identity verification for account-specific requests.

The agent must:

- Identify itself as an AI voice agent when appropriate or legally required.
- Escalate emergencies and regulated scenarios to approved channels.
- Use human handoff for repeated failure, user frustration, policy uncertainty, or high-risk requests.

### Tool Safety

Apply risk gates:

- Low risk: read-only lookup, FAQ retrieval, status checks.
- Medium risk: create draft ticket, update preferences, schedule tentative appointment.
- High risk: cancel order, issue refund, change address, submit application.
- Critical risk: payments, legal commitments, healthcare decisions, credential/security changes.

High and critical tools require explicit confirmation, audit logging, and often human review.

## Observability

A production voice agent must be observable at the level of a single turn.

Capture:

- Session ID, tenant ID, channel, region, model, voice, prompt version.
- Audio transport lifecycle.
- VAD/turn events.
- Transcript partials and finals when available.
- Model response item IDs.
- Tool call input/output summaries.
- Guardrail triggers.
- Error type and provider request IDs.
- Token/audio usage and cost estimate.
- Latency breakdown.
- User outcome labels.
- Handoff reason.

Core metrics:

- Connection success rate.
- Session start failure rate.
- Time to first audio.
- Turn latency p50/p95/p99.
- Barge-in success rate.
- Tool success/failure rate.
- Human handoff rate.
- Containment/resolution rate.
- User retry/rephrase rate.
- Silence timeout rate.
- Safety trigger rate.
- Cost per session and cost per resolved task.

Do not rely only on logs. Add traces and dashboards before a beta launch.

## Evaluation Strategy

Testing is the most important production requirement. Build tests before expanding the agent scope, and block releases when tests do not prove the changed behavior is safe.

The test system must cover normal software correctness and voice-agent-specific behavior:

- Deterministic code behavior.
- Provider integration contracts.
- Realtime audio session lifecycle.
- Prompt and model behavior.
- Tool safety.
- Turn-taking and interruption.
- Latency and load.
- Privacy and security.
- Deployment and rollback.
- Human review workflows.

Do not rely on "I tried a call and it sounded good." Manual calls are useful exploration, not release evidence.

### Testing Pyramid

Use this testing pyramid:

| Layer | Purpose | Runs |
| --- | --- | --- |
| Static checks | Type safety, linting, formatting, dependency audit, secret scanning | Every commit |
| Unit tests | Pure functions, schemas, event reducers, prompt assembly, tool validation | Every commit |
| Contract tests | Provider adapters, tool APIs, webhook payloads, database schema expectations | Every PR |
| Integration tests | Session creation, auth, tool execution, storage, retrieval, telemetry | Every PR |
| Realtime simulation tests | Audio event flow, VAD assumptions, barge-in, cancellation, timeouts | Every PR for voice changes |
| End-to-end tests | Browser microphone permission mocks, WebRTC/session connection, text fallback, admin flows | Every PR for app changes |
| Agent evals | Scripted conversations, safety cases, tool-use correctness, regression scenarios | Every PR for prompt/model/tool changes |
| Load tests | Concurrent sessions, provider rate-limit behavior, queueing, database pressure | Before release and weekly |
| Canary verification | Production smoke tests on limited traffic | Every production deploy |
| Human QA review | Sampled calls scored with rubric | Beta and production release review |

### Required Test Commands

When the repository is implemented, define these commands and keep them stable:

```text
npm run typecheck
npm run lint
npm run format:check
npm run test:unit
npm run test:contract
npm run test:integration
npm run test:e2e
npm run test:evals
npm run test:latency
npm run test:load
npm run test:security
npm run test:release
```

`npm run test:release` must run every release-blocking test that can run without production credentials. Production-only canary checks run after deployment.

### Required Eval Suites

- Golden path calls: scripted successful conversations.
- Tool correctness: every tool call uses valid schema and correct auth context.
- Policy compliance: regulated or disallowed requests are refused or escalated.
- Interruption: user interrupts while agent is speaking.
- Ambiguity: user gives incomplete or unclear information.
- Noisy transcript: missing words, homophones, names, numbers, accents.
- Long conversation: context remains stable without prompt drift.
- Multilingual: if supported, language detection and response language are correct.
- Latency: synthetic and live network measurements.
- Regression: prompts and model/provider versions do not break known scenarios.
- Handoff: user-requested and policy-triggered transfer produces a complete handoff packet.
- Provider fallback: degraded provider paths behave safely and do not duplicate side effects.
- Retrieval grounding: policy answers use approved source material and do not invent unsupported claims.
- PII handling: sensitive values are redacted, retained, or deleted according to policy.
- Deployment smoke: deployed build can create a session, connect, execute a read-only tool, and end cleanly.

### Unit Test Requirements

Unit tests must cover:

- All schema validators.
- Tool input normalization and rejection cases.
- Idempotency key creation.
- Authorization helper behavior.
- Prompt assembly and prompt version selection.
- Event envelope parsing.
- Conversation state reducers.
- Cost calculation helpers.
- Retention policy decisions.
- Redaction and PII detection utilities.
- Error classification and safe user-facing error messages.

Minimum bar:

- 90% line coverage for provider-independent packages.
- 100% coverage for tool authorization helpers, idempotency helpers, and redaction functions.
- No untested high-risk tool path.

### Contract Test Requirements

Contract tests must prove that internal code and external boundaries agree.

Test:

- OpenAI provider adapter maps provider events into internal event envelopes.
- ElevenLabs provider adapter maps provider events into internal event envelopes.
- Tool service accepts only documented schemas.
- Webhook handlers reject invalid signatures.
- Database migrations match expected tables, indexes, constraints, and enum values.
- Session gateway rejects expired, missing, or cross-tenant credentials.
- Admin API cannot publish an invalid prompt/tool/model config.

Provider contract tests should use recorded fixtures when possible. Live provider contract tests should run in a separate CI job with restricted credentials and strict spend limits.

### Integration Test Requirements

Integration tests must run against real local infrastructure where practical:

- Local Postgres or test database.
- Local Redis or queue substitute.
- Provider adapters in mock mode by default.
- Tool service with fake downstream systems.
- OpenTelemetry exporter in test mode.

Required scenarios:

- Create session -> connect -> receive first model event -> end session.
- Read-only tool call succeeds and is audited.
- Mutating tool requires confirmation before execution.
- Failed tool returns safe speech text and structured error.
- User interruption cancels pending response and clears queued audio.
- Silence timeout triggers the configured prompt.
- Session summary is generated and persisted.
- Retention job removes expired records.
- Tenant A cannot read Tenant B data.
- Handoff packet contains the required fields.

### Realtime Audio Test Requirements

Voice agents fail in places normal chatbots do not. Add dedicated tests for:

- Barge-in while the agent is speaking.
- Barge-in while a tool is running.
- User silence at start of call.
- User silence after agent asks a question.
- Noisy input and partial transcript correction.
- Fast user correction: "No, I said Tuesday."
- User changes intent mid-turn.
- Agent starts speaking, then receives a cancellation event.
- Audio output queue is flushed after cancellation.
- Duplicate provider events do not create duplicate tool calls.

Use deterministic audio fixtures for regression tests. Keep fixtures small and labeled by scenario, language, accent if relevant, transcript expectation, and expected agent behavior.

### Agent Eval Requirements

Every scripted eval must define:

- User goal.
- Starting account/domain state.
- Conversation script or simulator behavior.
- Expected tool calls.
- Forbidden tool calls.
- Expected final outcome.
- Safety expectations.
- Latency expectation if relevant.
- Pass/fail grader.

Use a mix of deterministic assertions and model-graded review. Do not use model-graded review as the only gate for high-risk behaviors.

Release-blocking eval thresholds:

- 100% pass rate for critical safety evals.
- 100% pass rate for tool authorization evals.
- 100% pass rate for no-secret/no-cross-tenant tests.
- At least 95% pass rate for golden path task completion.
- No regression in p95 latency greater than 15% without explicit approval.
- No unresolved high-severity human QA finding.

### Human Review Rubric

Score each sampled call:

- Task success.
- Correctness.
- Safety.
- Tool appropriateness.
- Conversation naturalness.
- Latency perception.
- Interruption handling.
- Escalation correctness.
- Privacy compliance.
- User frustration signals.

Any release that changes model, prompt, tools, VAD, provider, transport, retrieval, auth, storage, or deployment config must run the relevant eval subset. If the changed area has no eval, add the eval before shipping.

### Test Data Requirements

Maintain test fixtures for:

- Clean audio.
- Noisy audio.
- Different speaking speeds.
- Interruptions.
- Silence.
- Numbers, dates, addresses, names, and emails.
- Multilingual utterances if supported.
- Tool success, timeout, failure, and partial failure.
- Safety and refusal cases.
- Prompt injection in retrieved documents.

Do not use real customer audio or transcripts in normal test fixtures unless they are explicitly approved, redacted, and governed by the retention policy.

### CI Gate Requirements

Every pull request must pass:

- Typecheck.
- Lint.
- Unit tests.
- Contract tests for changed packages.
- Integration tests for changed services.
- Secret scanning.
- Dependency vulnerability scan.
- Migration check.
- Prompt/config schema validation.
- Eval subset for changed prompt, model, retrieval, tool, or safety behavior.

Every merge to the release branch must pass:

- Full unit, contract, and integration suite.
- Full agent regression evals.
- End-to-end browser test suite.
- Latency benchmark suite.
- Security test suite.
- Build artifact reproducibility check.

Every production deployment must pass:

- Staging smoke test.
- Production canary smoke test.
- Post-deploy session creation test.
- Read-only tool test.
- Telemetry ingestion test.
- Rollback readiness check.

### Definition Of Done For Any Change

No code, prompt, model, tool, retrieval, deployment, or infrastructure change is done until:

- The changed behavior has automated test coverage.
- The failure mode has a safe user-facing behavior.
- The observability signal exists to debug it in production.
- The rollback path is known.
- The release notes identify the changed model, prompt, tool, or config versions.
- The relevant eval subset passes.
- A human reviewer can inspect the evidence without re-running the whole system manually.

If a change cannot satisfy this definition, split it into a smaller change or keep it behind a disabled feature flag.

## Deployment Plan

Deployment must be boring, repeatable, observable, and reversible. Do not deploy production voice agents by manually changing prompts, provider settings, or dashboard configuration without version control and release records.

### Environment Strategy

Use separate environments:

| Environment | Purpose | Data | Provider Access |
| --- | --- | --- | --- |
| `local` | Fast development with mocks and fake tools | Synthetic only | Mock by default |
| `dev` | Shared integration testing | Synthetic only | Restricted sandbox keys |
| `staging` | Production-like release validation | Synthetic and approved QA data | Production-like limits with test tenants |
| `production` | Real users | Real data under policy | Production keys and alerting |

Rules:

- Never point local or dev at production databases.
- Never use production provider keys in local development.
- Never run destructive tool tests against real downstream systems.
- Keep staging configuration as close to production as possible.
- Keep prompts, model IDs, voice IDs, tool schemas, and retrieval corpus versions deployable as config artifacts.

### Deployment Artifact Requirements

Every release artifact must include:

- Application build version.
- Git commit SHA.
- Prompt version.
- Model/provider config version.
- Tool schema version.
- Retrieval corpus version.
- Database migration version.
- Feature flag state.
- Eval report ID.
- Security scan report ID.
- Rollback target.

### Deployment Methods

Use progressive deployment:

1. Deploy to staging.
2. Run staging release tests.
3. Deploy production canary to internal traffic or a small tenant allowlist.
4. Run production smoke tests.
5. Increase traffic gradually.
6. Monitor SLOs and error budget.
7. Complete rollout only after canary metrics are stable.

Do not deploy all traffic at once unless the system is still pre-production and has no real users.

### Smoke Tests

Staging and production smoke tests must prove:

- Health endpoint is live.
- Session gateway can create a session.
- Client can connect to the realtime provider or provider mock in the target environment.
- A test prompt version is loaded correctly.
- A read-only tool executes and writes an audit event.
- Telemetry is emitted and visible.
- Handoff stub or real handoff endpoint works.
- Feature flags are loaded.
- Database migrations are applied.
- No provider secrets are exposed in client bundles or logs.

Production smoke tests must use a test tenant and non-mutating tools by default.

### SLOs And Error Budgets

Define SLOs before production:

- Session creation success rate.
- Realtime connection success rate.
- Time to first audio p50/p95.
- Turn completion latency p50/p95.
- Tool call success rate.
- Handoff success rate.
- Crash-free session rate.
- Provider error rate.
- Safety-critical eval pass rate.
- Cost per resolved session.

Initial suggested SLOs:

- Session creation success: 99.5%.
- Realtime connection success: 99.0%.
- Tool-free turn p95 first audio: under 1.5 seconds.
- Barge-in cancellation p95: under 500 ms.
- Read-only tool p95 completion: under 2 seconds.
- Critical safety eval pass rate: 100%.

Adjust targets with measured production data, but do not remove an SLO because it is inconvenient.

### Rollback Rules

Rollback must be possible for:

- Application code.
- Prompt versions.
- Tool schema versions.
- Model/provider configuration.
- Retrieval corpus versions.
- Feature flags.
- Database migrations where safe.

Immediate rollback triggers:

- Production session creation failure above threshold.
- Realtime connection failure spike.
- Critical safety regression.
- Cross-tenant data access risk.
- Tool authorization bug.
- Mutating tool duplicate execution.
- Provider cost spike caused by release.
- P95 latency regression above agreed threshold.
- Handoff failure for high-risk flows.

If rollback cannot safely undo a database migration, the release must include a forward-fix plan and a feature flag kill switch.

### Production Runbook

Create `docs/operations.md` before launch with:

- On-call ownership.
- Dashboard links.
- Alert definitions.
- Known provider failure modes.
- Manual provider failover procedure.
- Prompt rollback procedure.
- Model rollback procedure.
- Tool disable procedure.
- Tenant disable procedure.
- Data deletion procedure.
- Incident severity definitions.
- Customer communication templates.
- Post-incident review template.

The production system is not launch-ready without a runbook.

### Phase 0: Architecture Spike

Deliverables:

- Working OpenAI Realtime browser prototype.
- Backend endpoint that mints ephemeral session credentials.
- One read-only tool.
- Basic event logging.
- Manual latency measurement.

Exit criteria:

- Voice session connects reliably.
- User can interrupt agent.
- Tool call executes server-side.
- No provider secret reaches the browser.

### Phase 1: MVP

Deliverables:

- Domain-specific prompt.
- 3-5 tools maximum.
- Session store.
- Transcript/event timeline.
- Human handoff path.
- Basic admin prompt/version config.
- Golden path evals.
- Safety smoke tests.

Exit criteria:

- Agent resolves the defined top task.
- Evals pass for golden paths and known refusals.
- Observability shows turn-level latency and tool failures.
- Handoff works.

### Phase 2: Private Beta

Deliverables:

- Tenant config.
- Dashboard.
- Review queue.
- Cost tracking.
- Rate limiting.
- Alerting.
- Retention policy.
- ElevenLabs TTS or managed-agent comparison if premium voice is required.

Exit criteria:

- Beta users complete real tasks.
- Incident runbook exists.
- Cost per successful session is acceptable.
- Safety and privacy reviews are complete.

### Phase 3: Production

Deliverables:

- Multi-region or failover plan.
- Provider fallback strategy.
- Load testing.
- Red-team evals.
- CI-gated eval suite.
- Release checklist.
- On-call and incident process.
- Data deletion/export process if required.
- Canary deployment automation.
- Rollback automation for code, prompts, and provider config.
- Production smoke tests.
- SLO dashboard and alerting.
- Incident drill results.

Exit criteria:

- SLOs are defined and monitored.
- Rollback is tested.
- Prompt/model releases are versioned.
- Human review and escalation loops are staffed.
- Production canary has passed with no release-blocking alerts.
- Full release test report is attached to the release record.

## Provider Abstraction

Create a provider boundary early.

```ts
interface VoiceSessionProvider {
  createSession(input: CreateVoiceSessionInput): Promise<CreateVoiceSessionResult>;
  connect(input: ConnectVoiceSessionInput): Promise<VoiceConnection>;
  updateSession(input: UpdateVoiceSessionInput): Promise<void>;
  endSession(input: EndVoiceSessionInput): Promise<void>;
}

interface TextToSpeechProvider {
  synthesizeStream(input: SynthesizeSpeechInput): AsyncIterable<AudioChunk>;
}

interface SpeechToTextProvider {
  transcribeStream(input: AudioStreamInput): AsyncIterable<TranscriptEvent>;
}
```

Do not expose provider-specific event payloads above the provider package. Convert them into internal events.

## Failure Modes And Fallbacks

Plan for these failures:

- Microphone permission denied: offer text chat fallback.
- Realtime connection fails: retry once, then degrade to text or chained voice.
- Provider rate limit: use tenant-level queue, fallback model, or graceful busy message.
- Tool timeout: acknowledge delay, retry if idempotent, or create follow-up ticket.
- Low-confidence transcript: ask a concise clarification.
- Repeated agent failure: transfer to human or end with clear next step.
- User frustration: apologize briefly and offer handoff.
- Safety uncertainty: do not improvise; escalate.
- Cost spike: throttle non-critical calls and alert operators.

## Security Requirements

- Backend owns all provider secrets.
- Browser receives only ephemeral or signed session credentials with short TTL.
- Validate user identity before account-specific tool calls.
- Authorize every tool call using server-side context, not model-supplied claims.
- Log high-risk tool requests before and after execution.
- Use allowlists for tool names and outbound service destinations.
- Rate-limit by tenant, user, IP, and session.
- Protect against prompt injection from retrieved content and tool responses.
- Never let retrieved documents redefine system instructions or tool policy.
- Separate admin prompt editing from runtime usage permissions.

## Knowledge Retrieval

For support or policy agents:

- Keep retrieval content approved and versioned.
- Return source IDs to the agent.
- Prefer small, relevant snippets.
- Filter by tenant, locale, product, and effective date.
- Include freshness metadata for policies that expire.
- Add evals for citation correctness and unsupported claims.
- Refuse or escalate when retrieval confidence is low.

## Human Handoff

Handoff is a core feature, not a failure.

Trigger handoff when:

- User asks for a human.
- Agent fails twice on the same intent.
- User is angry or distressed.
- Request is outside scope.
- Tool risk is high and policy requires review.
- Identity verification fails.
- Safety policy requires escalation.

Handoff packet should include:

- Conversation summary.
- User intent.
- Verified identity state.
- Tool actions already taken.
- Open questions.
- Risk flags.
- Transcript excerpt or full transcript according to policy.

## Release Checklist

Before any production release:

- Model IDs are current and explicitly configured.
- Prompt version is immutable and recoverable.
- Tools have schemas, tests, auth checks, risk levels, and audit logs.
- Evals pass for changed areas.
- Full release test suite has passed.
- Test report is stored with the release artifact.
- Critical safety evals pass at 100%.
- Tool authorization tests pass at 100%.
- Cross-tenant isolation tests pass at 100%.
- Migration has been tested against staging data.
- Canary plan is defined.
- Rollback target is defined and reachable.
- Feature flags and kill switches are verified.
- Latency dashboard is live.
- Error alerts are configured.
- Rate limits are configured.
- Secrets are not exposed to clients.
- Consent and retention behavior are tested.
- Human handoff path is tested.
- Rollback is documented and rehearsed.
- Cost monitoring is enabled.
- On-call owner has acknowledged the release.
- Post-deploy smoke tests are ready.
- No open critical or high severity defects remain.

Release decision:

- Ship only if every release-blocking item passes.
- Defer if test evidence is missing.
- Roll back immediately if canary violates safety, auth, data isolation, or core connection SLOs.

## Initial Build Tasks

Start with this order:

1. Create a minimal TypeScript app with strict linting, typecheck, test runner, CI workflow, and coverage reporting.
2. Add stable test commands: `test:unit`, `test:contract`, `test:integration`, `test:e2e`, `test:evals`, `test:latency`, `test:security`, and `test:release`.
3. Add provider interfaces and mock OpenAI/ElevenLabs provider adapters before wiring live providers.
4. Add a backend `/api/voice/session` endpoint that authenticates the user and returns an ephemeral OpenAI realtime credential.
5. Add contract tests proving the session endpoint rejects unauthenticated, expired, and cross-tenant requests.
6. Add a browser client that connects through WebRTC using `RealtimeAgent` and `RealtimeSession`.
7. Add E2E tests for session creation, connect failure, microphone denial, text fallback, and clean session end.
8. Add one read-only tool, such as `lookup_policy`.
9. Add unit and integration tests for tool schema validation, authorization, audit logging, timeout, and safe failure text.
10. Add structured event logging for session lifecycle, turn events, tool calls, guardrails, handoff, and errors.
11. Add telemetry tests proving logs, metrics, and traces are emitted in test mode.
12. Add a basic prompt in `prompts/voice-agent.md` with immutable version metadata.
13. Add scripted evals for one happy path, one refusal path, one interruption path, and one tool failure path.
14. Add barge-in, silence-timeout, duplicate-event, and queued-audio-cancellation tests.
15. Add a human handoff stub with handoff packet tests.
16. Add release test aggregation through `npm run test:release`.
17. Add staging and production smoke test scripts using a test tenant and non-mutating tools.
18. Add a provider abstraction so ElevenLabs can be evaluated without rewriting app logic.

## Non-Goals For The First Build

Avoid these until the MVP is stable:

- More than five tools.
- Long-term memory.
- Autonomous high-risk transactions.
- Multiple agent personalities.
- Complex multi-agent orchestration.
- Raw audio retention by default.
- Unbounded web browsing by the agent.
- Fine-tuning.
- Multi-provider routing without a clear measurement need.

## Decision Principles

- Prefer realtime speech-to-speech when user experience matters more than deterministic transcript control.
- Prefer chained pipelines when auditability and deterministic control matter more than naturalness.
- Keep tools few, typed, and safe.
- Build evals before expanding scope.
- Treat latency as a product feature.
- Treat observability as part of the product, not infrastructure cleanup.
- Treat prompts as versioned production artifacts.
- Use provider docs as current truth, not memory.
