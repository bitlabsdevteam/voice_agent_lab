import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("postgres schema contains production voice session and audit tables", () => {
  const schema = readFileSync("infra/postgres/001_initial_schema.sql", "utf8");

  assert.equal(schema.includes("create table if not exists voice_sessions"), true);
  assert.equal(schema.includes("create table if not exists conversation_events"), true);
  assert.equal(schema.includes("create table if not exists tool_call_audit"), true);
  assert.equal(schema.includes("unique (session_id, tool_name, idempotency_key)"), true);
});

test("docker compose includes postgres redis prometheus and grafana", () => {
  const compose = readFileSync("docker-compose.yml", "utf8");

  assert.equal(compose.includes("postgres:"), true);
  assert.equal(compose.includes("redis:"), true);
  assert.equal(compose.includes("prometheus:"), true);
  assert.equal(compose.includes("grafana:"), true);
  assert.equal(compose.includes("VOICE_AGENT_EVENT_SINK: file"), true);
  assert.equal(compose.includes("DATABASE_URL:"), true);
  assert.equal(compose.includes("/metrics"), false);
});

test("prometheus config scrapes voice agent metrics endpoint and loads alert rules", () => {
  const config = readFileSync("infra/observability/prometheus.yml", "utf8");

  assert.equal(config.includes("metrics_path: /metrics"), true);
  assert.equal(config.includes("voice-agent:3000"), true);
  assert.equal(config.includes("rule_files:"), true);
  assert.equal(config.includes("/etc/prometheus/alerts.yml"), true);
});

test("observability artifacts define alert rules and grafana panels", () => {
  const alerts = readFileSync("infra/observability/alerts.yml", "utf8");
  const dashboard = readFileSync("infra/observability/grafana-dashboard.json", "utf8");
  const datasource = readFileSync("infra/observability/grafana/provisioning/datasources/datasource.yml", "utf8");
  const provider = readFileSync("infra/observability/grafana/provisioning/dashboards/dashboard.yml", "utf8");

  assert.equal(alerts.includes("VoiceAgentTimeToFirstAudioHigh"), true);
  assert.equal(alerts.includes("voice_agent_tool_call_success_rate_percent"), true);
  assert.equal(dashboard.includes("voice_agent_time_to_first_audio_p95_milliseconds"), true);
  assert.equal(dashboard.includes("voice_agent_tool_call_success_rate_percent"), true);
  assert.equal(datasource.includes("http://prometheus:9090"), true);
  assert.equal(provider.includes("/var/lib/grafana/dashboards"), true);
});
