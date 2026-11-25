// Run: npm test --workspace server
// Route-level check that a rejected update leaves the saved trip exactly as it was.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

process.env.TRAVELMAP_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "travelmap-test-"));
const express = (await import("express")).default;
const { tripsRouter } = await import("./trips.js");

const app = express();
app.use(express.json());
app.use("/api/trips", tripsRouter);
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/trips`;
after(() => {
  server.close();
  fs.rmSync(process.env.TRAVELMAP_DATA_DIR as string, { recursive: true, force: true });
});

const send = (method: string, url: string, body?: unknown) =>
  fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

test("a rejected trip or stop update leaves the saved trip unchanged", async () => {
  const trip = await (await send("POST", base, { title: "Route test" })).json();
  const stop = await (await send("POST", `${base}/${trip.id}/stops`, { name: "Lisbon", lat: 38.72, lng: -9.14 })).json();
  const saved = await (await send("GET", `${base}/${trip.id}`)).text();

  for (const [url, body] of [
    [`${base}/${trip.id}`, { orientation: "square" }],
    [`${base}/${trip.id}`, { title: "Renamed", music: { path: "../server/.env", volume: 0.5 } }],
    [`${base}/${trip.id}/stops/${stop.id}`, { name: "Moved", lat: 95 }],
  ] as const) {
    const res = await send("PUT", url, body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.ok((await res.json()).error);
  }
  assert.equal(await (await send("GET", `${base}/${trip.id}`)).text(), saved);
  assert.equal((await send("POST", `${base}/${trip.id}/stops`, { name: "Nowhere", lat: 0, lng: 181 })).status, 400);
  assert.equal(await (await send("GET", `${base}/${trip.id}`)).text(), saved);
});

test("the credit setting is saved, and a bad value changes nothing", async () => {
  const trip = await (await send("POST", base, { title: "Credit test" })).json();
  assert.equal(trip.showWatermark, undefined, "new trips leave it unset, which means shown");
  assert.equal((await send("PUT", `${base}/${trip.id}`, { showWatermark: false })).status, 200);
  const saved = await (await send("GET", `${base}/${trip.id}`)).text();
  assert.equal(JSON.parse(saved).showWatermark, false);
  assert.equal((await send("PUT", `${base}/${trip.id}`, { showWatermark: "yes" })).status, 400);
  assert.equal(await (await send("GET", `${base}/${trip.id}`)).text(), saved);
});

test("Year in travel: a pasted list becomes a trip; a malformed line is a 400 that names it", async () => {
  const bad = await send("POST", `${base}/year`, { text: "Lisbon | 2026-02-14\nMadrid | someday" });
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).error, /^Line 2: "someday" isn't a date/);
  assert.equal((await send("POST", `${base}/year`, {})).status, 400);

  const res = await send("POST", `${base}/year`, { text: "Lisbon | 2026-02-14\nMadrid | 2026-03-20\nBarcelona | 2026-04-02 | train" });
  assert.equal(res.status, 201);
  const trip = await res.json();
  assert.equal(trip.title, "2026 in travel");
  assert.deepEqual(trip.yearInTravel, { year: 2026 });
  assert.deepEqual(trip.stops.map((s: { name: string; travelMode: string; date: string }) => [s.name, s.travelMode, s.date]), [
    ["Lisbon", "plane", "14 Feb"],
    ["Madrid", "plane", "20 Mar"],
    ["Barcelona", "train", "2 Apr"],
  ]);
  const again = await (await send("GET", `${base}/${trip.id}`)).json();
  assert.equal(again.stops.length, 3);
});
