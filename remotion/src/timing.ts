import type { Stop, MapScene } from "./types";

export const FPS = 30;

const MAP_ARRIVAL_BASE_SEC = 3.5;
const MAP_TRANSIT_BASE_SEC = 5.5;
const MAP_PER_PHOTO_SEC = 1.8;
const MAP_MAX_PHOTOS_COUNTED = 4;
const MAP_PER_PRIOR_LEG_SEC = 0.6;
const MAP_MAX_PRIOR_LEGS_COUNTED = 5;
const STOP_MIN_SEC = 4.5;
const STOP_PER_MEDIA_SEC = 3.5;
const CLOSURE_MIN_SEC = 4.5;
const TITLE_CARD_MIN_SEC = 3;

export function secToFrames(sec: number): number {
  return Math.round(sec * FPS);
}

// mediaCount is the destination stop's media count - the map scene's side
// panel shows those photos, so it gets more time to breathe when there's
// more to look at, same pacing idea as stopSceneDurationSec below. A scene
// with prior (already-travelled) legs also gets a small bonus since there's
// more accumulated route on screen to take in.
export function mapSceneDurationSec(
  scene: Pick<MapScene, "currentLeg" | "priorLegs" | "travel">,
  mediaCount = 0
): number {
  const base = scene.currentLeg ? MAP_TRANSIT_BASE_SEC : MAP_ARRIVAL_BASE_SEC;
  const priorBonus = Math.min(scene.priorLegs.length, MAP_MAX_PRIOR_LEGS_COUNTED) * MAP_PER_PRIOR_LEG_SEC;
  const computed = base + Math.min(mediaCount, MAP_MAX_PHOTOS_COUNTED) * MAP_PER_PHOTO_SEC + priorBonus;
  // Don't let the scene cut away mid-sentence on a leg whose transit line
  // happens to run longer than the usual pacing would allow for.
  const travelAudioSec = scene.travel?.audioDurationSec;
  return travelAudioSec ? Math.max(computed, travelAudioSec + 1) : computed;
}

export function stopSceneDurationSec(stop: Pick<Stop, "audioDurationSec" | "media">): number {
  if (stop.audioDurationSec) return Math.max(STOP_MIN_SEC, stop.audioDurationSec + 1);
  const mediaCount = Math.max(1, stop.media.length);
  return Math.max(STOP_MIN_SEC, mediaCount * STOP_PER_MEDIA_SEC);
}

export function closureSceneDurationSec(scene: Pick<MapScene, "closure">): number {
  const audioSec = scene.closure?.audioDurationSec;
  return audioSec ? Math.max(CLOSURE_MIN_SEC, audioSec + 1) : CLOSURE_MIN_SEC;
}

export function titleCardDurationSec(trip: { titleCardAudioDurationSec?: number }): number {
  const audioSec = trip.titleCardAudioDurationSec;
  return audioSec ? Math.max(TITLE_CARD_MIN_SEC, audioSec + 1) : TITLE_CARD_MIN_SEC;
}
