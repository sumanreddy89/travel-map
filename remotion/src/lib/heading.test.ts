// Run: npm test (from the repo root)
import { test } from "node:test";
import assert from "node:assert/strict";
import { headingAt } from "./heading";
import { cumulativeLengths, type Point } from "./polyline";

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.5, `${a} ≈ ${b}`);
const route = (pts: Point[]) => [pts, cumulativeLengths(pts)] as const;

test("straight lines point the way they go (0 = right, 90 = down in SVG)", () => {
  near(headingAt(...route([[0, 0], [100, 0]]), 50), 0);
  near(headingAt(...route([[0, 0], [0, 100]]), 50), 90);
  near(headingAt(...route([[100, 0], [0, 0]]), 50), 180);
  near(headingAt(...route([[0, 100], [0, 0]]), 50), -90);
  near(headingAt(...route([[0, 0], [100, 100]]), 50), 45);
});

test("it turns with the route, and holds steady at both ends", () => {
  const [pts, lens] = route([[0, 0], [100, 0], [100, 100]]);
  near(headingAt(pts, lens, 20), 0);
  near(headingAt(pts, lens, 180), 90);
  near(headingAt(pts, lens, 0), 0); // start: looks ahead, never NaN
  near(headingAt(pts, lens, 200), 90); // end: looks back
  near(headingAt(pts, lens, 999), 90);
});

test("tiny zigzags don't flip the heading", () => {
  const pts: Point[] = [];
  for (let x = 0; x <= 200; x += 2) pts.push([x, x % 4 === 0 ? 0 : 1.5]);
  const h = headingAt(pts, cumulativeLengths(pts), 100);
  assert.ok(Math.abs(h) < 10, `heading ${h} should stay close to east`);
});

test("degenerate routes don't crash", () => {
  assert.equal(headingAt([], [], 0), 0);
  assert.equal(headingAt(...route([[5, 5]]), 0), 0);
  assert.equal(headingAt(...route([[5, 5], [5, 5]]), 0), 0);
});
