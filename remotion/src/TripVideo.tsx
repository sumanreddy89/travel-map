import { AbsoluteFill, Audio, Loop, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { MapTransition } from "./scenes/MapTransition";
import { StopContent } from "./scenes/StopContent";
import { TitleCard } from "./scenes/TitleCard";
import { TripOverview, tripOverview } from "./scenes/TripOverview";
import { EndCard } from "./scenes/EndCard";
import { ShareCard, YearOpener } from "./scenes/YearCards";
import { yearStats } from "./lib/yearStats";
import { MOTION } from "./lib/motion";
import { SHOW_MEDIA_PANEL_IN_MAP_SCENES } from "./config";
import {
  FPS,
  closureSceneDurationSec,
  mapSceneDurationSec,
  secToFrames,
  stopSceneDurationSec,
  titleCardDurationSec,
} from "./timing";
import type { MapScene, MediaItem, Stop, TripVideoProps } from "./types";
import { AssetBaseContext, assetUrl, resolveAssetBase } from "./lib/assets";
import { useBundledFont } from "./lib/fonts";
import { Credit } from "./components/Credit";

type TimelineItem =
  | { kind: "title"; durationInFrames: number }
  | { kind: "map"; scene: MapScene; media: MediaItem[]; durationInFrames: number }
  | { kind: "stop"; stop: Stop; durationInFrames: number }
  | { kind: "finale"; durationInFrames: number; audioPath?: string }
  | { kind: "end"; durationInFrames: number }
  | { kind: "yearOpener"; durationInFrames: number }
  | { kind: "share"; durationInFrames: number };

// Shared by both the component and calculateMetadata so the two can never
// disagree on total length. mapScenes is already in chronological order,
// including closure recap scenes wherever a country visit wraps up (see
// buildMapScenes on the server) - this just interleaves each non-closure
// scene with its stop's content, and drops closures in wherever they land
// (mid-trip on a country change, or trailing at the very end).
function buildTimeline(trip: TripVideoProps["trip"], mapScenes: TripVideoProps["mapScenes"]): TimelineItem[] {
  // A "Year in travel" film: the stats opener instead of the title, no per-country recaps (the
  // finale is the recap), no photo scenes for stops without photos, and a share card at the end.
  const year = Boolean(trip.yearInTravel);
  const items: TimelineItem[] = [
    year
      ? { kind: "yearOpener", durationInFrames: MOTION.year.openerFrames }
      : { kind: "title", durationInFrames: secToFrames(titleCardDurationSec(trip)) },
  ];
  let mi = 0;

  const pushClosures = () => {
    while (mi < mapScenes.length && mapScenes[mi].closure) {
      if (year) {
        mi++;
        continue;
      }
      const scene = mapScenes[mi];
      items.push({
        kind: "map",
        scene,
        media: [],
        durationInFrames: secToFrames(closureSceneDurationSec(scene)),
      });
      mi++;
    }
  };

  for (const stop of trip.stops) {
    pushClosures();

    let scene: MapScene | undefined;
    if (mi < mapScenes.length && !mapScenes[mi].closure && mapScenes[mi].toStop.id === stop.id) {
      scene = mapScenes[mi];
      mi++;
    }
    if (scene) {
      const media = SHOW_MEDIA_PANEL_IN_MAP_SCENES ? stop.media : [];
      items.push({
        kind: "map",
        scene,
        media,
        durationInFrames: secToFrames(mapSceneDurationSec(scene, media.length)),
      });
    }

    if (!year || stop.media.length > 0) {
      items.push({ kind: "stop", stop, durationInFrames: secToFrames(stopSceneDurationSec(stop)) });
    }
  }

  // The last country's recap and the finale would both pull back over the route, one after the
  // other. With a finale, the finale is the recap: it takes over the recap's closing line (and
  // runs long enough for it), and the recap scene is dropped.
  const trailing = mapScenes.length > 0 ? mapScenes.slice(mi).filter((s) => s.closure) : [];
  const lastRecap = trailing[trailing.length - 1];
  if (lastRecap) mapScenes = mapScenes.slice(0, mapScenes.length - 1);
  pushClosures(); // any other trailing recap

  // After the last leg: ease out to the whole route and hold (MOTION.finale), then the end card.
  if (mapScenes.length > 0 || lastRecap) {
    const finaleFrames = MOTION.finale.easeOutFrames + MOTION.finale.holdFrames;
    const audioSec = lastRecap?.closure?.audioPath ? lastRecap.closure.audioDurationSec : undefined;
    items.push({
      kind: "finale",
      durationInFrames: audioSec ? Math.max(finaleFrames, secToFrames(audioSec + 1)) : finaleFrames,
      audioPath: lastRecap?.closure?.audioPath,
    });
    items.push(year ? { kind: "share", durationInFrames: MOTION.year.shareCardFrames } : { kind: "end", durationInFrames: MOTION.finale.endCardFrames });
  }

  return items;
}

export const TripVideo: React.FC<TripVideoProps> = ({ trip, mapScenes, assetBase }) => {
  // Music fades in over 1 s and out over the last 2 s, so the film doesn't end mid-note.
  const frame = useCurrentFrame();
  const totalFrames = computeTotalDurationInFrames(trip, mapScenes);
  const musicFade = Math.min(
    interpolate(frame, [0, FPS], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(frame, [totalFrames - 2 * FPS, totalFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );
  useBundledFont();
  // Each stop's country, from the map scene that arrives there (closures recap, so they're skipped).
  const countryOf = new Map(mapScenes.filter((s) => !s.closure).map((s) => [s.toStop.id, s.country.name]));
  const timeline = buildTimeline(trip, mapScenes);
  // Every country the trip visits, once each, so a map scene can show its neighbours on the route
  // (Porto's Portugal next to Spain) instead of leaving them as empty dark space.
  const tripCountries = [
    ...new Map([
      ...mapScenes.flatMap((s) => (s.transitCountries ?? []).map((t) => [t.iso, { iso: t.iso, geometry: t.countryGeometry }] as const)),
      ...mapScenes.map((s) => [s.country.iso, { iso: s.country.iso, geometry: s.country.countryGeometry }] as const),
    ]).values(),
  ];

  const overview = tripOverview(mapScenes);
  // The year's numbers: each stop's country from its map scene, and how it was reached from its leg.
  const legModeOf = new Map(mapScenes.filter((s) => s.currentLeg).map((s) => [s.toStop.id, s.currentLeg!.mode]));
  const stats = trip.yearInTravel
    ? yearStats(trip.stops.map((s) => ({ name: s.name, lat: s.lat, lng: s.lng, country: countryOf.get(s.id), mode: legModeOf.get(s.id) })))
    : null;

  let cursor = 0;
  const items = timeline.map((item, i) => {
    const from = cursor;
    cursor += item.durationInFrames;

    if (item.kind === "title") {
      return (
        <Sequence key={i} from={from} durationInFrames={item.durationInFrames} name="Title">
          <TitleCard trip={trip} overview={overview} durationInFrames={item.durationInFrames} />
        </Sequence>
      );
    }

    if (item.kind === "finale" && overview) {
      return (
        <Sequence key={i} from={from} durationInFrames={item.durationInFrames} name="Finale">
          <TripOverview {...overview} durationInFrames={item.durationInFrames} variant="finale" />
          {item.audioPath && <Audio src={assetUrl(resolveAssetBase(assetBase), item.audioPath)} />}
        </Sequence>
      );
    }
    if (item.kind === "yearOpener" && stats && trip.yearInTravel) {
      return (
        <Sequence key={i} from={from} durationInFrames={item.durationInFrames} name="Year opener">
          <YearOpener year={trip.yearInTravel.year} stats={stats} />
        </Sequence>
      );
    }
    if (item.kind === "share" && stats && trip.yearInTravel) {
      return (
        <Sequence key={i} from={from} durationInFrames={item.durationInFrames} name="Share card">
          <ShareCard year={trip.yearInTravel.year} stats={stats} stops={trip.stops.map((s) => s.name)} />
        </Sequence>
      );
    }
    if (item.kind === "end") {
      return (
        <Sequence key={i} from={from} durationInFrames={item.durationInFrames} name="End card">
          <EndCard title={trip.title} stops={trip.stops.map((s) => s.name)} countries={overview?.countries.length ?? 0} />
        </Sequence>
      );
    }
    if (item.kind === "finale" || item.kind === "yearOpener" || item.kind === "share") return null;

    if (item.kind === "map") {
      const name = item.scene.closure ? `Closure: ${item.scene.country.name}` : `Map: ${item.scene.toStop.name}`;
      return (
        <Sequence key={i} from={from} durationInFrames={item.durationInFrames} name={name}>
          <MapTransition scene={item.scene} media={item.media} durationInFrames={item.durationInFrames} tripCountries={tripCountries} />
        </Sequence>
      );
    }
    return (
      <Sequence key={i} from={from} durationInFrames={item.durationInFrames} name={`Stop: ${item.stop.name}`}>
        <StopContent stop={item.stop} country={countryOf.get(item.stop.id)} />
      </Sequence>
    );
  });

  return (
    <AssetBaseContext.Provider value={resolveAssetBase(assetBase)}>
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {trip.music && (
        <Loop durationInFrames={Math.max(1, secToFrames(trip.music.durationSec ?? 30))}>
          <Audio src={staticFile(trip.music.path)} volume={() => (trip.music?.volume ?? 1) * musicFade} />
        </Loop>
      )}
      {items}
      {trip.showWatermark !== false && <Credit />}
    </AbsoluteFill>
    </AssetBaseContext.Provider>
  );
};

export function computeTotalDurationInFrames(trip: TripVideoProps["trip"], mapScenes: TripVideoProps["mapScenes"]) {
  const total = buildTimeline(trip, mapScenes).reduce((sum, item) => sum + item.durationInFrames, 0);
  return Math.max(total, FPS);
}
