const fs = require("node:fs");

async function main() {
  const baseUrl = process.env.DEPLOYMENT_BASE_URL;
  if (!baseUrl) {
    const skipped = {
      ok: true,
      skipped: true,
      reason: "DEPLOYMENT_BASE_URL missing",
      checkedAt: new Date().toISOString()
    };
    writeEvidence(skipped);
    console.log(JSON.stringify(skipped, null, 2));
    return;
  }

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const checks = [];
  checks.push(await checkJson(`${normalizedBaseUrl}/health`, 200, "health"));
  checks.push(await checkJson(`${normalizedBaseUrl}/ready`, 200, "readiness"));
  checks.push(await checkText(`${normalizedBaseUrl}/metrics`, 200, "metrics", "voice_agent_sessions_created_total"));
  checks.push(await checkText(`${normalizedBaseUrl}/`, 200, "static_ui", "Production Voice Agent"));
  checks.push(await checkJson(`${normalizedBaseUrl}/api/voice/config`, 200, "client_config"));

  const evidence = {
    ok: checks.every((check) => check.ok),
    skipped: false,
    checkedAt: new Date().toISOString(),
    baseUrl: normalizedBaseUrl,
    checks
  };
  writeEvidence(evidence);

  if (!evidence.ok) {
    throw new Error(`Remote deployment verification failed: ${JSON.stringify(evidence.checks)}`);
  }

  console.log(JSON.stringify(evidence, null, 2));
}

async function checkJson(url, expectedStatus, name) {
  const response = await fetch(url);
  return {
    name,
    ok: response.status === expectedStatus,
    status: response.status,
    body: await response.json()
  };
}

async function checkText(url, expectedStatus, name, expectedText) {
  const response = await fetch(url);
  const body = await response.text();
  return {
    name,
    ok: response.status === expectedStatus && body.includes(expectedText),
    status: response.status,
    containsExpectedText: body.includes(expectedText)
  };
}

function writeEvidence(evidence) {
  fs.mkdirSync("release", { recursive: true });
  fs.writeFileSync("release/remote-deployment-evidence.json", `${JSON.stringify(evidence, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
