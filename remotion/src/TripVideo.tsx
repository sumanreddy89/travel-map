import { AbsoluteFill, Audio, Loop, Sequence, staticFile } from "remotion";
import { MapTransition } from "./scenes/MapTransition";
import { StopContent } from "./scenes/StopContent";
import { TitleCard } from "./scenes/TitleCard";
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

type TimelineItem =
  | { kind: "title"; durationInFrames: number }
  | { kind: "map"; scene: MapScene; media: MediaItem[]; durationInFrames: number }
  | { kind: "stop"; stop: Stop; durationInFrames: number };

// Shared by both the component and calculateMetadata so the two can never
// disagree on total length. mapScenes is already in chronological order,
// including closure recap scenes wherever a country visit wraps up (see
// buildMapScenes on the server) - this just interleaves each non-closure
// scene with its stop's content, and drops closures in wherever they land
// (mid-trip on a country change, or trailing at the very end).
function buildTimeline(trip: TripVideoProps["trip"], mapScenes: TripVideoProps["mapScenes"]): TimelineItem[] {
  const items: TimelineItem[] = [
    { kind: "title", durationInFrames: secToFrames(titleCardDurationSec(trip)) },
  ];
  let mi = 0;

  const pushClosures = () => {
    while (mi < mapScenes.length && mapScenes[mi].closure) {
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

    items.push({ kind: "stop", stop, durationInFrames: secToFrames(stopSceneDurationSec(stop)) });
  }

  pushClosures(); // trailing closure for the last country visited

  return items;
}

export const TripVideo: React.FC<TripVideoProps> = ({ trip, mapScenes }) => {
  const timeline = buildTimeline(trip, mapScenes);

  let cursor = 0;
  const items = timeline.map((item, i) => {
    const from = cursor;
    cursor += item.durationInFrames;

    if (item.kind === "title") {
      return (
        <Sequence key={i} from={from} durationInFrames={item.durationInFrames} name="Title">
          <TitleCard trip={trip} />
        </Sequence>
      );
    }

    if (item.kind === "map") {
      const name = item.scene.closure ? `Closure: ${item.scene.country.name}` : `Map: ${item.scene.toStop.name}`;
      return (
        <Sequence key={i} from={from} durationInFrames={item.durationInFrames} name={name}>
          <MapTransition scene={item.scene} media={item.media} durationInFrames={item.durationInFrames} />
        </Sequence>
      );
    }
    return (
      <Sequence key={i} from={from} durationInFrames={item.durationInFrames} name={`Stop: ${item.stop.name}`}>
        <StopContent stop={item.stop} />
      </Sequence>
    );
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {trip.music && (
        <Loop durationInFrames={Math.max(1, secToFrames(trip.music.durationSec ?? 30))}>
          <Audio src={staticFile(trip.music.path)} volume={trip.music.volume} />
        </Loop>
      )}
      {items}
    </AbsoluteFill>
  );
};

export function computeTotalDurationInFrames(trip: TripVideoProps["trip"], mapScenes: TripVideoProps["mapScenes"]) {
  const total = buildTimeline(trip, mapScenes).reduce((sum, item) => sum + item.durationInFrames, 0);
  return Math.max(total, FPS);
}
