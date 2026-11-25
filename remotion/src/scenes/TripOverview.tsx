import { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { getLayout } from "../lib/layout";
import { MOTION } from "../lib/motion";
import { useTerrainReady } from "../lib/terrain";
import { buildProjection, geometryToPath, unionBbox, type Bbox } from "../lib/projection";
import { cumulativeLengths, pointsToPath, quadraticBezierPoints, truncatedPath, type Point } from "../lib/polyline";
import type { MapScene, RouteLeg, RouteStopPoint } from "../types";

// The opener's establishing shot: every country on the trip on the amber terrain, and the whole
// route drawing itself across them while the camera slowly pulls back. The title sits on top.

export type OverviewCountry = Pick<MapScene["country"], "iso" | "bbox" | "imageBbox" | "terrainRelPath" | "countryGeometry">;
export type TripOverviewData = { countries: OverviewCountry[]; legs: RouteLeg[]; stops: RouteStopPoint[] };

const GLOW_COLOR = "#FFD24A";
const LINE_COLOR = "#FBEFDD";


// Countries, legs and stops in trip order, each once, from the map scenes.
export function tripOverview(mapScenes: MapScene[]): TripOverviewData | null {
  const countries = new Map<string, OverviewCountry>();
  const legs = new Map<string, RouteLeg>();
  const stops = new Map<string, RouteStopPoint>();
  for (const s of mapScenes) {
    if (!countries.has(s.country.iso)) countries.set(s.country.iso, s.country);
    if (s.closure) continue;
    if (s.currentLeg) {
      legs.set(`${s.currentLeg.from.id}>${s.currentLeg.to.id}`, s.currentLeg);
      if (!stops.has(s.currentLeg.from.id)) stops.set(s.currentLeg.from.id, s.currentLeg.from);
    }
    if (!stops.has(s.toStop.id)) stops.set(s.toStop.id, s.toStop);
  }
  return countries.size ? { countries: [...countries.values()], legs: [...legs.values()], stops: [...stops.values()] } : null;
}

export const TripOverview: React.FC<TripOverviewData & { durationInFrames: number }> = ({ countries, legs, stops, durationInFrames }) => {
  useTerrainReady(countries.map((c) => staticFile(c.terrainRelPath)));
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const layout = getLayout(width, height);

  const projection = useMemo(
    () => buildProjection(unionBbox(countries.map((c) => c.bbox as Bbox)), width, height, layout.mapPadding),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layout is derived from width/height
    [countries, width, height]
  );
  const shapes = useMemo(() => countries.map((c) => ({ c, d: geometryToPath(projection, c.countryGeometry) })), [countries, projection]);

  const route = useMemo(() => {
    const pt = (p: RouteStopPoint) => (projection([p.lng, p.lat]) ?? [width / 2, height / 2]) as Point;
    const pts: Point[] = [];
    for (const leg of legs) {
      const a = pt(leg.from);
      const b = pt(leg.to);
      const legPts =
        leg.routeCoords && leg.routeCoords.length > 1
          ? leg.routeCoords.map((c) => (projection(c) ?? b) as Point)
          : quadraticBezierPoints(a, [a[0] + (b[0] - a[0]) / 2 - (b[1] - a[1]) * 0.18, a[1] + (b[1] - a[1]) / 2 + (b[0] - a[0]) * 0.18], b, 40);
      pts.push(...legPts);
    }
    return pts;
  }, [legs, projection, width, height]);
  const lens = useMemo(() => cumulativeLengths(route), [route]);
  const total = lens[lens.length - 1] ?? 0;
  const stopPts = useMemo(() => stops.map((s) => (projection([s.lng, s.lat]) ?? [width / 2, height / 2]) as Point), [stops, projection, width, height]);

  const fadeIn = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const draw = interpolate(frame, [8, Math.max(9, durationInFrames - 14)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const zoom = interpolate(frame, [0, durationInFrames], [MOTION.opener.pullBackFrom, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const cx = width / 2;
  const cy = height / 2;
  const drawn = truncatedPath(route, lens, total * draw);
  // Each stop's dot appears as the line reaches it.
  const reachedAt = stopPts.map((p) => {
    let best = 0;
    let bestD = Infinity;
    route.forEach((q, i) => {
      const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    return total ? (lens[best] ?? 0) / total : 0;
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0704" }}>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 45% 40%, #241207 0%, #0b0704 70%)" }} />
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <filter id="ovGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="22" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="0 0 0 0 1  0 0 0 0 0.82  0 0 0 0 0.29  0 0 0 0.9 0" />
          </filter>
          {shapes.map(({ c, d }) => (
            <clipPath key={c.iso} id={`ovClip-${c.iso}`}>
              <path d={d} />
            </clipPath>
          ))}
        </defs>
        <g opacity={fadeIn} transform={`translate(${cx} ${cy}) scale(${zoom}) translate(${-cx} ${-cy})`}>
          {shapes.map(({ c, d }) => (
            <path key={`g-${c.iso}`} d={d} fill={GLOW_COLOR} filter="url(#ovGlow)" opacity={0.6} />
          ))}
          {shapes.map(({ c, d }) => {
            const [x0, y0] = projection([c.imageBbox[0], c.imageBbox[3]]) ?? [0, 0];
            const [x1, y1] = projection([c.imageBbox[2], c.imageBbox[1]]) ?? [width, height];
            return (
              <g key={`t-${c.iso}`}>
                <g clipPath={`url(#ovClip-${c.iso})`}>
                  <image href={staticFile(c.terrainRelPath)} x={x0} y={y0} width={Math.max(1, x1 - x0)} height={Math.max(1, y1 - y0)} preserveAspectRatio="none" opacity={0.92} />
                </g>
                <path d={d} fill="none" stroke="#5C1B02" strokeWidth={2.5} opacity={0.8} />
              </g>
            );
          })}
          <path d={pointsToPath(drawn)} fill="none" stroke={LINE_COLOR} strokeWidth={5 * layout.mark} strokeLinecap="round" strokeLinejoin="round" />
          {stopPts.map((p, i) =>
            draw >= reachedAt[i] ? <circle key={i} cx={p[0]} cy={p[1]} r={9 * layout.mark} fill="#D8280C" stroke={GLOW_COLOR} strokeWidth={3} /> : null
          )}
        </g>
      </svg>
      {/* Darken the bottom, where the title sits, so it reads over the map. */}
      <AbsoluteFill style={{ background: "linear-gradient(to top, rgba(11,7,4,0.85) 0%, rgba(11,7,4,0.45) 30%, rgba(11,7,4,0) 55%)" }} />
    </AbsoluteFill>
  );
};
