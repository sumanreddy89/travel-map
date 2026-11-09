import fs from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { DATA_DIR, REMOTION_ENTRY, REMOTION_PUBLIC_DIR, VIDEO_DIMENSIONS } from "../config.js";
import { readTrip, tripAudioDir, tripOutputDir, updateTrip } from "../lib/tripStore.js";
import { generateNarration, generateOpeningNarration } from "./narration.js";
import { getAudioDurationSec, synthesizeSpeech } from "./tts.js";
import { buildMapScenes } from "./mapScenes.js";
import { findDefaultMusic } from "./music.js";
import type { RenderJob, Stop } from "../types.js";

const jobs = new Map<string, RenderJob>();

export function getJob(tripId: string): RenderJob | undefined {
  return jobs.get(tripId);
}

// Jobs live in memory, so after a server restart a finished video has no job.
// The file on disk is still the source of truth for "there's a video to show".
export async function getRenderStatus(tripId: string): Promise<Partial<RenderJob> & Pick<RenderJob, "tripId" | "state" | "progress">> {
  const job = jobs.get(tripId);
  if (job) return job;
  const outputLocation = path.join(tripOutputDir(tripId), "final.mp4");
  const hasVideo = await fs.access(outputLocation).then(
    () => true,
    () => false
  );
  return hasVideo
    ? { tripId, state: "done", progress: 1, outputPath: path.relative(DATA_DIR, outputLocation) }
    : { tripId, state: "idle", progress: 0 };
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
  if (
    existing &&
    (existing.state === "narrating" ||
      existing.state === "voicing" ||
      existing.state === "mapping" ||
      existing.state === "rendering")
  ) {
    return; // already running
  }
  setJob(tripId, { state: "narrating", progress: 0, message: "Writing narration...", error: undefined, warnings: undefined });

  runJob(tripId).catch((err) => {
    setJob(tripId, { state: "error", error: String(err?.message ?? err) });
  });
}

// The render works from a snapshot of the trip and can run for minutes, so
// results are saved field by field onto the latest copy. Saving the snapshot
// itself would undo anything the user changed in the meantime.
function saveToStop(tripId: string, stopId: string, apply: (latest: Stop) => void): Promise<void> {
  return updateTrip(tripId, (latest) => {
    const stop = latest.stops.find((s) => s.id === stopId);
    if (stop) apply(stop);
  });
}

