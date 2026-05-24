const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const promptPath = path.join("prompts", "voice-agent.md");
const prompt = fs.readFileSync(promptPath, "utf8");
const promptVersion = prompt.match(/version:\s*([^\n]+)/)?.[1]?.trim() || "unknown";
const modelId = process.env.VOICE_AGENT_MODEL || "gpt-realtime-2";
const provider = process.env.VOICE_AGENT_PROVIDER || "mock-openai";
const sessionStore = process.env.VOICE_AGENT_SESSION_STORE || "memory";
const eventSink = process.env.VOICE_AGENT_EVENT_SINK || "memory";
const buildId = process.env.BUILD_ID || `local-${Date.now()}`;
const liveOpenAISmoke = readSmokeStatus("openai", process.env.OPENAI_API_KEY ? "available" : "skipped_missing_OPENAI_API_KEY");
const liveElevenLabsSmoke = readSmokeStatus(
  "elevenlabs",
  process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_AGENT_ID
    ? "available"
    : "skipped_missing_ELEVENLABS_API_KEY_or_ELEVENLABS_AGENT_ID"
);
const deploymentEvidence = fs.existsSync(path.join("release", "deployment-evidence.json")) ? "available" : "missing";
const remoteDeploymentEvidence = fs.existsSync(path.join("release", "remote-deployment-evidence.json")) ? "available" : "missing";
const productionCanaryEvidence = readProductionCanaryStatus();
const observability = {
  prometheusConfig: fs.existsSync(path.join("infra", "observability", "prometheus.yml")) ? "available" : "missing",
  alertRules: fs.existsSync(path.join("infra", "observability", "alerts.yml")) ? "available" : "missing",
  grafanaDashboard: fs.existsSync(path.join("infra", "observability", "grafana-dashboard.json")) ? "available" : "missing"
};

const manifest = {
  application: packageJson.name,
  version: packageJson.version,
  buildId,
  createdAt: new Date().toISOString(),
  provider,
  modelId,
  sessionStore,
  eventSink,
  promptVersion,
  promptSha256: sha256(prompt),
  releaseGates: [
    "typecheck",
    "lint",
    "format:check",
    "test:unit",
    "test:contract",
    "test:integration",
    "test:e2e",
    "test:evals",
    "test:latency",
    "test:load",
    "test:security",
    "smoke:local"
  ],
  liveSmoke: {
    openai: liveOpenAISmoke,
    elevenlabs: liveElevenLabsSmoke
  },
  observability,
  deploymentEvidence,
  remoteDeploymentEvidence,
  productionCanaryEvidence,
  rollback: {
    previousBuildId: process.env.PREVIOUS_BUILD_ID || "manual-required",
    promptRollbackSupported: true,
    providerConfigRollbackSupported: true
  }
};

fs.mkdirSync("release", { recursive: true });
fs.writeFileSync(path.join("release", "release-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readSmokeStatus(providerName, fallback) {
  const evidencePath = path.join("release", `live-smoke-${providerName}.json`);
  if (!fs.existsSync(evidencePath)) {
    return fallback;
  }
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  if (!evidence.ok) {
    return "failed";
  }
  return evidence.skipped ? "skipped" : "passed";
}

function readProductionCanaryStatus() {
  const evidencePath = path.join("release", "production-canary-evidence.json");
  if (!fs.existsSync(evidencePath)) {
    return "missing";
  }
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  if (!evidence.ok) {
    return "failed";
  }
  if (evidence.remoteDeployment?.skipped || evidence.liveSmoke?.skipped) {
    return "skipped";
  }
  return "passed";
}
