# Redis Usage

Use Redis for short-lived voice-agent runtime coordination:

- Session rate limits by tenant, user, and IP.
- Idempotency locks for mutating tool calls.
- Temporary realtime event buffers.
- Provider reconnect coordination.
- Canary rollout flags when a feature-flag service is not available.

Do not use Redis as the source of truth for transcripts, tool audit, or release records. Persist those to Postgres or an equivalent durable database.

Suggested key shapes:

```text
voice:rate:{tenant_id}:{user_id}
voice:session:{session_id}:events
voice:tool:idempotency:{session_id}:{tool_name}:{idempotency_key}
voice:feature:{tenant_id}:{flag_name}
```

Set TTLs on all Redis keys.
