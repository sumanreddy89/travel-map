export type Point = [number, number];

export function cumulativeLengths(points: Point[]): number[] {
  const lens = [0];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    lens.push(lens[i - 1] + Math.hypot(x1 - x0, y1 - y0));
  }
  return lens;
}

export function pointAtLength(points: Point[], lens: number[], target: number): Point {
  if (points.length === 0) return [0, 0];
  if (target <= 0) return points[0];
  const total = lens[lens.length - 1];
  if (target >= total) return points[points.length - 1];
  let i = 1;
  while (lens[i] < target) i++;
  const segLen = lens[i] - lens[i - 1];
  const t = segLen === 0 ? 0 : (target - lens[i - 1]) / segLen;
  const [x0, y0] = points[i - 1];
  const [x1, y1] = points[i];
  return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
}

export function truncatedPath(points: Point[], lens: number[], target: number): Point[] {
  if (points.length === 0) return [];
  if (target <= 0) return [points[0]];
  const total = lens[lens.length - 1];
  if (target >= total) return points;
  let i = 1;
  while (lens[i] < target) i++;
  const head = points.slice(0, i);
  head.push(pointAtLength(points, lens, target));
  return head;
}

export function quadraticBezierPoints(p0: Point, p1: Point, p2: Point, n = 40): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0];
    const y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1];
    pts.push([x, y]);
  }
  return pts;
}

export function pointsToPath(points: Point[]): string {
  if (points.length === 0) return "";
  return points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
}
