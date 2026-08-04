import { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Oswald";
import { buildProjection, geometryToPath, paddedPointBbox, type Bbox } from "../lib/projection";
import {
  cumulativeLengths,
  pointAtLength,
  pointsToPath,
  quadraticBezierPoints,
  truncatedPath,
  type Point,
} from "../lib/polyline";
import { MediaKenBurns } from "../components/MediaKenBurns";
import type { MapScene, MediaItem, RouteLeg, RouteStopPoint } from "../types";

const { fontFamily } = loadFont("normal", { weights: ["400", "700"], subsets: ["latin", "latin-ext"] });

const GLOW_COLOR = "#FFD24A";
const FILL_COLOR_TOP = "#E8791F";
const FILL_COLOR_BOTTOM = "#B23A0E";
const LINE_COLOR = "#FBEFDD";
const BORDER_COLOR = "rgba(70,20,0,0.45)";
const PANEL_WIDTH_RATIO = 0.38;
// Natural Earth's admin-1 layer is county/district-level for some countries
// (Cyprus: 5 districts) but municipality-level for others (Slovenia: 193) -
// past a certain count the internal borders stop reading as "one country's
// regions" and start looking like a patchwork of many countries, so skip
// them entirely once there are too many to stay legible.
const MAX_ADMIN1_BORDERS = 24;

export type MapTransitionProps = {
  scene: MapScene;
  media: MediaItem[];
  /** Local duration of this scene in frames (its own Sequence length, not the whole video). */
  durationInFrames: number;
};

export const MapTransition: React.FC<MapTransitionProps> = ({ scene, media, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { width: fullWidth, height, fps } = useVideoConfig();
  const { toStop, country, currentLeg, priorLegs, closure } = scene;
  const isClosure = Boolean(closure);

  const hasMedia = media.length > 0;
  const panelWidth = hasMedia ? Math.round(fullWidth * PANEL_WIDTH_RATIO) : 0;
  const width = fullWidth - panelWidth;

  // Every point involved in this scene - all the already-visited stops from
  // earlier legs in this country visit, plus this scene's own leg - so the
  // view zooms to fit the whole accumulated route, not just the current pair.
  const allPoints = useMemo<RouteStopPoint[]>(() => {
    const pts: RouteStopPoint[] = [];
    for (const leg of priorLegs) {
      pts.push(leg.from, leg.to);
    }
    if (currentLeg) pts.push(currentLeg.from, currentLeg.to);
    else pts.push(toStop);
    const seen = new Set<string>();
    return pts.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  }, [priorLegs, currentLeg, toStop]);

  // Fit tightly to the points actually involved (with generous padding)
  // instead of always the whole country - a couple of stops clustered in one
  // corner used to render tiny since the view was forced to include the
  // entire country silhouette every time. The minimum span is still a
  // fraction of the country's own extent (not a fixed degree value), so a
  // single isolated point - e.g. the trip's very first arrival - doesn't
  // zoom in so tight that the country's silhouette fills the whole frame
  // with no visible edge, losing the "which country is this" context.
  const viewBbox = useMemo<Bbox>(
    () =>
      paddedPointBbox(allPoints, {
        minSpanLng: (country.bbox[2] - country.bbox[0]) * 0.4,
        minSpanLat: (country.bbox[3] - country.bbox[1]) * 0.4,
      }),
    [allPoints, country]
  );

  const projection = useMemo(() => buildProjection(viewBbox, width, height, 140), [viewBbox, width, height]);

  const countryPathD = useMemo(() => geometryToPath(projection, country.countryGeometry), [projection, country]);
  const admin1PathsD = useMemo(
    () =>
      country.admin1.length <= MAX_ADMIN1_BORDERS
        ? country.admin1.map((f) => geometryToPath(projection, f.geometry))
        : [],
    [projection, country]
  );

  const [imgX0, imgY0] = projection([country.imageBbox[0], country.imageBbox[3]]) ?? [0, 0];
  const [imgX1, imgY1] = projection([country.imageBbox[2], country.imageBbox[1]]) ?? [width, height];

  const projectedById = useMemo(() => {
    const map = new Map<string, Point>();
    for (const p of allPoints) {
      map.set(p.id, (projection([p.lng, p.lat]) ?? [width / 2, height / 2]) as Point);
    }
    return map;
  }, [allPoints, projection, width, height]);

  const projectLeg = (leg: RouteLeg): Point[] => {
    const fromPt = projectedById.get(leg.from.id) ?? ([width / 2, height / 2] as Point);
    const toPt = projectedById.get(leg.to.id) ?? ([width / 2, height / 2] as Point);
    if (leg.routeCoords && leg.routeCoords.length > 1) {
      return leg.routeCoords.map((c) => (projection(c) ?? toPt) as Point);
    }
    const dx = toPt[0] - fromPt[0];
    const dy = toPt[1] - fromPt[1];
    const mid: Point = [fromPt[0] + dx * 0.5 - dy * 0.18, fromPt[1] + dy * 0.5 + dx * 0.18];
    return quadraticBezierPoints(fromPt, mid, toPt, 40);
  };

  const priorLegPointsList = useMemo(() => priorLegs.map(projectLeg), [priorLegs, projectedById]);

  const currentLegPoints = useMemo(
    () => (currentLeg ? projectLeg(currentLeg) : []),
    [currentLeg, projectedById]
  );
  const currentLegLens = useMemo(() => cumulativeLengths(currentLegPoints), [currentLegPoints]);
  const currentLegTotalLen = currentLegLens[currentLegLens.length - 1] ?? 0;

  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleIn = interpolate(frame, [6, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // The line-draw (and the traveling dot on it) spans almost the whole scene
  // so movement reads as slow and persistent rather than a quick blip early on.
  const introPad = 18;
  const outroPad = currentLeg ? 30 : 16;
  const drawStart = currentLeg ? introPad : 0;
  const drawEnd = currentLeg ? Math.max(drawStart + 10, durationInFrames - outroPad) : 0;
  const drawProgress = currentLeg
    ? interpolate(frame, [drawStart, drawEnd], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.cubic),
      })
    : 1;

  const destinationPop = spring({
    frame: frame - (currentLeg ? drawEnd - 6 : 16),
    fps,
    config: { damping: 12, stiffness: 160 },
  });

  const visibleCurrentPoints = truncatedPath(currentLegPoints, currentLegLens, currentLegTotalLen * drawProgress);
  const currentLinePathD = pointsToPath(visibleCurrentPoints);

  // A small marker travelling along the line as it draws, so movement from
  // stop to stop reads clearly rather than just as a growing static line.
  const travelerPos = currentLeg
    ? pointAtLength(currentLegPoints, currentLegLens, currentLegTotalLen * drawProgress)
    : null;
  const travelerFade = currentLeg
    ? interpolate(frame, [drawStart, drawStart + 4, drawEnd - 2, drawEnd + 4], [0, 1, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;
  const travelerPulse = 1 + Math.sin(frame / 4) * 0.12;

  // The one pin that animates in this scene: the destination we're arriving
  // at. Every other involved point was already reached in an earlier scene
  // (or, for a closure scene, ALL points were already reached), so those are
  // shown immediately/statically rather than popping in again.
  const animatedPointId = isClosure ? undefined : currentLeg ? currentLeg.to.id : toStop.id;
  const staticPoints = isClosure ? allPoints : allPoints.filter((p) => p.id !== animatedPointId);
  const animatedPoint = animatedPointId ? allPoints.find((p) => p.id === animatedPointId) : undefined;
  const animatedPt = animatedPointId
    ? (projectedById.get(animatedPointId) ?? ([width / 2, height / 2] as Point))
    : null;

  const closureBadgeIn = spring({ frame: frame - 22, fps, config: { damping: 13, stiffness: 150 } });

  const perPanelItem = hasMedia ? Math.max(1, Math.floor(durationInFrames / media.length)) : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0704", fontFamily }}>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 45% 40%, #241207 0%, #0b0704 70%)" }} />

      <svg width={width} height={height} style={{ position: "absolute", top: 0, left: 0 }}>
        <defs>
          <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="22" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="0 0 0 0 1  0 0 0 0 0.82  0 0 0 0 0.29  0 0 0 0.9 0" />
          </filter>
          <linearGradient id="countryFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={FILL_COLOR_TOP} />
            <stop offset="100%" stopColor={FILL_COLOR_BOTTOM} />
          </linearGradient>
          <clipPath id="countryClip">
            <path d={countryPathD} />
          </clipPath>
          <filter id="lineShadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
          </filter>
        </defs>

        <g opacity={fadeIn}>
          <path d={countryPathD} fill={GLOW_COLOR} filter="url(#glow)" opacity={0.85} />

          <g clipPath="url(#countryClip)">
            <image
              href={staticFile(country.terrainRelPath)}
              x={imgX0}
              y={imgY0}
              width={Math.max(1, imgX1 - imgX0)}
              height={Math.max(1, imgY1 - imgY0)}
              preserveAspectRatio="none"
              opacity={0.92}
            />
            <path d={countryPathD} fill="url(#countryFill)" opacity={0.35} />
          </g>

          <path d={countryPathD} fill="none" stroke="#5C1B02" strokeWidth={2.5} opacity={0.8} />

          <g clipPath="url(#countryClip)">
            {admin1PathsD.map((d, i) => (
              <path key={i} d={d} fill="none" stroke={BORDER_COLOR} strokeWidth={1.2} />
            ))}
          </g>
        </g>

        {/* Legs already travelled earlier in this country visit - fully
            drawn, not animated, so the accumulated route stays visible.
            Solid/brighter once the whole visit is wrapped up (closure). */}
        <g opacity={fadeIn}>
          {priorLegPointsList.map((pts, i) => (
            <path
              key={i}
              d={pointsToPath(pts)}
              fill="none"
              stroke={LINE_COLOR}
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={isClosure ? 0.9 : 0.7}
              filter="url(#lineShadow)"
            />
          ))}
        </g>

        {currentLeg && (
          <path
            d={currentLinePathD}
            fill="none"
            stroke={LINE_COLOR}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#lineShadow)"
          />
        )}

        {currentLeg && travelerPos && (
          <g
            transform={`translate(${travelerPos[0]}, ${travelerPos[1]}) scale(${travelerPulse})`}
            opacity={travelerFade}
          >
            <circle r={11} fill={GLOW_COLOR} filter="url(#glow)" opacity={0.9} />
            <circle r={6} fill="#FFF7E6" stroke="#7A2200" strokeWidth={2} />
          </g>
        )}

        <g opacity={fadeIn}>
          {staticPoints.map((p) => {
            const pt = projectedById.get(p.id);
            return pt ? <PinAndLabel key={p.id} x={pt[0]} y={pt[1]} label={p.name} scale={1} /> : null;
          })}
        </g>
        {animatedPoint && animatedPt && (
          <PinAndLabel x={animatedPt[0]} y={animatedPt[1]} label={animatedPoint.name} scale={destinationPop} />
        )}
      </svg>

      <div
        style={{
          position: "absolute",
          top: 64,
          left: 72,
          display: "flex",
          alignItems: "center",
          gap: 18,
        }}
      >
        <div
          style={{
            color: "white",
            fontFamily,
            fontWeight: 700,
            fontSize: 56,
            letterSpacing: 4,
            textTransform: "uppercase",
            textShadow: "0 2px 18px rgba(0,0,0,0.6)",
            opacity: titleIn,
            transform: `translateY(${interpolate(titleIn, [0, 1], [16, 0])}px)`,
          }}
        >
          {country.name}
        </div>
        {isClosure && closureBadgeIn > 0.01 && (
          <div
            style={{
              transform: `scale(${closureBadgeIn})`,
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "#2E7D32",
              border: "3px solid #FFD24A",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 14px rgba(0,0,0,0.5)",
            }}
          >
            <svg width={24} height={24} viewBox="0 0 24 24">
              <path
                d="M4 12.5 L9.5 18 L20 5"
                fill="none"
                stroke="white"
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </div>

      {hasMedia && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: width,
            width: panelWidth,
            height,
            overflow: "hidden",
            borderLeft: "2px solid rgba(255,210,74,0.35)",
            boxShadow: "-24px 0 40px rgba(0,0,0,0.5)",
          }}
        >
          {media.map((item, i) => (
            <Sequence key={item.id} from={i * perPanelItem} durationInFrames={perPanelItem} name={item.path}>
              <MediaKenBurns item={item} durationInFrames={perPanelItem} zoomTo={1.08} panXTo={-10} />
            </Sequence>
          ))}
          <AbsoluteFill
            style={{
              background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 20%, rgba(0,0,0,0.35) 100%)",
            }}
          />
        </div>
      )}

      {closure?.audioPath && <Audio src={staticFile(`data/${closure.audioPath}`)} />}
    </AbsoluteFill>
  );
};

const PinAndLabel: React.FC<{ x: number; y: number; label: string; scale: number }> = ({ x, y, label, scale }) => {
  if (scale <= 0.01) return null;
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      <circle r={13} fill="#D8280C" stroke="#FFD24A" strokeWidth={3} />
      <path
        d="M0,-6 L1.8,-1.8 L6.3,-1.8 L2.7,1 L4,5.5 L0,2.8 L-4,5.5 L-2.7,1 L-6.3,-1.8 L-1.8,-1.8 Z"
        fill="#FFE9B0"
      />
      <text
        x={0}
        y={-24}
        textAnchor="middle"
        fill="white"
        fontFamily={fontFamily}
        fontWeight={700}
        fontSize={30}
        style={{ textShadow: "0 2px 10px rgba(0,0,0,0.85)" }}
      >
        {label}
      </text>
    </g>
  );
};
