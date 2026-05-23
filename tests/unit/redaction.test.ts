import test from "node:test";
import assert from "node:assert/strict";
import { containsSensitiveText, redactSensitiveText } from "../../src/security/redaction";

test("redacts email, phone, and card-like values", () => {
  const redacted = redactSensitiveText("Email me@example.com or call 415-555-1212 with card 4111 1111 1111 1111.");
  assert.equal(redacted.includes("me@example.com"), false);
  assert.equal(redacted.includes("415-555-1212"), false);
  assert.equal(redacted.includes("4111"), false);
});

test("detects sensitive text", () => {
  assert.equal(containsSensitiveText("Contact user@example.com"), true);
  assert.equal(containsSensitiveText("No sensitive values here"), false);
});
