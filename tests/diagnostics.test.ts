import test from "node:test";
import assert from "node:assert/strict";
import { heartbeatStatus } from "../lib/diagnostics/live-status.ts";

const now = Date.parse("2026-11-08T22:00:00.000Z");

test("considera relay online com heartbeat recente", () => {
  assert.deepEqual(heartbeatStatus("2026-11-08T21:59:45.000Z", true, now), { online: true, seconds: 15 });
});

test("considera relay offline com heartbeat antigo ou ciclo com erro", () => {
  assert.equal(heartbeatStatus("2026-11-08T21:59:20.000Z", true, now).online, false);
  assert.equal(heartbeatStatus("2026-11-08T21:59:55.000Z", false, now).online, false);
});
