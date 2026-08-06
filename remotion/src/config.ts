// Simple toggles for visual behavior that's easy to flip on request without
// digging through component code.

// Show a slideshow of the destination stop's photos/videos beside the map
// while it animates. Off by default per user feedback (2026-08-02) - it made
// the map scenes feel busy. Flip to true to bring it back.
export const SHOW_MEDIA_PANEL_IN_MAP_SCENES = false;

export const VIDEO_DIMENSIONS = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 },
} as const;
