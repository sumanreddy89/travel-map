import { AbsoluteFill, Audio, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useAssetUrl } from "../lib/assets";
import { fontFamily } from "../lib/fonts";
import { getLayout } from "../lib/layout";
import type { Trip } from "../types";
import { TripOverview, type TripOverviewData } from "./TripOverview";

const GLOW_COLOR = "#FFD24A";

export type TitleCardProps = {
  trip: Pick<Trip, "title" | "titleCardAudioPath">;
  /** The whole trip on one map, drawn behind the title. Without it, the title sits on a plain background. */
  overview?: TripOverviewData | null;
  durationInFrames?: number;
};

export const TitleCard: React.FC<TitleCardProps> = ({ trip, overview, durationInFrames = 90 }) => {
  const asset = useAssetUrl();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const scale = getLayout(width, height).text;

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
      {overview ? (
        <TripOverview {...overview} durationInFrames={durationInFrames} />
      ) : (
        <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 45%, #2a1509 0%, #0b0704 72%)" }} />
      )}

      {/* Over the map, the title moves to the lower third so the route stays visible. */}
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: overview ? "flex-end" : "center",
          paddingBottom: overview ? height * (getLayout(width, height).portrait ? 0.2 : 0.12) : 0,
        }}
      >
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

      {trip.titleCardAudioPath && <Audio src={asset(trip.titleCardAudioPath)} />}
    </AbsoluteFill>
  );
};
