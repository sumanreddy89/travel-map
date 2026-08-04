import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Oswald";
import { MediaKenBurns } from "../components/MediaKenBurns";
import type { Stop } from "../types";

const { fontFamily } = loadFont("normal", { weights: ["300", "400", "700"], subsets: ["latin", "latin-ext"] });

export type StopContentProps = {
  stop: Stop;
};

export const StopContent: React.FC<StopContentProps> = ({ stop }) => {
  const { durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

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
          left: 72,
          bottom: 64,
          right: 72,
          color: "white",
          fontFamily,
          opacity: captionOpacity,
          transform: `translateY(${interpolate(captionOpacity, [0, 1], [24, 0])}px)`,
        }}
      >
        <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
          {stop.name}
        </div>
        {stop.date && (
          <div style={{ fontSize: 24, opacity: 0.85, marginTop: 4, fontWeight: 400 }}>{stop.date}</div>
        )}
        {stop.notes && (
          <div style={{ fontSize: 22, opacity: 0.9, marginTop: 10, fontWeight: 300, maxWidth: 1100, lineHeight: 1.4 }}>
            {stop.notes}
          </div>
        )}
      </div>

      {stop.audioPath && <Audio src={staticFile(`data/${stop.audioPath}`)} />}
    </AbsoluteFill>
  );
};
