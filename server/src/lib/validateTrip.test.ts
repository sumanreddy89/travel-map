// Run: npm test --workspace server
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateNewStop, validateStopPatch, validateTripPatch, validateTitle } from "./validateTrip.js";

const ok = <T>(r: { ok: true; value: T } | { ok: false; error: string }) => {
  assert.equal(r.ok, true, r.ok ? "" : r.error);
  return (r as { ok: true; value: T }).value;
};
const bad = (r: { ok: boolean; error?: string }) => assert.equal(r.ok, false);

test("titles are trimmed, non-empty and capped", () => {
  assert.equal(ok(validateTitle("  Iceland ring road  ")), "Iceland ring road");
  bad(validateTitle(""));
  bad(validateTitle("   "));
  bad(validateTitle(42));
  bad(validateTitle("x".repeat(121)));
  bad(validateTitle("Trip\u0000name"));
});

test("a new stop needs a name and coordinates on the globe", () => {
  assert.deepEqual(ok(validateNewStop({ name: "Reykjavík", lat: 64.1466, lng: -21.9426, date: "June 2024" })), {
    name: "Reykjavík", lat: 64.1466, lng: -21.9426, date: "June 2024", notes: undefined,
  });
  bad(validateNewStop({ name: "Nowhere", lat: 91, lng: 0 }));
  bad(validateNewStop({ name: "Nowhere", lat: -90.5, lng: 0 }));
  bad(validateNewStop({ name: "Nowhere", lat: 0, lng: 180.01 }));
  bad(validateNewStop({ name: "Nowhere", lat: Number.NaN, lng: 0 }));
  bad(validateNewStop({ name: "Nowhere", lat: "10", lng: 0 }));
  bad(validateNewStop({ name: "", lat: 0, lng: 0 }));
  bad(validateNewStop({ name: "Long notes", lat: 0, lng: 0, notes: "x".repeat(2001) }));
  bad(validateNewStop(null));
});

test("a stop patch only accepts known fields with valid values", () => {
  assert.deepEqual(ok(validateStopPatch({ date: "", notes: "Rainy", narration: "Then we drove north." })), {
    date: "", notes: "Rainy", narration: "Then we drove north.",
  });
  assert.deepEqual(ok(validateStopPatch({ lat: -33.86, lng: 151.21 })), { lat: -33.86, lng: 151.21 });
  // server-managed fields are dropped, never copied onto the stop
  assert.deepEqual(ok(validateStopPatch({ audioPath: "../../etc/passwd", media: [], name: "Sydney" })), { name: "Sydney" });
  bad(validateStopPatch({ lat: 200 }));
  bad(validateStopPatch({ name: "" }));
  bad(validateStopPatch({ narration: 5 }));
});

test("a trip patch checks orientation, music and narration", () => {
  assert.deepEqual(ok(validateTripPatch({ orientation: "portrait" })), { orientation: "portrait" });
  bad(validateTripPatch({ orientation: "square" }));
  assert.deepEqual(ok(validateTripPatch({ music: { path: "music/calm_strings.mp3", volume: 0.15, durationSec: 120 } })), {
    music: { path: "music/calm_strings.mp3", volume: 0.15, durationSec: 120 },
  });
  // an empty path means "no music", picked on purpose in the UI
  assert.deepEqual(ok(validateTripPatch({ music: { path: "", volume: 0 } })), { music: { path: "", volume: 0 } });
  bad(validateTripPatch({ music: { path: "../server/.env", volume: 0.5 } }));
  bad(validateTripPatch({ music: { path: "music/../../server/.env", volume: 0.5 } }));
  bad(validateTripPatch({ music: { path: "music/track.exe", volume: 0.5 } }));
  bad(validateTripPatch({ music: { path: "music/a.mp3", volume: 3 } }));
  bad(validateTripPatch({ music: "loud" }));
  bad(validateTripPatch({ title: "" }));
  bad(validateTripPatch({ titleCardNarration: "x".repeat(2001) }));
  assert.deepEqual(ok(validateTripPatch({})), {});
});
