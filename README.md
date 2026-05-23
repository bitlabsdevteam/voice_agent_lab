# Production Voice Agent

# voice_agent_lab

This is a production-shaped voice agent foundation built from `AGENTS.md`.

The first implementation is intentionally mock-provider first. It establishes provider boundaries, session gateway behavior, tool safety, telemetry events, and release test commands before connecting live OpenAI or ElevenLabs credentials.

## Commands

```sh
npm run typecheck
npm run lint
npm run test:release
npm run smoke:local
npm run release:manifest
npm run start
```

## Current Scope

- OpenAI-first realtime config using `gpt-realtime-2`.
- Mock OpenAI and ElevenLabs provider adapters.
- Session gateway that returns ephemeral client credentials without exposing provider secrets.
- Browser WebRTC client served from `/` for live OpenAI Realtime sessions.
- Read-only `lookup_policy` tool with schema, authorization, and audit events.
- Unit, contract, integration, e2e, eval, latency, load, security, and smoke tests.

## Live OpenAI Path

Set these values before testing a real WebRTC session:

```sh
VOICE_AGENT_PROVIDER=openai
OPENAI_API_KEY=...
npm run start
```

Open `http://localhost:3000`, then start a voice session. The browser receives only an ephemeral Realtime client secret from the backend.
