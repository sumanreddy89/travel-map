import { pointAtLength, type Point } from "./polyline";

// The direction of travel at a distance along a drawn route, in degrees for an SVG rotate():
// 0 points right (east), 90 points down. Measured across a short window around the point rather
// than one segment, so a vehicle doesn't twitch on the tiny zigzags of a road route.
export function headingAt(points: Point[], lens: number[], at: number, window = 12): number {
  const total = lens[lens.length - 1] ?? 0;
  if (points.length < 2 || total === 0) return 0;
  const half = Math.min(window, total) / 2;
  const from = Math.max(0, Math.min(at - half, total - 2 * half));
  const a = pointAtLength(points, lens, from);
  const b = pointAtLength(points, lens, from + 2 * half);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return 0;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}
