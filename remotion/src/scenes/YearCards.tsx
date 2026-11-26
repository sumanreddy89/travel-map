import { AbsoluteFill, Freeze, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamily } from "../lib/fonts";
import { getLayout } from "../lib/layout";
import { MOTION, countUp } from "../lib/motion";
import { shareLine, type YearStats } from "../lib/yearStats";
import { TripOverview, type TripOverviewData } from "./TripOverview";

// The two cards of a "Year in travel" film: the opener counts the year's numbers up; the share
// card ends the film with the same numbers and the TravelMap page link.

export const TRAVELMAP_PAGE = "sumanreddy89.github.io/travel-map/hosted";
const GOLD = "#FFD24A";
const MUTED = "#C9B8A0";

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;

function tiles(stats: YearStats) {
  return [
    { value: stats.countries, label: (n: number) => (n === 1 ? "country" : "countries") },
    { value: stats.cities, label: (n: number) => (n === 1 ? "city" : "cities") },
    { value: stats.distanceKm, label: () => "km travelled" },
    { value: stats.flights, label: (n: number) => (n === 1 ? "flight" : "flights") },
  ];
}

const Backdrop: React.FC = () => (
  <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 40%, #2a1509 0%, #0b0704 72%)" }} />
);

const Grid: React.FC<{ stats: YearStats; frame: number | null; t: number; portrait: boolean }> = ({ stats, frame, t, portrait }) => (
  <div style={{ display: "grid", gridTemplateColumns: portrait ? "1fr 1fr" : "repeat(4, 1fr)", gap: `${36 * t}px ${56 * t}px`, marginTop: 56 * t }}>
    {tiles(stats).map((tile, i) => {
      const start = MOTION.year.titleInFrames + i * MOTION.year.staggerFrames;
      const shown = frame === null ? tile.value : countUp(frame, start, tile.value);
      const opacity = frame === null ? 1 : interpolate(frame, [start - 4, start + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      return (
        <div key={i} style={{ textAlign: "center", opacity }}>
          <div style={{ color: "white", fontWeight: 700, fontSize: 96 * t, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{shown.toLocaleString("en-GB")}</div>
          <div style={{ color: GOLD, fontSize: 28 * t, marginTop: 10 * t, letterSpacing: 3 * t, textTransform: "uppercase" }}>{tile.label(tile.value)}</div>
        </div>
      );
    })}
  </div>
);

const Longest: React.FC<{ stats: YearStats; t: number; opacity: number }> = ({ stats, t, opacity }) =>
  stats.longestLeg ? (
    <div style={{ color: MUTED, fontSize: 30 * t, marginTop: 48 * t, opacity, letterSpacing: 1 * t }}>
      Longest leg: {stats.longestLeg.from} → {stats.longestLeg.to}, {plural(stats.longestLeg.km, "km", "km")}
    </div>
  ) : null;

export const YearOpener: React.FC<{ year: number; stats: YearStats }> = ({ year, stats }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const layout = getLayout(width, height);
  const t = layout.text;
  const titleIn = interpolate(frame, [0, MOTION.year.titleInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lastSettled = MOTION.year.titleInFrames + 3 * MOTION.year.staggerFrames + MOTION.year.countUpFrames;
  const longestIn = interpolate(frame, [lastSettled - 6, lastSettled + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0704", fontFamily, alignItems: "center", justifyContent: "center", padding: `0 ${layout.safe.left}px` }}>
      <Backdrop />
      <div style={{ textAlign: "center", position: "relative" }}>
        <div style={{ opacity: titleIn, transform: `translateY(${(1 - titleIn) * 16}px)` }}>
          <div style={{ color: MUTED, fontSize: 34 * t, letterSpacing: 6 * t, textTransform: "uppercase" }}>Your</div>
          <div style={{ color: "white", fontWeight: 700, fontSize: 120 * t, lineHeight: 1.05, letterSpacing: 2 * t }}>{year}</div>
          <div style={{ color: MUTED, fontSize: 34 * t, letterSpacing: 6 * t, textTransform: "uppercase" }}>in travel</div>
        </div>
        <Grid stats={stats} frame={frame} t={t} portrait={layout.portrait} />
        <Longest stats={stats} t={t} opacity={longestIn} />
      </div>
    </AbsoluteFill>
  );
};

// The year's whole route, frozen where the finale settles, in a box beside (landscape) or above
// (portrait) the text. Same map, same data as the film; nothing is fetched.
const RouteMap: React.FC<{ overview: TripOverviewData; width: number; height: number }> = ({ overview, width, height }) => (
  <div style={{ position: "relative", width, height, borderRadius: 24, overflow: "hidden", boxShadow: "0 0 0 2px rgba(255,210,74,0.35)", flexShrink: 0 }}>
    <Freeze frame={MOTION.finale.easeOutFrames + 1}>
      <TripOverview {...overview} durationInFrames={MOTION.finale.easeOutFrames + 2} variant="finale" box={{ width, height }} />
    </Freeze>
  </div>
);

export const ShareCard: React.FC<{ year: number; stats: YearStats; stops: string[]; overview?: TripOverviewData | null }> = ({ year, stats, stops, overview }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const layout = getLayout(width, height);
  const t = layout.text;
  const fade = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // A long year lists its first and last few cities, so the line always fits.
  const route = stops.length > 8 ? [...stops.slice(0, 4), "…", ...stops.slice(-3)] : stops;
  const text = (
    <div style={{ textAlign: layout.portrait || !overview ? "center" : "left", minWidth: 0 }}>
      <div style={{ color: "white", fontWeight: 700, fontSize: (overview && layout.portrait ? 62 : 84) * t, letterSpacing: 3 * t, textTransform: "uppercase", lineHeight: 1.1 }}>My {year} in travel</div>
      <div style={{ color: "white", fontSize: (layout.portrait ? 32 : 40) * t, marginTop: 24 * t, lineHeight: 1.3 }}>{shareLine(stats)}</div>
      <div style={{ color: GOLD, fontSize: 30 * t, marginTop: 20 * t, letterSpacing: 1 * t, lineHeight: 1.4 }}>{route.join("  ·  ")}</div>
      {!overview && <Grid stats={stats} frame={null} t={t * 0.8} portrait={layout.portrait} />}
      <Longest stats={stats} t={t} opacity={1} />
      <div style={{ color: MUTED, fontSize: 28 * t, marginTop: (layout.portrait ? 32 : 48) * t, letterSpacing: 1 * t }}>
        Made with TravelMap · <span style={{ color: "white" }}>{TRAVELMAP_PAGE}</span>
      </div>
    </div>
  );
  const mapW = layout.portrait ? width - 2 * layout.safe.left : Math.round(width * 0.46);
  const mapH = layout.portrait ? Math.round(height * 0.3) : Math.round(height * 0.74);
  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0704", fontFamily, alignItems: "center", justifyContent: "center", padding: `0 ${layout.safe.left}px` }}>
      <Backdrop />
      <div style={{ position: "relative", opacity: fade, display: "flex", flexDirection: layout.portrait ? "column" : "row", alignItems: "center", gap: (layout.portrait ? 36 : 72) * t }}>
        {overview && <RouteMap overview={overview} width={mapW} height={mapH} />}
        {text}
      </div>
    </AbsoluteFill>
  );
};
