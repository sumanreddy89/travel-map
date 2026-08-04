import { AbsoluteFill, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from "remotion";
import type { MediaItem } from "../types";

export type MediaKenBurnsProps = {
  item: MediaItem | null;
  /** Local duration of this slide in frames - NOT the composition's total duration. */
  durationInFrames: number;
  zoomTo?: number;
  panXTo?: number;
};

// Ken Burns pan/zoom for a single photo/video slide. Takes the slide's own
// duration explicitly rather than reading it from useVideoConfig(), which
// only ever reflects the root composition's duration, not the enclosing
// Sequence's - using that here would make the animation run over the wrong
// (much longer) span and look almost static.
export const MediaKenBurns: React.FC<MediaKenBurnsProps> = ({
  item,
  durationInFrames,
  zoomTo = 1.12,
  panXTo = -18,
}) => {
  const frame = useCurrentFrame();

  const kenBurns = interpolate(frame, [0, durationInFrames], [1, zoomTo], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const panX = interpolate(frame, [0, durationInFrames], [0, panXTo], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fade = Math.min(
    interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );

  if (!item) {
    return (
      <AbsoluteFill
        style={{ background: "radial-gradient(circle at 50% 40%, #2a1509 0%, #0b0704 75%)", opacity: fade }}
      />
    );
  }

  const src = staticFile(`data/${item.path}`);
  const kenBurnsStyle: React.CSSProperties = {
    position: "absolute",
    width: "100%",
    height: "100%",
    transform: `scale(${kenBurns}) translateX(${panX}px)`,
  };

  // Videos only get one decoded layer - OffthreadVideo decode is expensive
  // enough per-frame that a second (blurred background) copy of the same
  // clip can push render time past Remotion's per-frame timeout on longer
  // videos. Photos are cheap to duplicate, so those get the full
  // blurred-fill treatment so portrait shots are never cropped.
  if (item.type === "video") {
    return (
      <AbsoluteFill style={{ opacity: fade, backgroundColor: "#000" }}>
        <OffthreadVideo src={src} muted style={{ ...kenBurnsStyle, objectFit: "cover" }} />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ opacity: fade, overflow: "hidden" }}>
      {/* Blurred, cropped copy fills the whole frame so there's never a bare
          letterboxed bar behind photos whose aspect ratio doesn't match the
          16:9 frame (e.g. portrait phone photos). Plain CSS background
          rather than a second <Img> - Remotion tracks every <Img>'s load
          with its own delayRender() handle, and two handles racing on the
          exact same file is what caused a real render to hang/timeout; a
          CSS background-image loads async without Remotion waiting on it,
          which is fine here since it's decorative blur, not the subject. */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          backgroundImage: `url(${src})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(40px) brightness(0.45)",
          transform: "scale(1.15)",
        }}
      />
      {/* The actual photo, always shown in full (never cropped) - Ken Burns
          scale/pan is gentle enough that it doesn't crop meaningfully. */}
      <Img src={src} style={{ ...kenBurnsStyle, objectFit: "contain" }} />
    </AbsoluteFill>
  );
};
