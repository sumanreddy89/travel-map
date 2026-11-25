import { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { getLayout } from "../lib/layout";
import { MOTION } from "../lib/motion";
import { useTerrainReady } from "../lib/terrain";
import { buildProjection, geometryToPath, paddedPointBbox, unionBbox, type Bbox } from "../lib/projection";
import { fontFamily } from "../lib/fonts";
import { OsmCredit } from "../components/Credit";
import { placeLabels } from "../lib/labels";
import { cumulativeLengths, pointsToPath, quadraticBezierPoints, truncatedPath, type Point } from "../lib/polyline";
import type { MapScene, RouteLeg, RouteStopPoint } from "../types";

// The whole trip on one map, used twice:
// - "opener": every country on the trip, the route drawing itself, a slow pull-back; the title
//   card sits on top.
// - "finale": after the last leg, the camera eases out from the last stop to frame the whole
//   route with every pin and label (fitted to the route, with the layout's padding, so nothing is
//   cut off in portrait or landscape), then holds.

export type OverviewCountry = Pick<MapScene["country"], "iso" | "bbox" | "imageBbox" | "terrainRelPath" | "countryGeometry">;
export type TripOverviewData = { countries: OverviewCountry[]; legs: RouteLeg[]; stops: RouteStopPoint[]; transit?: { iso: string; countryGeometry: GeoJSON.Geometry }[] };

const GLOW_COLOR = "#FFD24A";
const LINE_COLOR = "#FBEFDD";


// Countries, legs and stops in trip order, each once, from the map scenes.
export function tripOverview(mapScenes: MapScene[]): TripOverviewData | null {
  const countries = new Map<string, OverviewCountry>();
  const legs = new Map<string, RouteLeg>();
  const stops = new Map<string, RouteStopPoint>();
  const transit = new Map<string, { iso: string; countryGeometry: GeoJSON.Geometry }>();
  for (const s of mapScenes) {
    for (const t of s.transitCountries ?? []) if (!transit.has(t.iso)) transit.set(t.iso, t);
    if (!countries.has(s.country.iso)) countries.set(s.country.iso, s.country);
    if (s.closure) continue;
    if (s.currentLeg) {
      legs.set(`${s.currentLeg.from.id}>${s.currentLeg.to.id}`, s.currentLeg);
      if (!stops.has(s.currentLeg.from.id)) stops.set(s.currentLeg.from.id, s.currentLeg.from);
    }
    if (!stops.has(s.toStop.id)) stops.set(s.toStop.id, s.toStop);
  }
  for (const iso of countries.keys()) transit.delete(iso);
  return countries.size ? { countries: [...countries.values()], legs: [...legs.values()], stops: [...stops.values()], transit: [...transit.values()] } : null;
}

export const TripOverview: React.FC<TripOverviewData & { durationInFrames: number; variant?: "opener" | "finale" }> = ({
  countries,
  legs,
  stops,
  transit = [],
  durationInFrames,
  variant = "opener",
}) => {
  const finale = variant === "finale";
  useTerrainReady(countries.map((c) => staticFile(c.terrainRelPath)));
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const layout = getLayout(width, height);

  const projection = useMemo(() => {
    const countriesBox = unionBbox(countries.map((c) => c.bbox as Bbox));
    if (!finale) return buildProjection(countriesBox, width, height, layout.mapPadding);
    // The finale fits the route itself (stops and road lines), not whole countries.
    const pts = [...stops, ...legs.flatMap((l) => (l.routeCoords ?? []).map(([lng, lat]) => ({ lng, lat })))];
    const box = paddedPointBbox(pts, width / height, {
      minSpanLng: (countriesBox[2] - countriesBox[0]) * 0.3,
      minSpanLat: (countriesBox[3] - countriesBox[1]) * 0.3,
      paddingRatio: 0.3,
    });
    return buildProjection(box, width, height, layout.mapPadding);
  },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layout is derived from width/height
    [countries, stops, legs, finale, width, height]
  );
  const shapes = useMemo(() => countries.map((c) => ({ c, d: geometryToPath(projection, c.countryGeometry) })), [countries, projection]);
  const transitShapes = useMemo(() => transit.map((t) => geometryToPath(projection, t.countryGeometry)), [transit, projection]);

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

  const fadeIn = interpolate(frame, [0, finale ? 6 : 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const draw = finale
    ? 1
    : interpolate(frame, [8, Math.max(9, durationInFrames - 14)], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.cubic),
      });
  const cx = width / 2;
  const cy = height / 2;
  let camera: string;
  if (finale) {
    // Start close on the last stop (centred), ease out until the whole route is in frame, then hold.
    const t = interpolate(frame, [0, MOTION.finale.easeOutFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    });
    const [fx, fy] = stopPts[stopPts.length - 1] ?? [cx, cy];
    const z = MOTION.finale.zoomFrom + (1 - MOTION.finale.zoomFrom) * t;
    camera = `translate(${cx + (fx - cx) * t} ${cy + (fy - cy) * t}) scale(${z}) translate(${-fx} ${-fy})`;
  } else {
    const zoom = interpolate(frame, [0, durationInFrames], [MOTION.opener.pullBackFrom, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    });
    camera = `translate(${cx} ${cy}) scale(${zoom}) translate(${-cx} ${-cy})`;
  }
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
        <g opacity={fadeIn} transform={camera}>
          {/* Countries the route crosses without stopping: dimmed, like neighbours on the map scenes. */}
          {transitShapes.map((d, i) => (
            <path key={`x-${i}`} d={d} fill="rgba(232,121,31,0.16)" stroke="rgba(255,210,74,0.35)" strokeWidth={1.5} />
          ))}
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
          {finale &&
            placeLabels(stopPts, stops.map((s) => s.name), 30 * layout.mark, 22 * layout.mark, 10 * layout.mark).map((spot, i) => (
              <text
                key={`l-${i}`}
                x={stopPts[i][0] + spot.dx}
                y={stopPts[i][1] + spot.dy}
                textAnchor={spot.anchor}
                fill="white"
                fontFamily={fontFamily}
                fontWeight={700}
                fontSize={30 * layout.mark}
                style={{ textShadow: "0 2px 10px rgba(0,0,0,0.85)" }}
              >
                {stops[i].name}
              </text>
            ))}
        </g>
      </svg>
      {/* Opener: darken the bottom, where the title sits, so it reads over the map. */}
      {!finale && (
        <AbsoluteFill style={{ background: "linear-gradient(to top, rgba(11,7,4,0.85) 0%, rgba(11,7,4,0.45) 30%, rgba(11,7,4,0) 55%)" }} />
      )}
      {/* Road lines come from OpenStreetMap, whose licence needs the credit wherever they show. */}
      {legs.some((l) => (l.routeCoords?.length ?? 0) > 1) && <OsmCredit />}
    </AbsoluteFill>
  );
};
