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
export function paddedPointBbox(
  points: { lat: number; lng: number }[],
  opts: { minSpanLng?: number; minSpanLat?: number; paddingRatio?: number } = {}
): Bbox {
  const { minSpanLng = 0.35, minSpanLat = 0.35, paddingRatio = 0.45 } = opts;
  let [minLng, minLat, maxLng, maxLat] = pointBbox(points);

  let spanLng = maxLng - minLng;
  if (spanLng < minSpanLng) {
    const c = (minLng + maxLng) / 2;
    minLng = c - minSpanLng / 2;
    maxLng = c + minSpanLng / 2;
    spanLng = minSpanLng;
  }
  let spanLat = maxLat - minLat;
  if (spanLat < minSpanLat) {
    const c = (minLat + maxLat) / 2;
    minLat = c - minSpanLat / 2;
    maxLat = c + minSpanLat / 2;
    spanLat = minSpanLat;
  }

  const padLng = spanLng * paddingRatio;
  const padLat = spanLat * paddingRatio;
  return [minLng - padLng, minLat - padLat, maxLng + padLng, maxLat + padLat];
}
