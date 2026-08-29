export type MediaItem = {
  id: string;
  type: "photo" | "video";
  path: string; // relative to DATA_DIR, e.g. "trips/<id>/media/<stopId>/file.jpg"
  durationSec?: number; // for video: trimmed length to use
};

export type Stop = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  date?: string;
  notes?: string;
  media: MediaItem[];
  narration?: string;
  audioPath?: string; // relative to DATA_DIR
  audioDurationSec?: number;
  // Set only on whichever stop ends up being the last one in a country visit -
  // caches that visit's closure recap line the same way narration/audioPath
  // above cache this stop's own line, so it isn't regenerated (and re-rolled
  // against a fresh TTS call) on every single render.
  closureNarration?: string;
  closureAudioPath?: string; // relative to DATA_DIR
  closureAudioDurationSec?: number;
  // Set on whichever stop is the destination of a travelled leg (i.e. every
  // stop except the trip's very first) - caches the short "heading from A to
  // B" transition line the map scene voices over as it animates the route,
  // the same way closureNarration above caches the country farewell line.
  travelNarration?: string;
  travelAudioPath?: string; // relative to DATA_DIR
  travelAudioDurationSec?: number;
};

export type Orientation = "landscape" | "portrait";

export type Trip = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  stops: Stop[];
  music?: { path: string; volume: number; durationSec?: number };
  orientation?: Orientation; // defaults to "landscape" when unset
  titleCardNarration?: string;
  titleCardAudioPath?: string; // relative to DATA_DIR
  titleCardAudioDurationSec?: number;
};

export type RenderJobState = "idle" | "narrating" | "voicing" | "mapping" | "rendering" | "done" | "error";

export type RouteStopPoint = { id: string; name: string; lat: number; lng: number };

export type RouteLeg = {
  from: RouteStopPoint;
  to: RouteStopPoint;
  routeCoords: [number, number][] | null;
};

export type MapScene = {
  toStop: RouteStopPoint;
  country: {
    iso: string;
    name: string;
    bbox: [number, number, number, number];
    imageBbox: [number, number, number, number];
    terrainRelPath: string;
    countryGeometry: GeoJSON.Geometry;
    admin1: GeoJSON.Feature[];
  };
  // The leg being animated in this scene - undefined for the very first stop
  // of a country visit (nothing to travel from yet, just an arrival pin) and
  // for closure scenes.
  currentLeg?: RouteLeg;
  // Legs already completed earlier in this same country visit, rendered
  // fully drawn (not animated) so the accumulated route stays visible -
  // resets whenever the trip leaves and re-enters a country.
  priorLegs: RouteLeg[];
  // Present only for the recap scene inserted right after a country visit
  // wraps up (leaving for another country, or the trip ending) - shows the
  // whole completed route for that country with no further animation.
  closure?: {
    narration: string;
    audioPath?: string; // relative to DATA_DIR
    audioDurationSec?: number;
  };
  // Present whenever this scene animates an actual leg (currentLeg is set) -
  // the short "heading from A to B" (or "journey's final stop" for the very
  // last leg) line voiced over the travel animation.
  travel?: {
    narration: string;
    audioPath?: string; // relative to DATA_DIR
    audioDurationSec?: number;
  };
};

export type RenderJob = {
  tripId: string;
  state: RenderJobState;
  progress: number; // 0-1
  message?: string;
  outputPath?: string; // relative to DATA_DIR
  error?: string;
  warnings?: string[]; // non-fatal issues (e.g. a stop's voiceover failed) - the video still rendered
  startedAt: string;
  updatedAt: string;
};
