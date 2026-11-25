import type { Point } from "./polyline";

// Where each pin's name goes so names don't sit on top of each other when stops are close together
// on screen (Porto, Salamanca and Madrid once the map zooms out to include Palma). Greedy, in
// order: each label takes the first of above / below / right / left whose box clears every label
// already placed and every pin. Positions are offsets from the pin, in the same units as `size`.

export type LabelPlacement = { dx: number; dy: number; anchor: "middle" | "start" | "end" };
type Box = { x0: number; y0: number; x1: number; y1: number };

// Oswald is condensed; this is a slightly generous average glyph width as a share of font size.
const CHAR_WIDTH = 0.62;
// Breathing room kept around every label box.
const MARGIN = 0.25;

export function placeLabels(points: Point[], names: string[], size: number, gap: number, pinRadius: number): LabelPlacement[] {
  const pins: Box[] = points.map(([x, y]) => ({ x0: x - pinRadius, y0: y - pinRadius, x1: x + pinRadius, y1: y + pinRadius }));
  const placed: Box[] = [];
  return points.map(([x, y], i) => {
    const w = names[i].length * size * CHAR_WIDTH;
    const options: (LabelPlacement & { box: Box })[] = [
      { dx: 0, dy: -gap, anchor: "middle", box: { x0: x - w / 2, y0: y - gap - size, x1: x + w / 2, y1: y - gap } },
      { dx: 0, dy: gap + size * 0.8, anchor: "middle", box: { x0: x - w / 2, y0: y + gap - size * 0.2, x1: x + w / 2, y1: y + gap + size * 0.8 } },
      { dx: gap, dy: size * 0.35, anchor: "start", box: { x0: x + gap, y0: y - size * 0.65, x1: x + gap + w, y1: y + size * 0.35 } },
      { dx: -gap, dy: size * 0.35, anchor: "end", box: { x0: x - gap - w, y0: y - size * 0.65, x1: x - gap, y1: y + size * 0.35 } },
    ];
    const m = size * MARGIN;
    const grow = (b: Box): Box => ({ x0: b.x0 - m, y0: b.y0 - m, x1: b.x1 + m, y1: b.y1 + m });
    const area = (a: Box, b: Box) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
    // How much a spot collides with labels already placed and with other pins; 0 means it's clear.
    const cost = (b: Box) =>
      placed.reduce((s, p) => s + area(p, grow(b)), 0) + pins.reduce((s, p, j) => s + (j === i ? 0 : area(p, grow(b))), 0);
    // The first clear spot in order of preference; if none is clear, the one that collides least.
    const pick = options.find((o) => cost(o.box) === 0) ?? options.reduce((best, o) => (cost(o.box) < cost(best.box) ? o : best));
    placed.push(pick.box);
    return { dx: pick.dx, dy: pick.dy, anchor: pick.anchor };
  });
}
