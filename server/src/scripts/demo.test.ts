// Run: npm test --workspace server
// Guards the keyless demo (npm run demo:render): everything it renders is checked in, nothing in it
// points at the network, and it stays stable between rebuilds. Rendering itself is checked by
// `npm run demo:render`, which blocks all outside requests and fails if anything tries one.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { REMOTION_DIR, REMOTION_PUBLIC_DIR } from "../config.js";
import { validateNewStop, validateTripPatch } from "../lib/validateTrip.js";

const props = JSON.parse(fs.readFileSync(path.join(REMOTION_DIR, "src", "demo", "demoProps.json"), "utf-8"));
const exists = (rel: string) => fs.existsSync(path.join(REMOTION_PUBLIC_DIR, rel));

test("every file the demo renders is checked in", () => {
  assert.equal(props.assetBase, "demo");
  for (const stop of props.trip.stops) {
    assert.ok(stop.media.length > 0, `${stop.name} has a photo`);
    for (const m of stop.media) assert.ok(exists(`demo/${m.path}`), m.path);
  }
  for (const scene of props.mapScenes) {
    assert.match(scene.country.terrainRelPath, /^demo\/terrain\/[A-Z]{3}[-0-9_]*\.png$/);
    assert.ok(exists(scene.country.terrainRelPath), scene.country.terrainRelPath);
  }
  assert.ok(exists("fonts/Oswald-Variable.ttf"));
  assert.ok(exists("fonts/Oswald-OFL.txt"), "the font's licence ships with it");
});

test("the demo's voiceover is checked in, every line is voiced, and nothing points at the web", () => {
  const raw = JSON.stringify(props);
  assert.doesNotMatch(raw, /https?:\/\//);
  // Voiced once by voiceDemo.ts and checked in, so rendering needs no key.
  const lines: [string | undefined, string | undefined][] = [
    [props.trip.titleCardNarration, props.trip.titleCardAudioPath],
    ...props.trip.stops.map((s: { narration?: string; audioPath?: string }) => [s.narration, s.audioPath] as [string | undefined, string | undefined]),
    ...props.mapScenes.flatMap((sc: { travel?: { narration?: string; audioPath?: string }; closure?: { narration?: string; audioPath?: string } }) =>
      [sc.travel, sc.closure].filter(Boolean).map((x) => [x!.narration, x!.audioPath] as [string | undefined, string | undefined])),
  ];
  for (const [text, audio] of lines) {
    if (!text) continue;
    assert.match(String(audio), /^voice\/[a-z0-9-]+\.mp3$/, `"${text}" has a voice file`);
    assert.ok(exists(`demo/${audio}`), `${audio} is checked in`);
  }
  // The one track in the repo, included with its owner's permission for the demo only (NOTICE.md).
  assert.equal(props.trip.music?.path, "demo/music/the-winding-path-travel.mp3");
  assert.ok(exists(props.trip.music.path), "the demo track is checked in");
});

test("scenes never fetch fonts from the web", () => {
  const dir = path.join(REMOTION_DIR, "src");
  const files = fs.readdirSync(dir, { recursive: true }).map(String).filter((f) => /\.tsx?$/.test(f));
  for (const f of files) assert.doesNotMatch(fs.readFileSync(path.join(dir, f), "utf-8"), /from\s+["']@remotion\/google-fonts|https?:\/\/fonts\.(googleapis|gstatic)/, f);
});

test("the demo trip is stable and valid", () => {
  const { trip } = props;
  assert.equal(trip.id, "demo-trip0");
  assert.equal(trip.createdAt, "2026-11-23T00:00:00.000Z");
  assert.equal(validateTripPatch({ title: trip.title, orientation: trip.orientation, titleCardNarration: trip.titleCardNarration }).ok, true);
  for (const s of trip.stops) assert.equal(validateNewStop(s).ok, true, s.name);
  // 30-60 seconds at 30fps is checked on the rendered file; here, at least the routes are precomputed.
  assert.ok(props.mapScenes.filter((s: { currentLeg?: unknown }) => s.currentLeg).length >= 2);
});

// Regressions found while building the demo (23 Nov 2026). Both made renders differ run to run:
// the terrain is an SVG <image> Remotion doesn't wait for, so early map-scene frames could show a
// flat country; and a font wait started at module load was sometimes never cleared in a parallel
// render tab, failing the render. Verified fix: three demo renders came out byte-identical.
test("map scenes wait for their terrain, and the font wait lives in a component", () => {
  const src = (f: string) => fs.readFileSync(path.join(REMOTION_DIR, "src", f), "utf-8");
  assert.match(src("scenes/MapTransition.tsx"), /useTerrainReady\(staticFile\(scene\.country\.terrainRelPath\)\)/);
  assert.match(src("TripVideo.tsx"), /useBundledFont\(\);/);
  // no delayRender outside a hook in the font module
  assert.doesNotMatch(src("lib/fonts.ts").replace(/export function useBundledFont[\s\S]*$/, ""), /delayRender\(/);
});

test("the Year in travel demo is checked in, keyless, and every demo texture is used", () => {
  const year = JSON.parse(fs.readFileSync(path.join(REMOTION_DIR, "src", "demo", "yearDemoProps.json"), "utf-8"));
  assert.equal(year.assetBase, "demo");
  assert.match(String(year.trip.yearInTravel?.year), /^\d{4}$/);
  assert.ok(year.trip.stops.length >= 6 && year.trip.stops.length <= 8, "a sample year of 6 to 8 cities");
  const raw = JSON.stringify(year);
  assert.ok(!/https?:\/\//.test(raw), "no web addresses to fetch");
  assert.ok(!/audioPath/.test(raw), "no voiceover");
  const used = new Set<string>();
  for (const p of [props, year]) for (const scene of p.mapScenes) {
    assert.ok(exists(scene.country.terrainRelPath), scene.country.terrainRelPath);
    used.add(path.basename(scene.country.terrainRelPath));
  }
  for (const f of fs.readdirSync(path.join(REMOTION_PUBLIC_DIR, "demo", "terrain"))) assert.ok(used.has(f), `${f} isn't used by either demo`);
});
