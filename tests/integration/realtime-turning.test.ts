import test from "node:test";
import assert from "node:assert/strict";
import { RealtimeTurnSimulator } from "../../src/agent/realtime-simulator";
import { InMemoryEventSink } from "../../src/telemetry/in-memory-event-sink";

test("barge-in cancels active agent response and clears speaking state", () => {
  const eventSink = new InMemoryEventSink();
  const simulator = new RealtimeTurnSimulator("sess_turn", "tenant_turn", eventSink);

  simulator.startResponse();
  assert.equal(simulator.isSpeaking(), true);

  simulator.interrupt();
  assert.equal(simulator.isSpeaking(), false);
  assert.ok(eventSink.list().find((event) => event.type === "agent.response.cancelled"));
});

test("duplicate provider events are ignored to prevent duplicate downstream actions", () => {
  const eventSink = new InMemoryEventSink();
  const simulator = new RealtimeTurnSimulator("sess_turn", "tenant_turn", eventSink);

  const first = simulator.receiveProviderEvent("provider_event_1", "response.output_item.done");
  const duplicate = simulator.receiveProviderEvent("provider_event_1", "response.output_item.done");

  assert.equal(first, true);
  assert.equal(duplicate, false);
  assert.equal(eventSink.list().filter((event) => event.type === "turn.detected").length, 1);
});
