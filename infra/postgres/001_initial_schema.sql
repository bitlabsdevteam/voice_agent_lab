create table if not exists voice_sessions (
  session_id text primary key,
  tenant_id text not null,
  user_id text not null,
  channel text not null,
  provider text not null,
  model_id text not null,
  voice_id text not null,
  prompt_version text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  consent_state text not null,
  retention_policy text not null,
  status text not null,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists voice_sessions_tenant_started_idx
  on voice_sessions (tenant_id, started_at desc);

create table if not exists conversation_events (
  event_id text primary key,
  session_id text not null references voice_sessions(session_id),
  tenant_id text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists conversation_events_session_time_idx
  on conversation_events (session_id, occurred_at asc);

create index if not exists conversation_events_tenant_type_time_idx
  on conversation_events (tenant_id, event_type, occurred_at desc);

create table if not exists tool_call_audit (
  audit_id text primary key,
  session_id text not null references voice_sessions(session_id),
  tenant_id text not null,
  user_id text not null,
  tool_name text not null,
  risk text not null,
  idempotency_key text not null,
  ok boolean not null,
  created_at timestamptz not null default now(),
  unique (session_id, tool_name, idempotency_key)
);
