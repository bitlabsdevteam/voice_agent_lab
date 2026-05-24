const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

function main() {
  run("node", ["scripts/deployment-check.cjs"]);

  const manifest = readJson("release/release-manifest.json");
  const canary = readJson("release/production-canary-evidence.json");
  const remote = readJson("release/remote-deployment-evidence.json");
  const liveSmoke = readJson(`release/live-smoke-${canary.provider}.json`);

  if (!canary.ok || canary.remoteDeployment.skipped || canary.liveSmoke.skipped) {
    throw new Error("Production canary evidence is incomplete or skipped");
  }

  if (!remote.ok || remote.skipped) {
    throw new Error("Remote deployment evidence is not production-valid");
  }

  if (!liveSmoke.ok || liveSmoke.skipped) {
    throw new Error("Live provider smoke evidence is not production-valid");
  }

  const summary = {
    ok: true,
    checkedAt: new Date().toISOString(),
    provider: canary.provider,
    modelId: manifest.modelId,
    remoteDeploymentEvidenceOk: remote.ok,
    remoteDeploymentEvidenceSkipped: Boolean(remote.skipped),
    liveSmokeOk: liveSmoke.ok,
    liveSmokeSkipped: Boolean(liveSmoke.skipped),
    productionCanaryEvidenceOk: canary.ok
  };

  console.log(JSON.stringify(summary, null, 2));
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit"
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required production artifact: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

main();
