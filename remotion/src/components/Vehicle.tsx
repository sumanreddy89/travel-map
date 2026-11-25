import type { TravelMode } from "../types";

// The marker that travels along a leg as it draws: a top-down plane, train or car turned to face
// the way it's going, or the plain glowing dot when the leg has no mode. Icons are drawn facing
// right (heading 0) around the origin.

const GLOW_COLOR = "#FFD24A";
const BODY = "#FFF7E6";
const OUTLINE = "#7A2200";

const ICONS: Record<TravelMode, React.ReactNode> = {
  plane: (
    <path
      d="M16,0 C16,-1.6 13,-2.4 10,-2.4 L4,-2.4 L-4,-13 L-8,-13 L-3,-2.4 L-9,-2.4 L-12.5,-7 L-15,-7 L-13,0 L-15,7 L-12.5,7 L-9,2.4 L-3,2.4 L-8,13 L-4,13 L4,2.4 L10,2.4 C13,2.4 16,1.6 16,0 Z"
      fill={BODY}
      stroke={OUTLINE}
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
  ),
  train: (
    <g stroke={OUTLINE} strokeWidth={1.6} strokeLinejoin="round">
      <path d="M16,-5 Q18,0 16,5 L-16,5 L-16,-5 Z" fill={BODY} />
      <line x1={5} y1={-5} x2={5} y2={5} />
      <line x1={-6} y1={-5} x2={-6} y2={5} />
      <rect x={10} y={-3} width={4} height={6} rx={1} fill={OUTLINE} stroke="none" />
    </g>
  ),
  car: (
    <g stroke={OUTLINE} strokeWidth={1.6} strokeLinejoin="round">
      <rect x={-12} y={-6.5} width={24} height={13} rx={4} fill={BODY} />
      <rect x={2} y={-5} width={5} height={10} rx={1.5} fill={OUTLINE} stroke="none" />
      <rect x={-9} y={-5} width={4} height={10} rx={1.5} fill={OUTLINE} stroke="none" opacity={0.7} />
    </g>
  ),
};

export const Vehicle: React.FC<{ mode?: TravelMode; x: number; y: number; heading: number; scale: number; opacity: number; pulse: number; size?: number }> = ({
  mode,
  x,
  y,
  heading,
  scale,
  opacity,
  pulse,
  size = 1.35,
}) => {
  if (opacity <= 0.01) return null;
  if (!mode) {
    return (
      <g transform={`translate(${x}, ${y}) scale(${pulse * scale})`} opacity={opacity}>
        <circle r={11} fill={GLOW_COLOR} filter="url(#glow)" opacity={0.9} />
        <circle r={6} fill={BODY} stroke={OUTLINE} strokeWidth={2} />
      </g>
    );
  }
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale * size})`} opacity={opacity}>
      <circle r={16} fill={GLOW_COLOR} filter="url(#glow)" opacity={0.75} />
      <g transform={`rotate(${heading})`}>{ICONS[mode]}</g>
    </g>
  );
};
