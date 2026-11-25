// Run: npm test (from the repo root)
import { test } from "node:test";
import assert from "node:assert/strict";
import { placeLabels } from "./labels";

test("labels far apart all go above their pins", () => {
  const p = placeLabels([[0, 0], [500, 0], [1000, 300]], ["Porto", "Madrid", "Palma"], 30, 24, 13);
  assert.ok(p.every((l) => l.anchor === "middle" && l.dy < 0));
});

test("crowded pins get different spots, so no two names overlap", () => {
  // Porto, Salamanca and Madrid squeezed together, as on the zoomed-out portrait map.
  const p = placeLabels([[100, 400], [150, 405], [190, 410]], ["Porto", "Salamanca", "Madrid"], 30, 24, 13);
  const spots = p.map((l) => `${l.anchor}:${Math.sign(l.dy)}`);
  assert.equal(new Set(spots).size, 3, `three different placements, got ${spots.join(", ")}`);
  assert.deepEqual(p[0], { dx: 0, dy: -24, anchor: "middle" }, "the first keeps the default spot");
});

test("one stop, or none, is fine", () => {
  assert.deepEqual(placeLabels([], [], 30, 24, 13), []);
  assert.equal(placeLabels([[5, 5]], ["Porto"], 30, 24, 13)[0].anchor, "middle");
});
