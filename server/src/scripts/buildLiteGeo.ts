// Builds the small bundled map in geo-lite/ (checked in, about 11 MB) from the full Natural
// Earth download, so `npm run year` works on a fresh clone with no download. Run it only when
// the full data changes:
//
//   npx tsx server/src/scripts/buildLiteGeo.ts
//
// Needs data/geo-raw (the README's "Cartography data" step) and its converted JSON. Boundaries
// are simplified to the same 0.01-degree tolerance the map draws at, so countries look the
// same; provinces are coarser (0.02) and the relief is half resolution (8100 x 4050).
import fs from "node:fs/promises";
import path from "node:path";
import * as turf from "@turf/turf";
import sharp from "sharp";
import { REMOTION_PUBLIC_DIR, REPO_ROOT } from "../config.js";
import { LITE_DIR } from "../services/geo.js";

const round = (c: unknown): unknown =>
  Array.isArray(c) ? (typeof c[0] === "number" ? c.map((x: number) => Math.round(x * 1000) / 1000) : c.map(round)) : c;

// Rounding can make neighbouring points equal; a ring needs 4 points (first = last) to be valid.
const dedupe = (ring: number[][]) => ring.filter((p, i) => i === 0 || p[0] !== ring[i - 1][0] || p[1] !== ring[i - 1][1]);

async function simplifyFile(name: string, tolerance: number) {
  const fc = JSON.parse(await fs.readFile(path.join(REMOTION_PUBLIC_DIR, "geo", name), "utf-8")) as GeoJSON.FeatureCollection;
  const features = fc.features
    .filter((f) => f.geometry)
    .map((f) => {
      const s = turf.simplify(f as any, { tolerance, highQuality: false }) as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
      const polygons = (s.geometry.type === "Polygon" ? [s.geometry.coordinates] : s.geometry.coordinates)
        .map((poly) => (round(poly) as number[][][]).map(dedupe).filter((ring) => ring.length >= 4))
        // Islands smaller than the tolerance collapse to a sliver; drop them, holes included.
        .filter((poly) => poly.length > 0 && poly[0].length >= 4);
      return polygons.length ? { ...s, geometry: { type: "MultiPolygon" as const, coordinates: polygons } } : null;
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);
  await fs.writeFile(path.join(LITE_DIR, name), JSON.stringify({ type: "FeatureCollection", features }));
  console.log(`${name}: ${features.length} features`);
}

await fs.mkdir(LITE_DIR, { recursive: true });
await simplifyFile("countries.json", 0.01);
await simplifyFile("admin1.json", 0.02);
const relief = path.join(REPO_ROOT, "data", "geo-raw", "relief_hr", "NE1_LR_LC_SR_W.tif");
await sharp(relief, { limitInputPixels: false }).resize(8100, 4050).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(LITE_DIR, "relief.jpg"));
console.log("relief.jpg: 8100 x 4050");
