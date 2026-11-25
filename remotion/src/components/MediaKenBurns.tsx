import { useEffect, useState } from "react";
import { AbsoluteFill, Img, OffthreadVideo, continueRender, delayRender, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useAssetUrl } from "../lib/assets";
import type { MediaItem } from "../types";

export type MediaKenBurnsProps = {
  item: MediaItem | null;
  /** Local duration of this slide in frames - NOT the composition's total duration. */
  durationInFrames: number;
  zoomTo?: number;
  panXTo?: number;
  /** False for a slide the next one crossfades over, so the stop never dips to black between photos. */
  fadeOut?: boolean;
  /** Width/height of the box the slide fills. Defaults to the whole frame; the map's side panel passes its own. */
  boxAspect?: number;
};

// A photo fills its box (cropping the edges) when that crops at most this share of it; otherwise
// it's shown whole over a blurred copy. 4:3 and 3:2 photos fill a 16:9 frame; a portrait photo in
// a landscape frame, or a landscape photo in a portrait frame, keeps the blurred sides.
export const MAX_FILL_CROP = 0.35;

export function fillsBox(photoAspect: number, boxAspect: number): boolean {
  if (!(photoAspect > 0) || !(boxAspect > 0)) return false;
  return 1 - Math.min(photoAspect / boxAspect, boxAspect / photoAspect) <= MAX_FILL_CROP;
}

// The photo's aspect ratio, known before the frame is captured (the render waits for it).
function usePhotoAspect(src: string | null): number | null {
  const [aspect, setAspect] = useState<number | null>(null);
  const [handle] = useState(() => (src ? delayRender(`Measuring ${src}`) : null));
  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.onload = () => setAspect(img.naturalWidth / img.naturalHeight || 0);
    img.onerror = () => setAspect(0);
    img.src = src;
  }, [src]);
  useEffect(() => {
    if (handle !== null && aspect !== null) continueRender(handle);
  }, [aspect, handle]);
  return aspect;
}

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
  fadeOut = true,
  boxAspect,
}) => {
  const asset = useAssetUrl();
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const photoSrc = item && item.type !== "video" ? asset(item.path) : null;
  const photoAspect = usePhotoAspect(photoSrc);
  const fill = photoAspect !== null && fillsBox(photoAspect, boxAspect ?? width / height);

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
    fadeOut
      ? interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1
  );

  if (!item) {
    return (
      <AbsoluteFill
        style={{ background: "radial-gradient(circle at 50% 40%, #2a1509 0%, #0b0704 75%)", opacity: fade }}
      />
    );
  }

  const src = asset(item.path);
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

  if (fill) {
    return (
      <AbsoluteFill style={{ opacity: fade, overflow: "hidden", backgroundColor: "#000" }}>
        <Img src={src} style={{ ...kenBurnsStyle, objectFit: "cover" }} />
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
          // Deliberate, see the comment above: a second <Img> on the same file hung real renders.
          // eslint-disable-next-line @remotion/no-background-image
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
