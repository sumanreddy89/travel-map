// Sizes and safe margins per orientation, in output pixels. Everything was first tuned on a
// 1920x1080 landscape canvas; landscape keeps exactly those numbers.
//
// Portrait (1080x1920) is usually watched on a phone, often shrunk to ~360px wide, with the
// platform's own buttons over the top, bottom and right edge. Scaling the landscape sizes by
// width (1080/1920) made captions ~10px tall at that size, so portrait gets its own type scale
// and conservative margins. These are design margins, not a promise about any platform's UI.
export type Insets = { top: number; right: number; bottom: number; left: number };

export type Layout = {
  portrait: boolean;
  text: number; // multiply type sizes tuned for 1920x1080
  mark: number; // multiply pins, strokes and markers
  safe: Insets; // keep captions, titles and credits inside these margins
  mapPadding: Insets; // where the route has to fit
};

export const PORTRAIT_SAFE: Insets = { top: 160, right: 140, bottom: 280, left: 72 };

export function getLayout(width: number, height: number): Layout {
  if (height <= width) {
    const u = width / 1920;
    return {
      portrait: false,
      text: u,
      mark: u,
      safe: { top: 64 * u, right: 72 * u, bottom: 64 * u, left: 72 * u },
      mapPadding: { top: 140 * u, right: 140 * u, bottom: 140 * u, left: 140 * u },
    };
  }
  const u = width / 1080;
  const s = PORTRAIT_SAFE;
  return {
    portrait: true,
    text: 1.6 * u,
    mark: 1.5 * u,
    safe: { top: s.top * u, right: s.right * u, bottom: s.bottom * u, left: s.left * u },
    // Below the country header, clear of the bottom and right-hand buttons, with room for labels.
    mapPadding: { top: (s.top + 220) * u, right: (s.right + 60) * u, bottom: (s.bottom + 80) * u, left: (s.left + 80) * u },
  };
}
