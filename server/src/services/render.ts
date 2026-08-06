import fs from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { DATA_DIR, REMOTION_ENTRY, REMOTION_PUBLIC_DIR, VIDEO_DIMENSIONS } from "../config.js";
import { readTrip, tripAudioDir, tripOutputDir, writeTrip } from "../lib/tripStore.js";
import { generateNarration, generateOpeningNarration } from "./narration.js";
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
  setJob(tripId, { state: "narrating", progress: 0, message: "Writing narration...", error: undefined, warnings: undefined });

  runJob(tripId).catch((err) => {
    setJob(tripId, { state: "error", error: String(err?.message ?? err) });
  });
}

async function runJob(tripId: string): Promise<void> {
  const trip = await readTrip(tripId);

  // 1. Narration - both per-stop and the opening title card line. Skipped
  // whenever text is already present, which lets a user pre-write/edit
  // narration via the UI before rendering and have that text used as-is.
  if (!trip.titleCardNarration) {
    setJob(tripId, { message: "Writing opening line..." });
    trip.titleCardNarration = await generateOpeningNarration(trip);
    await writeTrip(trip);
  }
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
  const warnings: string[] = [];

  if (!trip.titleCardAudioPath && trip.titleCardNarration) {
    setJob(tripId, { message: "Recording opening line..." });
    try {
      const outFile = path.join(audioDir, "title-card.mp3");
      await synthesizeSpeech(trip.titleCardNarration, outFile);
      trip.titleCardAudioPath = path.relative(DATA_DIR, outFile);
      trip.titleCardAudioDurationSec = await getAudioDurationSec(outFile);
      await writeTrip(trip);
    } catch (err) {
      warnings.push("Voiceover failed for the opening line - it plays silent.");
      console.warn("Title card voiceover failed, continuing without audio:", err);
    }
  }

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
        warnings.push(`Voiceover failed for "${stop.name}" - that stop plays silent.`);
        console.warn(`Voiceover failed for stop "${stop.name}", continuing without audio:`, err);
      }
    }
  }
  if (warnings.length > 0) {
    setJob(tripId, { message: "Voiceover unavailable for some stops, continuing without it..." });
  }

  // 3. Map scenes: which country each stop is in, its cached terrain/outline
  // assets, a real routed line between consecutive stops, and a closure
  // recap scene (with its own generated closing line) wherever a country
  // visit wraps up.
  setJob(tripId, { state: "mapping", message: "Preparing map animation..." });
  const mapScenes = await buildMapScenes(trip.stops, trip.title);
  // buildMapScenes may have generated and cached new closure narration text
  // onto the relevant stops (mutated in place, since it received trip.stops
  // by reference) - persist that now so a later render reuses it too.
  await writeTrip(trip);

  for (const scene of mapScenes) {
    if (!scene.closure || scene.closure.audioPath) continue; // already cached from an earlier render
    const closureStop = trip.stops.find((s) => s.id === scene.toStop.id);
    setJob(tripId, { message: `Recording closing line for ${scene.country.name}...` });
    try {
      const outFile = path.join(audioDir, `closure-${scene.country.iso}-${scene.toStop.id}.mp3`);
      await synthesizeSpeech(scene.closure.narration, outFile);
      scene.closure.audioPath = path.relative(DATA_DIR, outFile);
      scene.closure.audioDurationSec = await getAudioDurationSec(outFile);
      if (closureStop) {
        closureStop.closureAudioPath = scene.closure.audioPath;
        closureStop.closureAudioDurationSec = scene.closure.audioDurationSec;
        await writeTrip(trip);
      }
    } catch (err) {
      warnings.push(`Voiceover failed for the ${scene.country.name} closing line - it plays silent.`);
      console.warn(`Closure voiceover failed for ${scene.country.name}, continuing without audio:`, err);
    }
  }

  // If the trip has no explicit music choice, fall back to whatever track
  // (if any) has been dropped into remotion/public/music/ - doesn't get
  // written back to trip.json, just used for this render. An explicit choice
  // with an empty path means "no music", picked deliberately in the UI.
  const music =
    trip.music !== undefined
      ? trip.music.path
        ? trip.music
        : undefined
      : await findDefaultMusic().then((m) => (m ? { ...m, volume: 0.15 } : undefined));
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

  const dims = VIDEO_DIMENSIONS[tripWithMusic.orientation ?? "landscape"];

  await renderMedia({
    composition: { ...composition, width: dims.width, height: dims.height },
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
    warnings: warnings.length > 0 ? warnings : undefined,
  });
}
