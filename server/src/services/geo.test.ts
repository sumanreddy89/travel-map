import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { LITE_DIR, pickGeoSource } from "./geo.js";

test("map data: the full download only when all three files are there, else the bundled lite map", () => {
  assert.equal(pickGeoSource(() => true).kind, "full");
  assert.equal(pickGeoSource(() => false).kind, "lite");
  // Converted boundaries without the relief raster: still lite, so the terrain never goes missing.
  assert.equal(pickGeoSource((p) => p.endsWith(".json")).kind, "lite");
});

test("the lite map is checked in, so a fresh clone can make a film with no download", () => {
  for (const f of ["countries.json", "admin1.json", "relief.jpg"]) assert.ok(fs.existsSync(`${LITE_DIR}/${f}`), `geo-lite/${f} is missing`);
  const lite = pickGeoSource(() => false);
  const countries = JSON.parse(fs.readFileSync(lite.countries, "utf-8"));
  assert.ok(countries.features.length > 200);
  assert.ok(countries.features.some((f: any) => f.properties.iso_a3 === "PRT"));
});

test("every lite shape is a valid polygon (a sliver island once broke the year film)", () => {
  const lite = pickGeoSource(() => false);
  for (const file of [lite.countries, lite.admin1]) {
    for (const f of JSON.parse(fs.readFileSync(file, "utf-8")).features) {
      const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const poly of polys) for (const ring of poly) assert.ok(ring.length >= 4, `${f.properties.name}: a ring with ${ring.length} points`);
    }
  }
});
