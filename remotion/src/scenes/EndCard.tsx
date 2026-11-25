import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily } from "../lib/fonts";
import { getLayout } from "../lib/layout";

// The last card, after the finale's hold: the trip's title, its stops in order, and a count.
// The TravelMap credit chip (if on) stays as the overlay it is everywhere else.
export const EndCard: React.FC<{ title: string; stops: string[]; countries: number }> = ({ title, stops, countries }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = getLayout(width, height).text;
  const fade = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rise = interpolate(frame, [0, 14], [14, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const summary = `${stops.length} ${stops.length === 1 ? "stop" : "stops"} · ${countries} ${countries === 1 ? "country" : "countries"}`;
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0704", fontFamily, alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 45%, #2a1509 0%, #0b0704 72%)" }} />
      <div style={{ opacity: fade, transform: `translateY(${rise}px)`, textAlign: "center", padding: `0 ${64 * t}px` }}>
        <div style={{ color: "white", fontWeight: 700, fontSize: 80 * t, letterSpacing: 3 * t, textTransform: "uppercase", lineHeight: 1.1 }}>{title}</div>
        <div style={{ color: "#FFD24A", fontSize: 34 * t, marginTop: 22 * t, letterSpacing: 1 * t }}>{stops.join("  ·  ")}</div>
        <div style={{ color: "#C9B8A0", fontSize: 26 * t, marginTop: 14 * t, letterSpacing: 2 * t, textTransform: "uppercase" }}>{summary}</div>
      </div>
    </AbsoluteFill>
  );
};