async function runJob(tripId: string): Promise<void> {
  const trip = await readTrip(tripId);
  const warnings: string[] = [];

  // 1. Narration - both per-stop and the opening title card line. Skipped
  // whenever text is already present, which lets a user pre-write/edit
  // narration via the UI before rendering and have that text used as-is.
  // Best-effort like the voiceover below: a failed line plays silent and is
  // tried again on the next render.
  if (!trip.titleCardNarration) {
    setJob(tripId, { message: "Writing opening line..." });
    try {
      const line = await generateOpeningNarration(trip);
      trip.titleCardNarration = line;
      await updateTrip(tripId, (latest) => {
        if (!latest.titleCardNarration) latest.titleCardNarration = line;
      });
    } catch (err) {
      warnings.push("Narration failed for the opening line - it plays silent.");
      console.warn("Opening narration failed, continuing without it:", err);
    }
  }
  for (const stop of trip.stops) {
    if (!stop.narration) {
      setJob(tripId, { message: `Writing narration for ${stop.name}...` });
      try {
        const line = await generateNarration(trip.title, stop);
        stop.narration = line;
        await saveToStop(tripId, stop.id, (latest) => {
          if (!latest.narration) latest.narration = line;
        });
      } catch (err) {
        warnings.push(`Narration failed for "${stop.name}" - that stop plays silent.`);
        console.warn(`Narration failed for stop "${stop.name}", continuing without it:`, err);
      }
    }
  }

  // 2. Voiceover - best-effort. If TTS fails (e.g. account/plan limits on the
  // configured voice), keep going without audio for that stop rather than
  // aborting the whole render; StopContent falls back to a default duration
  // and skips the <Audio> tag when audioPath is unset.
  setJob(tripId, { state: "voicing", message: "Generating voiceover..." });
  const audioDir = tripAudioDir(tripId);
  await fs.mkdir(audioDir, { recursive: true });

  if (!trip.titleCardAudioPath && trip.titleCardNarration) {
    setJob(tripId, { message: "Recording opening line..." });
    try {
      const outFile = path.join(audioDir, "title-card.mp3");
      await synthesizeSpeech(trip.titleCardNarration, outFile);
      trip.titleCardAudioPath = path.relative(DATA_DIR, outFile);
      trip.titleCardAudioDurationSec = await getAudioDurationSec(outFile);
      // If the text was edited during recording, this audio no longer matches.
      await updateTrip(tripId, (latest) => {
        if (latest.titleCardNarration !== trip.titleCardNarration) return;
        latest.titleCardAudioPath = trip.titleCardAudioPath;
        latest.titleCardAudioDurationSec = trip.titleCardAudioDurationSec;
      });
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
        await saveToStop(tripId, stop.id, (latest) => {
          if (latest.narration !== stop.narration) return;
          latest.audioPath = stop.audioPath;
          latest.audioDurationSec = stop.audioDurationSec;
        });
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
  const mapScenes = await buildMapScenes(trip.stops, trip.title, warnings);
  // buildMapScenes caches new closure and travel lines onto the stops it was
  // given (mutated in place) - persist those so a later render reuses them.
  await updateTrip(tripId, (latest) => {
    for (const stop of trip.stops) {
      const latestStop = latest.stops.find((s) => s.id === stop.id);
      if (!latestStop) continue;
      latestStop.closureNarration = stop.closureNarration;
      latestStop.travelNarration = stop.travelNarration;
      latestStop.travelNarrationKey = stop.travelNarrationKey;
      latestStop.travelAudioPath = stop.travelAudioPath;
      latestStop.travelAudioDurationSec = stop.travelAudioDurationSec;
    }
  });

  for (const scene of mapScenes) {
    // Skip if already cached from an earlier render, or if its text failed.
    if (!scene.closure || scene.closure.audioPath || !scene.closure.narration) continue;
    const closureStop = trip.stops.find((s) => s.id === scene.toStop.id);
    setJob(tripId, { message: `Recording closing line for ${scene.country.name}...` });
    try {
      const outFile = path.join(audioDir, `closure-${scene.country.iso}-${scene.toStop.id}.mp3`);
      await synthesizeSpeech(scene.closure.narration, outFile);
      scene.closure.audioPath = path.relative(DATA_DIR, outFile);
      scene.closure.audioDurationSec = await getAudioDurationSec(outFile);
      if (closureStop) {
        const { narration, audioPath, audioDurationSec } = scene.closure;
        closureStop.closureAudioPath = audioPath;
        closureStop.closureAudioDurationSec = audioDurationSec;
        await saveToStop(tripId, closureStop.id, (latest) => {
          if (latest.closureNarration !== narration) return;
          latest.closureAudioPath = audioPath;
          latest.closureAudioDurationSec = audioDurationSec;
        });
      }
    } catch (err) {
      warnings.push(`Voiceover failed for the ${scene.country.name} closing line - it plays silent.`);
      console.warn(`Closure voiceover failed for ${scene.country.name}, continuing without audio:`, err);
    }
  }

  for (const scene of mapScenes) {
    if (!scene.travel || scene.travel.audioPath) continue; // already cached from an earlier render
    const destStop = trip.stops.find((s) => s.id === scene.toStop.id);
    setJob(tripId, { message: `Recording transition to ${scene.toStop.name}...` });
    try {
      const outFile = path.join(audioDir, `travel-${scene.toStop.id}.mp3`);
      await synthesizeSpeech(scene.travel.narration, outFile);
      scene.travel.audioPath = path.relative(DATA_DIR, outFile);
      scene.travel.audioDurationSec = await getAudioDurationSec(outFile);
      if (destStop) {
        const { narration, audioPath, audioDurationSec } = scene.travel;
        destStop.travelAudioPath = audioPath;
        destStop.travelAudioDurationSec = audioDurationSec;
        await saveToStop(tripId, destStop.id, (latest) => {
          if (latest.travelNarration !== narration) return;
          latest.travelAudioPath = audioPath;
          latest.travelAudioDurationSec = audioDurationSec;
        });
      }
    } catch (err) {
      warnings.push(`Voiceover failed for the transition to "${scene.toStop.name}" - it plays silent.`);
      console.warn(`Travel voiceover failed for transition to ${scene.toStop.name}, continuing without audio:`, err);
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
