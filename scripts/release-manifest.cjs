const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const promptPath = path.join("prompts", "voice-agent.md");
const prompt = fs.readFileSync(promptPath, "utf8");
const promptVersion = prompt.match(/version:\s*([^\n]+)/)?.[1]?.trim() || "unknown";
const modelId = process.env.VOICE_AGENT_MODEL || "gpt-realtime-2";
const provider = process.env.VOICE_AGENT_PROVIDER || "mock-openai";
const buildId = process.env.BUILD_ID || `local-${Date.now()}`;

const manifest = {
  application: packageJson.name,
  version: packageJson.version,
  buildId,
  createdAt: new Date().toISOString(),
  provider,
  modelId,
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
