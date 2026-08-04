import fs from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import {
  DATA_DIR,
  REMOTION_ENTRY,
  REMOTION_PUBLIC_DIR,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "../config.js";
import { readTrip, tripAudioDir, tripOutputDir, writeTrip } from "../lib/tripStore.js";
import { generateNarration } from "./narration.js";
import { getAudioDurationSec, synthesizeSpeech } from "./tts.js";
import { buildMapScenes } from "./mapScenes.js";
import { findDefaultMusic } from "./music.js";
import type { RenderJob } from "../types.js";

const jobs = new Map<string, RenderJob>();

export function getJob(tripId: string): RenderJob | undefined {
  return jobs.get(tripId);
}

function setJob(tripId: string, patch: Partial<RenderJob>) {
  const existing = jobs.get(tripId);
  const now = new Date().toISOString();
  const job: RenderJob = {
    tripId,
    state: "idle",
    progress: 0,
    startedAt: existing?.startedAt ?? now,
    updatedAt: now,
    ...existing,
    ...patch,
  };
  jobs.set(tripId, job);
  return job;
}

async function ensurePublicDataLink() {
  const linkPath = path.join(REMOTION_PUBLIC_DIR, "data");
  await fs.mkdir(REMOTION_PUBLIC_DIR, { recursive: true });
  try {
    const stat = await fs.lstat(linkPath);
    if (stat.isSymbolicLink() || stat.isDirectory()) return;
  } catch {
    // doesn't exist yet, create it
  }
  await fs.symlink(DATA_DIR, linkPath, "dir").catch(async (err) => {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
  });
}

export async function startRenderJob(tripId: string): Promise<void> {
  const existing = jobs.get(tripId);
  if (existing && (existing.state === "narrating" || existing.state === "voicing" || existing.state === "rendering")) {
    return; // already running
  }
  setJob(tripId, { state: "narrating", progress: 0, message: "Writing narration...", error: undefined });

  runJob(tripId).catch((err) => {
    setJob(tripId, { state: "error", error: String(err?.message ?? err) });
  });
}

async function runJob(tripId: string): Promise<void> {
  const trip = await readTrip(tripId);

  // 1. Narration
  for (const stop of trip.stops) {
    if (!stop.narration) {
      setJob(tripId, { message: `Writing narration for ${stop.name}...` });
      stop.narration = await generateNarration(trip.title, stop);
      await writeTrip(trip);
    }
  }

  // 2. Voiceover - best-effort. If TTS fails (e.g. account/plan limits on the
  // configured voice), keep going without audio for that stop rather than
  // aborting the whole render; StopContent falls back to a default duration
  // and skips the <Audio> tag when audioPath is unset.
  setJob(tripId, { state: "voicing", message: "Generating voiceover..." });
  const audioDir = tripAudioDir(tripId);
  await fs.mkdir(audioDir, { recursive: true });
  let voiceoverFailed = false;
  for (const stop of trip.stops) {
    if (!stop.audioPath && stop.narration) {
      setJob(tripId, { message: `Recording voiceover for ${stop.name}...` });
      try {
        const outFile = path.join(audioDir, `${stop.id}.mp3`);
        await synthesizeSpeech(stop.narration, outFile);
        stop.audioPath = path.relative(DATA_DIR, outFile);
        stop.audioDurationSec = await getAudioDurationSec(outFile);
        await writeTrip(trip);
      } catch (err) {
        voiceoverFailed = true;
        console.warn(`Voiceover failed for stop "${stop.name}", continuing without audio:`, err);
      }
    }
  }
  if (voiceoverFailed) {
    setJob(tripId, { message: "Voiceover unavailable, continuing without narration audio..." });
  }

  // 3. Map scenes: which country each stop is in, its cached terrain/outline
  // assets, a real routed line between consecutive stops, and a closure
  // recap scene (with its own generated closing line) wherever a country
  // visit wraps up.
  setJob(tripId, { state: "mapping", message: "Preparing map animation..." });
  const mapScenes = await buildMapScenes(trip.stops, trip.title);

  for (const scene of mapScenes) {
    if (!scene.closure) continue;
    setJob(tripId, { message: `Recording closing line for ${scene.country.name}...` });
    try {
      const outFile = path.join(audioDir, `closure-${scene.country.iso}-${scene.toStop.id}.mp3`);
      await synthesizeSpeech(scene.closure.narration, outFile);
      scene.closure.audioPath = path.relative(DATA_DIR, outFile);
      scene.closure.audioDurationSec = await getAudioDurationSec(outFile);
    } catch (err) {
      console.warn(`Closure voiceover failed for ${scene.country.name}, continuing without audio:`, err);
    }
  }

  // If the trip has no explicit music choice, fall back to whatever track
  // (if any) has been dropped into remotion/public/music/ - doesn't get
  // written back to trip.json, just used for this render.
  const music = trip.music ?? (await findDefaultMusic().then((m) => (m ? { ...m, volume: 0.15 } : undefined)));
  const tripWithMusic = { ...trip, music };

  // 4. Render
  setJob(tripId, { state: "rendering", progress: 0, message: "Bundling video project..." });
  await ensurePublicDataLink();
  const serveUrl = await bundle({ entryPoint: REMOTION_ENTRY });

  setJob(tripId, { message: "Rendering video..." });
  const inputProps = { trip: tripWithMusic, mapScenes };
  const composition = await selectComposition({
    serveUrl,
    id: "TripVideo",
    inputProps,
  });

  const outputDir = tripOutputDir(tripId);
  await fs.mkdir(outputDir, { recursive: true });
  const outputLocation = path.join(outputDir, "final.mp4");

  await renderMedia({
    composition: { ...composition, width: VIDEO_WIDTH, height: VIDEO_HEIGHT },
    serveUrl,
    codec: "h264",
    outputLocation,
    inputProps,
    // Default is 30s per frame - long, media-heavy trips (lots of photos,
    // several stops) can occasionally spike past that on an ordinary slower
    // disk/CPU, so give real renders more headroom before giving up.
    timeoutInMilliseconds: 120_000,
    onProgress: ({ progress }) => {
      setJob(tripId, { progress });
    },
  });

  setJob(tripId, {
    state: "done",
    progress: 1,
    message: "Done",
    outputPath: path.relative(DATA_DIR, outputLocation),
  });
}
