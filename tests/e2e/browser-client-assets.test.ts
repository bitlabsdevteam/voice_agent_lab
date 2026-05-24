import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createApp } from "../../src/app";

test("landing page loads the avatar experience without provider API keys", () => {
  const html = readFileSync("public/index.html", "utf8");
  const avatar = readFileSync("public/avatar.js", "utf8");
  const runtime = readFileSync("public/assets/avatar-runtime.js", "utf8");

  assert.equal(html.includes("Aiko"), true);
  assert.equal(html.includes("/avatar.js"), true);
  assert.equal(html.includes("/assets/avatar-runtime.js"), true);
  assert.equal(html.includes("/ops.html"), true);
  assert.equal(html.includes("OPENAI_API_KEY"), false);
  assert.equal(avatar.includes("OPENAI_API_KEY"), false);
  assert.equal(runtime.includes("OPENAI_API_KEY"), false);
  assert.equal(avatar.includes("ELEVENLABS_API_KEY"), false);
  assert.equal(avatar.includes("MESHY_API_KEY"), false);
  assert.equal(avatar.includes("sk-"), false);
  assert.equal(avatar.includes("xi-api-key"), false);
});

test("operations page contains session controls and runtime events", () => {
  const html = readFileSync("public/ops.html", "utf8");
  const ops = readFileSync("public/ops.js", "utf8");

  assert.equal(html.includes("Session Controls"), true);
  assert.equal(html.includes("Runtime Events"), true);
  assert.equal(html.includes('id="tenantId"'), true);
  assert.equal(html.includes('id="events"'), true);
  assert.equal(ops.includes("appendEvent"), true);
});

test("browser clients request backend session before opening provider transports", () => {
  const avatar = readFileSync("public/avatar.js", "utf8");
  const ops = readFileSync("public/ops.js", "utf8");
  const combined = `${avatar}\n${ops}`;

  assert.equal(combined.includes('fetch("/api/voice/session"'), true);
  assert.equal(combined.includes("new RTCPeerConnection()"), true);
  assert.equal(combined.includes("navigator.mediaDevices.getUserMedia"), true);
  assert.equal(combined.includes("https://api.openai.com/v1/realtime/calls"), true);
});

test("browser clients support ElevenLabs signed WebSocket without API key", () => {
  const avatar = readFileSync("public/avatar.js", "utf8");
  const ops = readFileSync("public/ops.js", "utf8");
  const combined = `${avatar}\n${ops}`;

  assert.equal(combined.includes("new WebSocket(session.clientSecret)"), true);
  assert.equal(combined.includes("conversation_initiation_client_data"), true);
  assert.equal(combined.includes('"xi-api-key"'), false);
});

test("avatar client supports dropped glTF assets without upload or generation keys", () => {
  const html = readFileSync("public/index.html", "utf8");
  const avatar = readFileSync("public/avatar.js", "utf8");
  const runtime = readFileSync("public/assets/avatar-runtime.js", "utf8");
  const css = readFileSync("public/styles.css", "utf8");

  assert.equal(avatar.includes("/assets/ayaka.png"), true);
  assert.equal(avatar.includes("GLTFLoader"), true);
  assert.equal(avatar.includes("loader.parse"), true);
  assert.equal(avatar.includes("avatarFileInput"), true);
  assert.equal(avatar.includes("avatarFileButton"), true);
  assert.equal(avatar.includes("detectFacialControls"), true);
  assert.equal(runtime.includes("blinkLeft"), true);
  assert.equal(runtime.includes("jawOpen"), true);
  assert.equal(runtime.includes("viseme"), true);
  assert.equal(avatar.includes(".glb"), true);
  assert.equal(avatar.includes(".gltf"), true);
  assert.equal(avatar.includes("file.arrayBuffer()"), true);
  assert.equal(avatar.includes("file.text()"), true);
  assert.equal(avatar.includes("new THREE.AnimationMixer"), true);
  assert.equal(html.includes("Drop or choose GLB/GLTF"), true);
  assert.equal(html.includes('id="avatarFileInput"'), true);
  assert.equal(css.includes("is-drag-active"), true);
});

test("avatar client rejects non-3D drops with a visible safe status", () => {
  const avatar = readFileSync("public/avatar.js", "utf8");
  const css = readFileSync("public/styles.css", "utf8");

  assert.equal(avatar.includes("isAvatarModelFile"), true);
  assert.equal(avatar.includes('name.endsWith(".glb") || name.endsWith(".gltf")'), true);
  assert.equal(avatar.includes("Unsupported avatar file. Choose a .glb or .gltf model."), true);
  assert.equal(avatar.includes("has-load-error"), true);
  assert.equal(css.includes("has-load-error"), true);
});

test("avatar script honors reduced-motion preferences", () => {
  const avatar = readFileSync("public/avatar.js", "utf8");
  const runtime = readFileSync("public/assets/avatar-runtime.js", "utf8");
  const css = readFileSync("public/styles.css", "utf8");

  assert.equal(avatar.includes('matchMedia("(prefers-reduced-motion: reduce)"'), true);
  assert.equal(runtime.includes("reducedMotion"), true);
  assert.equal(css.includes("@media (prefers-reduced-motion: reduce)"), true);
});

test("backend serves landing, operations, scripts, styles, and asset paths safely", async () => {
  const app = createApp();

  assert.equal((await request(app, "/", "Aiko")).ok, true);
  assert.equal((await request(app, "/ops.html", "Runtime Events")).ok, true);
  assert.equal((await request(app, "/avatar.js", "startAvatarScene")).ok, true);
  assert.equal((await request(app, "/assets/avatar-runtime.js", "detectFacialControls")).ok, true);
  assert.equal((await request(app, "/assets/ayaka.png", "PNG")).status, 200);
  assert.equal((await request(app, "/ops.js", "fetch(\"/api/voice/session\"")).ok, true);
  assert.equal((await request(app, "/styles.css", "avatar-stage")).ok, true);
  assert.equal((await request(app, "/app.js", "unused")).status, 404);
  assert.equal((await request(app, "/../src/app.ts", "createApp")).status, 404);
});

function request(app: ReturnType<typeof createApp>, url: string, expectedText: string): Promise<{ ok: boolean; status: number }> {
  return new Promise((resolve) => {
    const request = {
      method: "GET",
      url,
      headers: {},
      on(_event: string, _listener: () => void) {
        return undefined;
      }
    };
    const response = {
      statusCode: 200,
      body: "",
      setHeader(_header: string, _value: string) {
        return undefined;
      },
      end(body: string | Uint8Array = "") {
        this.body = String(body);
        resolve({
          ok: this.statusCode === 200 && this.body.includes(expectedText),
          status: this.statusCode
        });
      }
    };

    (app as unknown as { emit(event: string, request: unknown, response: unknown): boolean }).emit("request", request, response);
  });
}
