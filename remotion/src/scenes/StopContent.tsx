import { AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useAssetUrl } from "../lib/assets";
import { fontFamily } from "../lib/fonts";
import { getLayout } from "../lib/layout";
import { MediaKenBurns } from "../components/MediaKenBurns";
import type { Stop } from "../types";


export type StopContentProps = {
  stop: Stop;
};

export const StopContent: React.FC<StopContentProps> = ({ stop }) => {
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
      {media.map((item, i) => (
        <Sequence key={item?.id ?? `blank-${i}`} from={i * perItem} durationInFrames={perItem} name={item?.path ?? "no-media"}>
          <MediaKenBurns item={item} durationInFrames={perItem} />
        </Sequence>
      ))}

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
        {stop.date && (
          <div style={{ fontSize: 24 * scale, opacity: 0.85, marginTop: 4 * scale, fontWeight: 400 }}>
            {stop.date}
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
