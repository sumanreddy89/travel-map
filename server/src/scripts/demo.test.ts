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

test("the demo has no voiceover files and no web addresses to fetch", () => {
  const raw = JSON.stringify(props);
  assert.doesNotMatch(raw, /https?:\/\//);
  assert.doesNotMatch(raw, /"(audioPath|titleCardAudioPath|travelAudioPath|closureAudioPath)"/);
  assert.equal(props.trip.music, undefined, "no music: none is licensed for redistribution");
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
