export type MediaItem = {
  id: string;
  type: "photo" | "video";
  path: string;
  durationSec?: number;
};

export type Stop = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  date?: string;
  notes?: string;
  media: MediaItem[];
  narration?: string;
  audioPath?: string;
  audioDurationSec?: number;
};

export type Trip = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  stops: Stop[];
  music?: { path: string; volume: number };
};

export type RenderJobState = "idle" | "narrating" | "voicing" | "mapping" | "rendering" | "done" | "error";

export type RenderJob = {
  tripId: string;
  state: RenderJobState;
  progress: number;
  message?: string;
  outputPath?: string;
  error?: string;
};

export type GeocodeResult = {
  display_name: string;
  lat: string;
  lon: string;
};
