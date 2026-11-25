// Run: npm test (from the repo root)
import { test } from "node:test";
import assert from "node:assert/strict";
import { greatCircleKm, yearStats, type StatsStop } from "./yearStats";

const LIS: StatsStop = { name: "Lisbon", lat: 38.7223, lng: -9.1393, country: "Portugal" };
const MAD: StatsStop = { name: "Madrid", lat: 40.4168, lng: -3.7038, country: "Spain" };
const BCN: StatsStop = { name: "Barcelona", lat: 41.3874, lng: 2.1686, country: "Spain" };
const NYC: StatsStop = { name: "New York", lat: 40.7128, lng: -74.006, country: "United States" };
const near = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b} (±${tol})`);

test("great-circle distance matches known figures", () => {
  near(greatCircleKm(LIS, MAD), 503, 3);
  near(greatCircleKm(MAD, NYC), 5770, 15);
  assert.equal(greatCircleKm(MAD, MAD), 0);
  near(greatCircleKm({ lat: 0, lng: 179.5 }, { lat: 0, lng: -179.5 }), 111, 1); // across the date line, the short way
});

test("a normal year: countries, cities, rounded total, flights and the longest leg", () => {
  const s = yearStats([LIS, { ...MAD, mode: "plane" }, { ...BCN, mode: "train" }, { ...NYC, mode: "plane" }]);
  assert.equal(s.countries, 3);
  assert.equal(s.cities, 4);
  assert.equal(s.flights, 2);
  assert.equal(s.distanceKm, Math.round(greatCircleKm(LIS, MAD) + greatCircleKm(MAD, BCN) + greatCircleKm(BCN, NYC)));
  assert.deepEqual(s.longestLeg, { from: "Barcelona", to: "New York", km: Math.round(greatCircleKm(BCN, NYC)) });
});

test("one city: nothing travelled", () => {
  assert.deepEqual(yearStats([LIS]), { countries: 1, cities: 1, distanceKm: 0, flights: 0, longestLeg: null });
  assert.deepEqual(yearStats([]), { countries: 0, cities: 0, distanceKm: 0, flights: 0, longestLeg: null });
});

test("a repeated city counts once as a city but every trip to it counts as distance", () => {
  const s = yearStats([LIS, { ...MAD, mode: "plane" }, { ...LIS, mode: "plane" }]);
  assert.equal(s.cities, 2);
  assert.equal(s.countries, 2);
  assert.equal(s.flights, 2);
  near(s.distanceKm, 2 * 503, 6);
});

test("the same city twice in a row isn't a leg", () => {
  const s = yearStats([MAD, { ...MAD, mode: "plane" }, { ...BCN, mode: "train" }]);
  assert.equal(s.flights, 0);
  assert.equal(s.cities, 2);
  assert.equal(s.longestLeg?.from, "Madrid");
});

test("all in one country", () => {
  const s = yearStats([MAD, { ...BCN, mode: "train" }]);
  assert.equal(s.countries, 1);
  assert.equal(s.flights, 0);
  near(s.distanceKm, 505, 4);
});

test("same name in two countries is two cities; a missing country isn't counted", () => {
  const s = yearStats([{ name: "Valencia", lat: 39.47, lng: -0.38, country: "Spain" }, { name: "Valencia", lat: 10.16, lng: -68.0, country: "Venezuela", mode: "plane" }, { name: "Nowhere", lat: 0, lng: 0 }]);
  assert.equal(s.cities, 3);
  assert.equal(s.countries, 2);
});
