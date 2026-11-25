// Run: npm test (from the repo root)
import { test } from "node:test";
import assert from "node:assert/strict";
import { MOTION, labelMotion, pinScale, routeProgress } from "./motion";

test("the route eases in and out: 0 at the start, 1 at the end, slow at both ends", () => {
  assert.equal(routeProgress(0, 10, 100), 0);
  assert.equal(routeProgress(10, 10, 100), 0);
  assert.equal(routeProgress(100, 10, 100), 1);
  assert.equal(routeProgress(500, 10, 100), 1);
  const step = (f: number) => routeProgress(f + 1, 10, 100) - routeProgress(f, 10, 100);
  assert.ok(step(12) < step(55) && step(97) < step(55), "moves faster in the middle than at the ends");
  let prev = -1;
  for (let f = 0; f <= 110; f++) {
    const v = routeProgress(f, 10, 100);
    assert.ok(v >= prev, "never goes backwards");
    prev = v;
  }
});

test("a pin waits, pops past full size, then settles at 1", () => {
  assert.equal(pinScale(9, 30, 10), 0);
  const curve = Array.from({ length: 40 }, (_, i) => pinScale(10 + i, 30, 10));
  assert.ok(Math.max(...curve) > 1.03, "overshoots a little (the bounce)");
  assert.ok(Math.max(...curve) < 1.35, "but not wildly");
  assert.ok(Math.abs(curve[39] - 1) < 0.02, "settles within about a second");
});

test("the label follows the pin: hidden, then slides up while fading in", () => {
  const popAt = 20;
  const start = popAt + MOTION.label.delayFrames;
  assert.deepEqual(labelMotion(start - 1, popAt), { opacity: 0, dy: MOTION.label.risePx });
  const mid = labelMotion(start + Math.floor(MOTION.label.fadeFrames / 2), popAt);
  assert.ok(mid.opacity > 0 && mid.opacity < 1 && mid.dy > 0 && mid.dy < MOTION.label.risePx);
  assert.deepEqual(labelMotion(start + MOTION.label.fadeFrames, popAt), { opacity: 1, dy: 0 });
});

test("the config is internally consistent", () => {
  assert.ok(MOTION.pin.leadFrames < MOTION.route.transitOutroPad, "the pin pops before the scene ends");
  assert.ok(MOTION.camera.push >= 1, "the camera never zooms out past the map's edge");
  assert.ok(MOTION.finale.holdFrames >= 40 && MOTION.finale.holdFrames <= 50, "the finale holds about 1.5 s");
});
