import { geoEquirectangular, geoPath, type GeoProjection } from "d3-geo";

export type Bbox = [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]

// Plain equirectangular (Plate Carrée) projection - matches the linear
// lon/lat -> pixel mapping used server-side to crop the shaded-relief raster,
// so the vector outline and the terrain image line up exactly with no warp.
export function buildProjection(viewBbox: Bbox, width: number, height: number, padding = 0): GeoProjection {
  const [minLng, minLat, maxLng, maxLat] = viewBbox;
  const projection = geoEquirectangular();
  // Winding matters to d3-geo's spherical polygon logic: this order (CCW in
  // lng/lat) is required for it to treat this as the small enclosed
  // rectangle - the reverse order gets interpreted as "the rest of the
  // globe minus this rectangle", which blows fitExtent's scale down to
  // near-zero.
  const bboxPolygon: GeoJSON.Polygon = {
    type: "Polygon",
    coordinates: [
      [
        [minLng, minLat],
        [minLng, maxLat],
        [maxLng, maxLat],
        [maxLng, minLat],
        [minLng, minLat],
      ],
    ],
  };
  projection.fitExtent(
    [
      [padding, padding],
      [width - padding, height - padding],
    ],
    bboxPolygon
  );
  return projection;
}

export function geometryToPath(projection: GeoProjection, geometry: GeoJSON.Geometry | GeoJSON.GeoJSON): string {
  const path = geoPath(projection);
  return path(geometry as any) ?? "";
}

export function unionBbox(boxes: Bbox[]): Bbox {
  const minLng = Math.min(...boxes.map((b) => b[0]));
  const minLat = Math.min(...boxes.map((b) => b[1]));
  const maxLng = Math.max(...boxes.map((b) => b[2]));
  const maxLat = Math.max(...boxes.map((b) => b[3]));
  return [minLng, minLat, maxLng, maxLat];
}

export function pointBbox(points: { lat: number; lng: number }[]): Bbox {
  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

// A view fit to just the involved points (plus padding), rather than always
// the whole country - a couple of stops clustered in one corner of a large
// country used to render tiny and cramped when the view was forced to
// include the entire country silhouette every time.
//
// minSpanLng/minSpanLat should be a fraction of the *country's* own extent
// (not a fixed degree value) - a single isolated point (e.g. the trip's
// first arrival) otherwise zooms in so tight the country silhouette fills
// the whole frame edge-to-edge with no visible border, losing the "which
// country/shape is this" context the glow outline is there to give.
//
// viewportAspect (width/height of the video frame) is required: without
// matching the view window's own aspect ratio to the frame's, fitExtent
// still renders correctly but a country/route that's naturally wide-and-flat
// (like Cyprus) leaves huge empty margins top and bottom in a tall portrait
// frame, since it can only scale up to the *narrower* limiting dimension.
// Expanding the shorter side of the bbox to match closes that gap.
export function paddedPointBbox(
  points: { lat: number; lng: number }[],
  viewportAspect: number,
  opts: { minSpanLng?: number; minSpanLat?: number; paddingRatio?: number } = {}
): Bbox {
  const { minSpanLng = 0.35, minSpanLat = 0.35, paddingRatio = 0.45 } = opts;
  const [rawMinLng, rawMinLat, rawMaxLng, rawMaxLat] = pointBbox(points);
  const rawSpanLng = rawMaxLng - rawMinLng;
  const rawSpanLat = rawMaxLat - rawMinLat;

  let minLng = rawMinLng;
  let maxLng = rawMaxLng;
  let minLat = rawMinLat;
  let maxLat = rawMaxLat;

  let spanLng = rawSpanLng;
  if (spanLng < minSpanLng) {
    const c = (minLng + maxLng) / 2;
    minLng = c - minSpanLng / 2;
    maxLng = c + minSpanLng / 2;
    spanLng = minSpanLng;
  }
  let spanLat = rawSpanLat;
  if (spanLat < minSpanLat) {
    const c = (minLat + maxLat) / 2;
    minLat = c - minSpanLat / 2;
    maxLat = c + minSpanLat / 2;
    spanLat = minSpanLat;
  }

  const padLng = spanLng * paddingRatio;
  const padLat = spanLat * paddingRatio;
  minLng -= padLng;
  maxLng += padLng;
  minLat -= padLat;
  maxLat += padLat;
  spanLng += 2 * padLng;
  spanLat += 2 * padLat;

  // Reconcile the bbox's aspect ratio with the frame's - but only when
  // they're on opposite sides of square (a landscape-shaped bbox in a
  // portrait frame, or vice versa). Same-side mismatches (e.g. a wide
  // country in a moderately-wide landscape frame) are already handled fine
  // by fitExtent's own centering, and were tuned/approved as-is - applying
  // this correction there too would shift that already-good framing.
  // For a genuine orientation clash (Cyprus - wide and flat - in a tall
  // portrait frame is the extreme case), neither stretching one axis alone
  // (leaves the subject tiny and thin) nor cropping the other alone (can cut
  // a multi-stop route's stops out of frame) works well, so split the
  // correction as a geometric-mean blend of both, falling back to pure
  // growth only if shrinking would cut below the points' actual spread.
  const bboxAspect = spanLng / spanLat;
  const isOrientationClash = bboxAspect > 1 !== viewportAspect > 1;
  if (isOrientationClash && bboxAspect > viewportAspect) {
    const factor = Math.sqrt(bboxAspect / viewportAspect);
    const floorLngSpan = rawSpanLng * (1 + paddingRatio);
    const newLngSpan = Math.max(spanLng / factor, floorLngSpan);
    const cLng = (minLng + maxLng) / 2;
    minLng = cLng - newLngSpan / 2;
    maxLng = cLng + newLngSpan / 2;

    const newLatSpan = Math.max(newLngSpan / viewportAspect, spanLat);
    const cLat = (minLat + maxLat) / 2;
    minLat = cLat - newLatSpan / 2;
    maxLat = cLat + newLatSpan / 2;
  } else if (isOrientationClash && bboxAspect < viewportAspect) {
    const factor = Math.sqrt(viewportAspect / bboxAspect);
    const floorLatSpan = rawSpanLat * (1 + paddingRatio);
    const newLatSpan = Math.max(spanLat / factor, floorLatSpan);
    const cLat = (minLat + maxLat) / 2;
    minLat = cLat - newLatSpan / 2;
    maxLat = cLat + newLatSpan / 2;

    const newLngSpan = Math.max(newLatSpan * viewportAspect, spanLng);
    const cLng = (minLng + maxLng) / 2;
    minLng = cLng - newLngSpan / 2;
    maxLng = cLng + newLngSpan / 2;
  }

  return [minLng, minLat, maxLng, maxLat];
}
