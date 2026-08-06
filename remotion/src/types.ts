export type MediaItem = {
  id: string;
  type: "photo" | "video";
  path: string; // relative to DATA_DIR, served via staticFile(`data/${path}`)
  durationSec?: number;
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
  audioPath?: string;
  audioDurationSec?: number;
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
  titleCardAudioPath?: string;
  titleCardAudioDurationSec?: number;
};

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
};

export type TripVideoProps = {
  trip: Trip;
  mapScenes: MapScene[];
};
