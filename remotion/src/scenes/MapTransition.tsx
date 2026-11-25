import { useMemo } from "react";
import { useAssetUrl } from "../lib/assets";
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
import { fontFamily } from "../lib/fonts";
import { getLayout } from "../lib/layout";
import { useTerrainReady } from "../lib/terrain";
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
import { OsmCredit } from "../components/Credit";
import { Vehicle } from "../components/Vehicle";
import { headingAt } from "../lib/heading";
import { MOTION, labelMotion, pinScale, routeProgress } from "../lib/motion";
import { placeLabels, type LabelPlacement } from "../lib/labels";
import type { MapScene, MediaItem, RouteLeg, RouteStopPoint } from "../types";

const GLOW_COLOR = "#FFD24A";
const FILL_COLOR_TOP = "#E8791F";
const FILL_COLOR_BOTTOM = "#B23A0E";
const LINE_COLOR = "#FBEFDD";
const BORDER_COLOR = "rgba(70,20,0,0.45)";
const NEIGHBOUR_FILL = "rgba(232,121,31,0.16)";
const NEIGHBOUR_STROKE = "rgba(255,210,74,0.35)";
const PANEL_WIDTH_RATIO = 0.38;
// The map camera (MOTION.camera): how far a scene pushes in, and how much its focus drifts to the centre.
const CAMERA_PUSH = MOTION.camera.push;
const CAMERA_DRIFT = MOTION.camera.drift;
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
  /** Every country the trip visits; the ones other than this scene's are drawn as dimmed silhouettes. */
  tripCountries?: { iso: string; geometry: GeoJSON.Geometry }[];
};

