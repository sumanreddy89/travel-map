// Your year as a film, from a text file of cities. No API keys and no download: it uses the
// small map in geo-lite/, or the full Natural Earth data when you have it.
//
//   npm run year -- my-year.txt                          out/year-2026-landscape.mp4
//   npm run year -- my-year.txt --orientation portrait   out/year-2026-portrait.mp4
//
// The file is one city per line, in order: "city | date | how you got there" (plane, train or
// car; plane if left out), for example "Madrid | 2026-03-20 | train". Format and errors:
// lib/yearInput.ts. Road routes for car and train legs come from the public OSRM server while
// the map is prepared; the render itself runs with the network blocked.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { REMOTION_DIR, REPO_ROOT } from "../config.js";
import { parseYearInput, yearTripFields } from "../lib/yearInput.js";
import { buildMapScenes } from "../services/mapScenes.js";
import type { Trip } from "../types.js";

const fail = (msg: string): never => {
  console.error(`\n${msg}`);
  process.exit(1);
};

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--orientation");
const oi = args.indexOf("--orientation");
const orientation = oi === -1 ? "landscape" : args[oi + 1];
if (!file) fail('Usage: npm run year -- my-year.txt [--orientation portrait]\nOne city per line: "city | date | plane, train or car".');
if (orientation !== "landscape" && orientation !== "portrait") fail(`--orientation must be landscape or portrait, not "${orientation}"`);
if (!fs.existsSync(file!)) fail(`Can't find ${file}.`);

const parsed = parseYearInput(fs.readFileSync(file!, "utf-8"));
if (!parsed.ok) fail(`${path.basename(file!)}: ${parsed.error}`);
const year = parsed.ok ? parsed.value : fail("unreachable");

let n = 0;
const now = new Date().toISOString();
const trip: Trip = {
  id: `year-${year.year}`,
  createdAt: now,
  updatedAt: now,
  orientation: orientation as Trip["orientation"],
  ...yearTripFields(year, () => `y${String(++n).padStart(2, "0")}`),
};

console.log(`Preparing the map for ${trip.stops.length} cities (${year.year})...`);
const warnings: string[] = [];
let mapScenes;
try {
  mapScenes = await buildMapScenes(trip.stops, trip.title, warnings, { narrate: false });
} catch (err) {
  fail(
    `Couldn't prepare the map: ${(err as Error).message}\n` +
      "Run `npm run doctor`; it checks the map data and says how to fix it."
  );
}
for (const w of warnings) console.warn(`  ${w}`);

const outDir = path.join(REPO_ROOT, "out");
fs.mkdirSync(outDir, { recursive: true });
const propsFile = path.join(outDir, `year-${year.year}-props.json`);
fs.writeFileSync(propsFile, JSON.stringify({ trip, mapScenes, assetBase: "data" }));

const outName = `year-${year.year}-${orientation}.mp4`;
const r = spawnSync(
  process.execPath,
  [path.join(REMOTION_DIR, "scripts", "demo.mjs"), "render", "--props", propsFile, "--orientation", orientation, "--out", outName],
  { stdio: "inherit" }
);
process.exit(r.status ?? 1);
