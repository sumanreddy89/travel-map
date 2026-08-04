import * as turf from "@turf/turf";
import fetch from "node-fetch";

// Real driving route between two stops, for the animated line to bend along
// roads/coast like the reference footage rather than a straight chord.
// Falls back to null (caller uses a smoothed great-circle curve) if the
// public OSRM demo is unreachable or the points are too far apart to be a
// sensible "drive" (e.g. an inter-country flight hop).
export async function fetchRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<[number, number][] | null> {
  const distanceKm = turf.distance(turf.point([from.lng, from.lat]), turf.point([to.lng, to.lat]), {
    units: "kilometers",
  });
  if (distanceKm > 600) return null; // too far for a road route to make sense visually

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const data = (await resp.json()) as any;
    const coords: [number, number][] | undefined = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;

    const line = turf.lineString(coords);
    const simplified = turf.simplify(line, { tolerance: 0.003, highQuality: true });
    return simplified.geometry.coordinates as [number, number][];
  } catch {
    return null;
  }
}