export const MapTransition: React.FC<MapTransitionProps> = ({ scene, media, durationInFrames, tripCountries = [] }) => {
  const asset = useAssetUrl();
  useTerrainReady(staticFile(scene.country.terrainRelPath));
  const frame = useCurrentFrame();
  const { width: fullWidth, height, fps } = useVideoConfig();
  const { toStop, country, currentLeg, priorLegs, closure, travel } = scene;
  const isClosure = Boolean(closure);

  const hasMedia = media.length > 0;
  const panelWidth = hasMedia ? Math.round(fullWidth * PANEL_WIDTH_RATIO) : 0;
  const width = fullWidth - panelWidth;
  // Sizes below were tuned on 1920x1080; lib/layout.ts gives portrait its own readable sizes and
  // safe margins. `scale` sizes pins, strokes and map labels.
  const layout = getLayout(fullWidth, height);
  const scale = layout.mark;

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
  const viewportAspect = width / height;
  const viewBbox = useMemo<Bbox>(
    () =>
      paddedPointBbox(allPoints, viewportAspect, {
        minSpanLng: (country.bbox[2] - country.bbox[0]) * 0.4,
        minSpanLat: (country.bbox[3] - country.bbox[1]) * 0.4,
      }),
    [allPoints, viewportAspect, country]
  );

  const projection = useMemo(
    () => buildProjection(viewBbox, width, height, layout.mapPadding),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layout is derived from width/height
    [viewBbox, width, height, fullWidth]
  );

  const countryPathD = useMemo(() => geometryToPath(projection, country.countryGeometry), [projection, country]);
  const neighbourPathsD = useMemo(
    () => tripCountries.filter((c) => c.iso !== country.iso).map((c) => geometryToPath(projection, c.geometry)),
    [projection, country, tripCountries]
  );
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
  // Timings live in lib/motion.ts (MOTION) so they can be tuned in one place.
  const outroPad = currentLeg ? MOTION.route.transitOutroPad : MOTION.route.arrivalOutroPad;
  const drawStart = currentLeg ? MOTION.route.introPad : 0;
  const drawEnd = currentLeg ? Math.max(drawStart + 10, durationInFrames - outroPad) : 0;
  const drawProgress = currentLeg ? routeProgress(frame, drawStart, drawEnd) : 1;

  // The destination pin pops (with a small bounce) as the line reaches it, then its label slides up.
  const popAt = currentLeg ? drawEnd - MOTION.pin.leadFrames : MOTION.pin.arrivalPopAt;
  const destinationPop = pinScale(frame, fps, popAt);
  const destinationLabel = labelMotion(frame, popAt);

  const visibleCurrentPoints = truncatedPath(currentLegPoints, currentLegLens, currentLegTotalLen * drawProgress);
  const currentLinePathD = pointsToPath(visibleCurrentPoints);

  // A small marker travelling along the line as it draws, so movement from
  // stop to stop reads clearly rather than just as a growing static line.
  const travelerPos = currentLeg
    ? pointAtLength(currentLegPoints, currentLegLens, currentLegTotalLen * drawProgress)
    : null;
  const travelerFade = currentLeg
    ? interpolate(frame, [drawStart, drawStart + MOTION.vehicle.fadeInFrames, drawEnd - 2, drawEnd + MOTION.vehicle.fadeOutFrames], [0, 1, 1, 0], {
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
  // Names placed so close stops don't stack their labels (in the pin's own units, before `scale`).
  const labelSpot = useMemo(() => {
    const pts = allPoints.map((p) => projectedById.get(p.id) ?? ([0, 0] as Point));
    const spots = placeLabels(pts.map(([x, y]) => [x / scale, y / scale] as Point), allPoints.map((p) => p.name), 30, 24, 13);
    return new Map(allPoints.map((p, i) => [p.id, spots[i]]));
  }, [allPoints, projectedById, scale]);
  const animatedPoint = animatedPointId ? allPoints.find((p) => p.id === animatedPointId) : undefined;
  const animatedPt = animatedPointId
    ? (projectedById.get(animatedPointId) ?? ([width / 2, height / 2] as Point))
    : null;

  const closureBadgeIn = spring({ frame: frame - 22, fps, config: { damping: 13, stiffness: 150 } });

  // A slow camera, so a map scene isn't a still frame with a growing line. Travel and arrival
  // scenes push in on where the action is (the leg's midpoint, or the arrival pin) and drift it
  // towards the centre; the closure scene pulls back to the whole route. Only zooms of 1 or more,
  // so the map never shrinks to show its own edge.
  const focus = useMemo<Point>(() => {
    const pts = isClosure
      ? allPoints.map((p) => projectedById.get(p.id))
      : currentLeg
        ? [projectedById.get(currentLeg.from.id), projectedById.get(currentLeg.to.id)]
        : [projectedById.get(toStop.id)];
    const known = pts.filter((p): p is Point => Boolean(p));
    if (!known.length) return [width / 2, height / 2];
    return [known.reduce((s, p) => s + p[0], 0) / known.length, known.reduce((s, p) => s + p[1], 0) / known.length];
  }, [isClosure, allPoints, currentLeg, toStop, projectedById, width, height]);
  const cameraT = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.sin),
  });
  const cameraZoom = isClosure ? interpolate(cameraT, [0, 1], [CAMERA_PUSH, 1]) : interpolate(cameraT, [0, 1], [1, CAMERA_PUSH]);
  const drift = isClosure ? 1 - cameraT : cameraT;
  const cameraX = focus[0] + (width / 2 - focus[0]) * CAMERA_DRIFT * drift;
  const cameraY = focus[1] + (height / 2 - focus[1]) * CAMERA_DRIFT * drift;
  const camera = `translate(${cameraX} ${cameraY}) scale(${cameraZoom}) translate(${-focus[0]} ${-focus[1]})`;

  const perPanelItem = hasMedia ? Math.max(1, Math.floor(durationInFrames / media.length)) : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0704", fontFamily }}>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 45% 40%, #241207 0%, #0b0704 70%)" }} />

      <svg width={width} height={height} style={{ position: "absolute", top: 0, left: 0 }}>
        <defs>
          <radialGradient id="headGlow">
            <stop offset="0%" stopColor="#FFF3C4" stopOpacity={1} />
            <stop offset="35%" stopColor={GLOW_COLOR} stopOpacity={0.55} />
            <stop offset="100%" stopColor={GLOW_COLOR} stopOpacity={0} />
          </radialGradient>
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

        <g transform={camera}>

        <g opacity={fadeIn}>
          {/* The trip's other countries, dimmed under the current one, so a stop near a border sits
              next to a visible neighbour rather than in empty space. */}
          {neighbourPathsD.map((d, i) => (
            <path key={i} d={d} fill={NEIGHBOUR_FILL} stroke={NEIGHBOUR_STROKE} strokeWidth={1.5} />
          ))}
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
              strokeWidth={5 * scale}
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
            strokeWidth={5 * scale}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#lineShadow)"
          />
        )}

        {/* A soft glow at the tip of the line while it draws. */}
        {currentLeg && travelerPos && drawProgress > 0 && drawProgress < 1 && (
          <circle cx={travelerPos[0]} cy={travelerPos[1]} r={MOTION.head.glowRadius * scale} fill="url(#headGlow)" opacity={MOTION.head.glowOpacity * travelerFade} />
        )}
        {currentLeg && travelerPos && (
          <Vehicle
            mode={currentLeg.mode}
            x={travelerPos[0]}
            y={travelerPos[1]}
            heading={headingAt(currentLegPoints, currentLegLens, currentLegTotalLen * drawProgress)}
            scale={scale}
            opacity={travelerFade}
            pulse={travelerPulse}
          />
        )}

        <g opacity={fadeIn}>
          {staticPoints.map((p) => {
            const pt = projectedById.get(p.id);
            return pt ? (
              <PinAndLabel key={p.id} x={pt[0]} y={pt[1]} label={p.name} scale={scale} spot={labelSpot.get(p.id)} />
            ) : null;
          })}
        </g>
        {animatedPoint && animatedPt && (
          <PinAndLabel
            x={animatedPt[0]}
            y={animatedPt[1]}
            label={animatedPoint.name}
            scale={scale}
            pinPop={destinationPop}
            labelOpacity={destinationLabel.opacity}
            labelDy={destinationLabel.dy}
            spot={labelSpot.get(animatedPoint.id)}
          />
        )}
        </g>
      </svg>

      <div
        style={{
          position: "absolute",
          // Portrait: below the TravelMap credit, which sits at the top of the safe area.
          top: layout.portrait ? layout.safe.top + 70 * layout.text : layout.safe.top,
          left: layout.safe.left,
          right: layout.safe.right,
          display: "flex",
          alignItems: "center",
          gap: 18 * layout.text,
        }}
      >
        <div
          style={{
            color: "white",
            fontFamily,
            fontWeight: 700,
            fontSize: 56 * layout.text,
            letterSpacing: 4 * layout.text,
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
              transform: `scale(${closureBadgeIn * scale})`,
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
              <MediaKenBurns item={item} durationInFrames={perPanelItem} zoomTo={1.08} panXTo={-10} boxAspect={panelWidth / height} />
            </Sequence>
          ))}
          <AbsoluteFill
            style={{
              background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 20%, rgba(0,0,0,0.35) 100%)",
            }}
          />
        </div>
      )}

      {[...priorLegs, ...(currentLeg ? [currentLeg] : [])].some((leg) => (leg.routeCoords?.length ?? 0) > 1) && <OsmCredit />}
      {closure?.audioPath && <Audio src={asset(closure.audioPath)} />}
      {travel?.audioPath && <Audio src={asset(travel.audioPath)} />}
    </AbsoluteFill>
  );
};

// The pin and its label animate separately: the pin pops (pinPop, a spring), then the label
// fades in while sliding up (labelOpacity, labelDy). Static pins pass the defaults.
const PinAndLabel: React.FC<{ x: number; y: number; label: string; scale: number; pinPop?: number; labelOpacity?: number; labelDy?: number; spot?: LabelPlacement }> = ({
  x,
  y,
  label,
  scale,
  pinPop = 1,
  labelOpacity = 1,
  labelDy = 0,
  spot = { dx: 0, dy: -24, anchor: "middle" },
}) => {
  if (scale <= 0.01 || pinPop <= 0.01) return null;
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      <g transform={`scale(${pinPop})`}>
        <circle r={13} fill="#D8280C" stroke="#FFD24A" strokeWidth={3} />
        <path
          d="M0,-6 L1.8,-1.8 L6.3,-1.8 L2.7,1 L4,5.5 L0,2.8 L-4,5.5 L-2.7,1 L-6.3,-1.8 L-1.8,-1.8 Z"
          fill="#FFE9B0"
        />
      </g>
      <text
        x={spot.dx}
        y={spot.dy + labelDy}
        opacity={labelOpacity}
        textAnchor={spot.anchor}
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
