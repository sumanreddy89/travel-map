import { test } from "node:test";
import assert from "node:assert/strict";
import { AUTO_CAR_MAX_KM, AUTO_TRAIN_MAX_KM, followsRoads, isTravelModeChoice, legMode } from "./travelMode.js";

test("an explicit mode wins over distance", () => {
  assert.equal(legMode("plane", 50), "plane");
  assert.equal(legMode("car", 2000), "car");
});

test('"auto" picks car, train or plane by distance', () => {
  assert.equal(legMode("auto", 10), "car");
  assert.equal(legMode("auto", AUTO_CAR_MAX_KM), "car");
  assert.equal(legMode("auto", AUTO_CAR_MAX_KM + 1), "train");
  assert.equal(legMode("auto", AUTO_TRAIN_MAX_KM), "train");
  assert.equal(legMode("auto", AUTO_TRAIN_MAX_KM + 1), "plane");
});

test("no mode, or an unknown one, means the plain dot", () => {
  assert.equal(legMode(undefined, 300), undefined);
  assert.equal(legMode("bicycle" as never, 300), undefined);
});

test("only flights skip the road route", () => {
  assert.equal(followsRoads("plane"), false);
  assert.equal(followsRoads("train"), true);
  assert.equal(followsRoads(undefined), true);
  assert.ok(isTravelModeChoice("auto") && isTravelModeChoice("train") && !isTravelModeChoice("boat"));
});
