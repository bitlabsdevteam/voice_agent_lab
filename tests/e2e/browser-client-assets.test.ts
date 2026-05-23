import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("browser client requests backend session before opening WebRTC call", () => {
  const app = readFileSync("public/app.js", "utf8");

  assert.equal(app.includes('fetch("/api/voice/session"'), true);
  assert.equal(app.includes("new RTCPeerConnection()"), true);
  assert.equal(app.includes("navigator.mediaDevices.getUserMedia"), true);
  assert.equal(app.includes("https://api.openai.com/v1/realtime/calls"), true);
});

test("browser client does not embed provider API keys", () => {
  const html = readFileSync("public/index.html", "utf8");
  const app = readFileSync("public/app.js", "utf8");

  assert.equal(html.includes("OPENAI_API_KEY"), false);
  assert.equal(app.includes("OPENAI_API_KEY"), false);
  assert.equal(app.includes("sk-"), false);
});
