const fs = require("node:fs");
const { createApp } = require("../dist/src/app.js");

async function main() {
  const app = createApp();
  const checks = [];
  checks.push(await request(app, "GET", "/health", "health", { expectedStatus: 200, expectedText: '"ok":true' }));
  checks.push(await request(app, "GET", "/ready", "readiness", { expectedStatus: 200, expectedText: '"ok":true' }));
  checks.push(
    await request(app, "GET", "/metrics", "metrics", {
      expectedStatus: 200,
      expectedText: "voice_agent_sessions_created_total"
    })
  );
  checks.push(
    await request(app, "GET", "/", "static_ui", {
      expectedStatus: 200,
      expectedText: "Aiko"
    })
  );
  checks.push(
    await request(app, "GET", "/ops.html", "operations_ui", {
      expectedStatus: 200,
      expectedText: "Runtime Events"
    })
  );
  checks.push(
    await request(app, "GET", "/api/voice/config", "client_config", {
      expectedStatus: 200,
      expectedText: "Provider API keys never leave the backend"
    })
  );

  const evidence = {
    ok: checks.every((check) => check.ok),
    checkedAt: new Date().toISOString(),
    mode: "in_process_built_app",
    checks
  };

  fs.mkdirSync("release", { recursive: true });
  fs.writeFileSync("release/deployment-evidence.json", `${JSON.stringify(evidence, null, 2)}\n`);

  if (!evidence.ok) {
    throw new Error(`Deployment verification failed: ${JSON.stringify(evidence.checks)}`);
  }

  console.log(JSON.stringify(evidence, null, 2));
}

function request(app, method, url, name, expectation) {
  return new Promise((resolve) => {
    const request = {
      method,
      url,
      headers: {},
      on(event, listener) {
        if (event === "end") {
          listener();
        }
      }
    };
    const response = {
      statusCode: 200,
      headers: {},
      body: "",
      setHeader(header, value) {
        this.headers[header.toLowerCase()] = value;
      },
      end(body = "") {
        this.body = String(body);
        resolve({
          name,
          ok: this.statusCode === expectation.expectedStatus && this.body.includes(expectation.expectedText),
          status: this.statusCode,
          containsExpectedText: this.body.includes(expectation.expectedText)
        });
      }
    };

    app.emit("request", request, response);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
