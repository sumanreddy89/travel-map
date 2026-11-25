// Maintainers only: rebuilds the checked-in demo from server/src/scripts/demo-source/trip.json.
//
//   npx tsx src/scripts/buildDemo.ts        (from server/) the trip demo, "Porto to Palma"
//   npx tsx src/scripts/buildDemo.ts year   the "Year in travel" demo, from demo-source/year.txt
//
// Needs the full Natural Earth data (README: full workflow) and makes one-off route requests to the
// public OSRM server. Its output is everything `npm run demo:render` needs, so the demo itself
// never touches the network, the API server or any paid service:
//   remotion/src/demo/demoProps.json   fixed render props: trip, map scenes, precomputed routes
//   remotion/public/demo/terrain/      the terrain textures those scenes use
// Photos in remotion/public/demo/media/ are added by hand; see docs/demo/ASSETS.md.
import fs from "node:fs/promises";
import path from "node:path";
import { REMOTION_DIR, REMOTION_PUBLIC_DIR } from "../config.js";
import { buildMapScenes } from "../services/mapScenes.js";
import type { MediaItem, Stop, Trip } from "../types.js";
import { parseYearInput, yearTripFields } from "../lib/yearInput.js";

const SOURCE = path.join(path.dirname(new URL(import.meta.url).pathname), "demo-source", "trip.json");
const DEMO_PUBLIC = path.join(REMOTION_PUBLIC_DIR, "demo");
const YEAR = process.argv[2] === "year";
const YEAR_SOURCE = path.join(path.dirname(new URL(import.meta.url).pathname), "demo-source", "year.txt");
const PROPS_FILE = path.join(REMOTION_DIR, "src", "demo", YEAR ? "yearDemoProps.json" : "demoProps.json");
// Fixed, so rebuilding without changes produces identical files.
const FIXED_TIME = "2026-11-23T00:00:00.000Z";

type SourceStop = Omit<Stop, "media"> & { media: string[] };
type Source = Omit<Trip, "id" | "createdAt" | "updatedAt" | "stops"> & { stops: SourceStop[] };

async function loadYearTrip(): Promise<Trip> {
  const parsed = parseYearInput(await fs.readFile(YEAR_SOURCE, "utf-8"));
  if (!parsed.ok) throw new Error(`demo-source/year.txt: ${parsed.error}`);
  let n = 0;
  const fields = yearTripFields(parsed.value, () => `demo-y${String(++n).padStart(2, "0")}`);
  return { id: "demo-year0", createdAt: FIXED_TIME, updatedAt: FIXED_TIME, orientation: "landscape", ...fields };
}

async function main() {
  if (YEAR) {
    const trip = await loadYearTrip();
    const warnings: string[] = [];
    const mapScenes = await buildMapScenes(trip.stops, trip.title, warnings, { narrate: false });
    if (warnings.length) throw new Error(`Year demo:\n${warnings.join("\n")}`);
    return writeDemo(trip, mapScenes);
  }
  const source: Source = JSON.parse(await fs.readFile(SOURCE, "utf-8"));
  const stops: Stop[] = [];
  for (const s of source.stops) {
    const media: MediaItem[] = [];
    for (const [i, file] of s.media.entries()) {
      await fs.access(path.join(DEMO_PUBLIC, "media", file)); // fail early on a missing photo
      media.push({ id: `${s.id.slice(0, 7)}-p${i}`, type: "photo", path: `media/${file}` });
    }
    stops.push({ ...s, media });
  }
  const trip: Trip = { ...source, id: "demo-trip0", createdAt: FIXED_TIME, updatedAt: FIXED_TIME, stops };

  const warnings: string[] = [];
  const mapScenes = await buildMapScenes(stops, trip.title, warnings);
  // All narration is pre-written in the source, so a warning here means a line would be missing.
  if (warnings.length) throw new Error(`Demo source is incomplete:\n${warnings.join("\n")}`);

  return writeDemo(trip, mapScenes);
}

// Both demos share demo/terrain/, so textures are added, never cleared; demo.test.ts checks that
// every texture there is used by one of them.
async function writeDemo(trip: Trip, mapScenes: Awaited<ReturnType<typeof buildMapScenes>>) {
  await fs.mkdir(path.join(DEMO_PUBLIC, "terrain"), { recursive: true });
  for (const scene of mapScenes) {
    const file = path.basename(scene.country.terrainRelPath);
    await fs.copyFile(path.join(REMOTION_PUBLIC_DIR, scene.country.terrainRelPath), path.join(DEMO_PUBLIC, "terrain", file));
    scene.country.terrainRelPath = `demo/terrain/${file}`;
  }

  await fs.mkdir(path.dirname(PROPS_FILE), { recursive: true });
  await fs.writeFile(PROPS_FILE, JSON.stringify({ trip, mapScenes, assetBase: "demo" }) + "\n");
  const routed = mapScenes.filter((s) => s.currentLeg?.routeCoords).length;
  console.log(`Wrote ${path.relative(process.cwd(), PROPS_FILE)}: ${mapScenes.length} map scenes, ${routed} with road routes`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
