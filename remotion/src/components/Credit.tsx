import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily } from "../lib/fonts";
import { getLayout } from "../lib/layout";

// The project credit: one chip over every scene. On by default; trip.showWatermark === false hides it.
// Landscape: top-right. Portrait: top-left, clear of the bottom and the right-hand buttons.
export const TRAVELMAP_CREDIT = "TravelMap · github.com/sumanreddy89/travel-map";

export const Credit: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const layout = getLayout(width, height);
  const t = layout.text;
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: layout.safe.top,
          ...(layout.portrait ? { left: layout.safe.left } : { right: layout.safe.right }),
          padding: `${6 * t}px ${14 * t}px`,
          borderRadius: 999,
          background: "rgba(11, 7, 4, 0.55)",
          border: `${Math.max(1, 1.5 * t)}px solid rgba(255, 210, 74, 0.35)`,
          color: "#F6EAD4",
          fontFamily,
          fontWeight: 500,
          fontSize: 20 * t,
          letterSpacing: 0.5 * t,
          whiteSpace: "nowrap",
          opacity: 0.9 * fadeIn,
        }}
      >
        {TRAVELMAP_CREDIT}
      </div>
    </AbsoluteFill>
  );
};

// Required attribution, not the removable credit: road routes come from OSRM, which is built on
// OpenStreetMap data (ODbL). Shown on any map scene that draws one, whatever showWatermark says.
// `inset` places it inside a smaller panel (the share card's map) instead of the frame's safe margins.
export const OsmCredit: React.FC<{ inset?: number }> = ({ inset }) => {
  const { width, height } = useVideoConfig();
  const layout = getLayout(width, height);
  return (
    <div
      style={{
        position: "absolute",
        bottom: inset ?? layout.safe.bottom,
        ...(inset !== undefined ? { right: inset } : layout.portrait ? { left: layout.safe.left } : { right: layout.safe.right }),
        color: "rgba(246, 234, 212, 0.75)",
        fontFamily,
        fontWeight: 400,
        fontSize: 16 * layout.text,
        letterSpacing: 0.3 * layout.text,
        textShadow: "0 1px 6px rgba(0,0,0,0.8)",
      }}
    >
      Route data © OpenStreetMap contributors
    </div>
  );
};
