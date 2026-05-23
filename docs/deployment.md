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
VOICE_AGENT_DATA_DIR=/data
OPENAI_API_KEY=...
```

For ElevenLabs managed-agent mode:

```text
VOICE_AGENT_PROVIDER=elevenlabs
VOICE_AGENT_SESSION_STORE=file
VOICE_AGENT_DATA_DIR=/data
ELEVENLABS_API_KEY=...
ELEVENLABS_AGENT_ID=agent_...
```

## Required Checks

Run before rollout:

```sh
npm run test:release
npm run smoke:local
npm run release:manifest
```

After deploy, call:

```text
GET /health
GET /ready
```

`/ready` must return `200` before the instance receives traffic.

## Rollback

Rollback must restore:

- App build.
- Prompt version.
- Provider config.
- Session-store configuration.
- Feature flags.

If live voice traffic fails, switch `VOICE_AGENT_PROVIDER` back to `mock-openai` only for internal smoke testing, not for customer traffic. Customer traffic should be routed to human handoff or text fallback.
