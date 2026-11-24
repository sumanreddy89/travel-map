import { AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useAssetUrl } from "../lib/assets";
import { fontFamily } from "../lib/fonts";
import { getLayout } from "../lib/layout";
import { MediaKenBurns } from "../components/MediaKenBurns";
import type { Stop } from "../types";

export type StopContentProps = {
  stop: Stop;
  // The country the stop is in, from its map scene. Shown with the date so a cross-border trip is
  // never ambiguous (Porto on the edge of a Spain-shaped map read as being in Spain).
  country?: string;
};

const CROSSFADE = 12; // frames

export const StopContent: React.FC<StopContentProps> = ({ stop, country }) => {
  const asset = useAssetUrl();
  const { durationInFrames, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  // Sizes were tuned on 1920x1080; lib/layout.ts gives portrait readable type and safe margins.
  const layout = getLayout(width, height);
  const scale = layout.text;

  const media = stop.media.length > 0 ? stop.media : [null];
  const perItem = Math.floor(durationInFrames / media.length);

  const captionIn = interpolate(frame, [4, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const captionOut = interpolate(
    frame,
    [durationInFrames - 18, durationInFrames - 2],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const captionOpacity = Math.min(captionIn, captionOut);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0704" }}>
      {media.map((item, i) => {
        // Each photo but the last runs CROSSFADE frames into the next, which fades in on top, so
        // photos dissolve into each other instead of dipping to black. The last photo takes any
        // leftover frames, so the stop's slides always fill it exactly.
        const last = i === media.length - 1;
        const length = last ? durationInFrames - i * perItem : perItem + CROSSFADE;
        return (
          <Sequence key={item?.id ?? `blank-${i}`} from={i * perItem} durationInFrames={length} name={item?.path ?? "no-media"}>
            <MediaKenBurns item={item} durationInFrames={length} fadeOut={last} />
          </Sequence>
        );
      })}

      <AbsoluteFill
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 35%, rgba(0,0,0,0) 60%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: layout.safe.left,
          bottom: layout.safe.bottom,
          right: layout.safe.right,
          color: "white",
          fontFamily,
          opacity: captionOpacity,
          transform: `translateY(${interpolate(captionOpacity, [0, 1], [24, 0])}px)`,
        }}
      >
        <div style={{ fontSize: 52 * scale, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
          {stop.name}
        </div>
        {(country || stop.date) && (
          <div style={{ fontSize: 24 * scale, opacity: 0.85, marginTop: 4 * scale, fontWeight: 400 }}>
            {[country, stop.date].filter(Boolean).join(" · ")}
          </div>
        )}
        {stop.notes && (
          <div
            style={{
              fontSize: 22 * scale,
              opacity: 0.9,
              marginTop: 10 * scale,
              fontWeight: 300,
              maxWidth: width - layout.safe.left - layout.safe.right,
              // A long note never pushes the caption up over the photo: at most 3 lines.
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              lineHeight: 1.4,
            }}
          >
            {stop.notes}
          </div>
        )}
      </div>

      {stop.audioPath && <Audio src={asset(stop.audioPath)} />}
    </AbsoluteFill>
  );
};
