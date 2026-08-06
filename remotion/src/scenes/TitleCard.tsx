import { AbsoluteFill, Audio, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Oswald";
import type { Trip } from "../types";

const { fontFamily } = loadFont("normal", { weights: ["400", "700"], subsets: ["latin", "latin-ext"] });

const GLOW_COLOR = "#FFD24A";

export type TitleCardProps = {
  trip: Pick<Trip, "title" | "titleCardAudioPath">;
};

export const TitleCard: React.FC<TitleCardProps> = ({ trip }) => {
  const frame = useCurrentFrame();
  const { width, fps } = useVideoConfig();
  const scale = width / 1920;

  const titlePop = spring({ frame, fps, config: { damping: 14, stiffness: 90 } });
  const titleOpacity = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const linesWidth = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0704", fontFamily }}>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 45%, #2a1509 0%, #0b0704 72%)" }} />

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            opacity: titleOpacity,
            transform: `scale(${0.85 + titlePop * 0.15})`,
            textAlign: "center",
            padding: `0 ${64 * scale}px`,
          }}
        >
          <div
            style={{
              color: "white",
              fontWeight: 700,
              fontSize: 92 * scale,
              lineHeight: 1.08,
              letterSpacing: 3 * scale,
              textTransform: "uppercase",
              textShadow: `0 4px 32px rgba(255,180,60,0.35), 0 2px 18px rgba(0,0,0,0.6)`,
            }}
          >
            {trip.title}
          </div>

          <div
            style={{
              marginTop: 28 * scale,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16 * scale,
            }}
          >
            <div
              style={{
                width: 60 * scale * linesWidth,
                height: 2,
                background: GLOW_COLOR,
                opacity: 0.8,
              }}
            />
            <svg width={22 * scale} height={22 * scale} viewBox="0 0 24 24" style={{ opacity: titleOpacity }}>
              <path
                d="M12,2 L14.5,9.5 L22,12 L14.5,14.5 L12,22 L9.5,14.5 L2,12 L9.5,9.5 Z"
                fill={GLOW_COLOR}
              />
            </svg>
            <div
              style={{
                width: 60 * scale * linesWidth,
                height: 2,
                background: GLOW_COLOR,
                opacity: 0.8,
              }}
            />
          </div>
        </div>
      </AbsoluteFill>

      {trip.titleCardAudioPath && <Audio src={staticFile(`data/${trip.titleCardAudioPath}`)} />}
    </AbsoluteFill>
  );
};
