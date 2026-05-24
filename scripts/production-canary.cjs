const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const provider = process.argv[2];

async function main() {
  if (provider !== "openai" && provider !== "elevenlabs") {
    throw new Error("Usage: node scripts/production-canary.cjs <openai|elevenlabs>");
  }

  run("npm", ["run", "build"]);
  run("node", ["scripts/verify-deployed-remote.cjs"]);
  run("node", ["scripts/live-provider-smoke.cjs", provider]);

  const remoteEvidence = readJson("release/remote-deployment-evidence.json");
  const liveSmokeEvidence = readJson(`release/live-smoke-${provider}.json`);

  const evidence = {
    ok: Boolean(remoteEvidence.ok && !remoteEvidence.skipped && liveSmokeEvidence.ok && !liveSmokeEvidence.skipped),
    checkedAt: new Date().toISOString(),
    provider,
    remoteDeployment: {
      ok: Boolean(remoteEvidence.ok),
      skipped: Boolean(remoteEvidence.skipped),
      baseUrl: remoteEvidence.baseUrl || null
    },
    liveSmoke: {
      ok: Boolean(liveSmokeEvidence.ok),
      skipped: Boolean(liveSmokeEvidence.skipped),
      checkedAt: liveSmokeEvidence.checkedAt || null
    }
  };

  fs.mkdirSync("release", { recursive: true });
  fs.writeFileSync("release/production-canary-evidence.json", `${JSON.stringify(evidence, null, 2)}\n`);

  if (!evidence.ok) {
    throw new Error(`Production canary evidence is not sufficient: ${JSON.stringify(evidence)}`);
  }

  console.log(JSON.stringify(evidence, null, 2));
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
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
