import { Easing, interpolate, spring } from "remotion";

// Every timing in the map animation, in one place so it's easy to tune. Frames are at 30 fps.
export const MOTION = {
  route: {
    introPad: 18, // frames before a travel leg starts drawing
    transitOutroPad: 30, // frames the finished leg holds before the scene ends
    arrivalOutroPad: 16,
  },
  head: { glowRadius: 26, glowOpacity: 0.7 }, // the soft glow at the tip of the line as it draws
  vehicle: { fadeInFrames: 4, fadeOutFrames: 6 },
  pin: {
    leadFrames: 6, // the destination pin pops this many frames before the line arrives
    arrivalPopAt: 16, // first stop of a country, with no line to wait for
    spring: { damping: 8, stiffness: 170, mass: 0.7 }, // underdamped: overshoots, then settles
  },
  label: { delayFrames: 7, fadeFrames: 9, risePx: 16 }, // after the pin pops, the name slides up
  camera: { push: 1.22, drift: 0.35 }, // map scenes push in on the leg; closures pull back
  opener: { pullBackFrom: 1.12 },
  finale: { zoomFrom: 1.3, easeOutFrames: 36, holdFrames: 45, endCardFrames: 75 },
} as const;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// How much of a leg is drawn: eases in and out, 0 before `start`, 1 from `end`.
export function routeProgress(frame: number, start: number, end: number): number {
  return interpolate(frame, [start, Math.max(start + 1, end)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
}

// A pin's scale: 0 until `popAt`, then a spring that overshoots slightly and settles at 1.
export function pinScale(frame: number, fps: number, popAt: number): number {
  return spring({ frame: frame - popAt, fps, config: MOTION.pin.spring });
}

// A label follows its pin: fades in while sliding up into place.
export function labelMotion(frame: number, popAt: number): { opacity: number; dy: number } {
  const start = popAt + MOTION.label.delayFrames;
  const t = interpolate(frame, [start, start + MOTION.label.fadeFrames], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return { opacity: t, dy: (1 - t) * MOTION.label.risePx };
}
