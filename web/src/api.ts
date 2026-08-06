import type { GeocodeResult, MusicTrack, RenderJob, Stop, Trip } from "./types";

async function json<T>(resp: Response): Promise<T> {
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}: ${await resp.text().catch(() => "")}`);
  return resp.json() as Promise<T>;
}

export const api = {
  listTrips: () => fetch("/api/trips").then((r) => json<Trip[]>(r)),
  createTrip: (title: string) =>
    fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }).then((r) => json<Trip>(r)),
  getTrip: (id: string) => fetch(`/api/trips/${id}`).then((r) => json<Trip>(r)),
  updateTrip: (
    id: string,
    patch: Partial<Pick<Trip, "title" | "stops" | "music" | "orientation" | "titleCardNarration">>
  ) =>
    fetch(`/api/trips/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => json<Trip>(r)),
  deleteTrip: (id: string) => fetch(`/api/trips/${id}`, { method: "DELETE" }),

  generateTitleNarration: (tripId: string) =>
    fetch(`/api/trips/${tripId}/title-narration`, { method: "POST" }).then((r) =>
      json<{ titleCardNarration: string }>(r)
    ),

  addStop: (tripId: string, stop: { name: string; lat: number; lng: number; date?: string; notes?: string }) =>
    fetch(`/api/trips/${tripId}/stops`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stop),
    }).then((r) => json<Stop>(r)),
  updateStop: (tripId: string, stopId: string, patch: Partial<Stop>) =>
    fetch(`/api/trips/${tripId}/stops/${stopId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => json<Stop>(r)),
  deleteStop: (tripId: string, stopId: string) =>
    fetch(`/api/trips/${tripId}/stops/${stopId}`, { method: "DELETE" }),
  generateStopNarration: (tripId: string, stopId: string) =>
    fetch(`/api/trips/${tripId}/stops/${stopId}/narration`, { method: "POST" }).then((r) => json<Stop>(r)),
  reorderStops: (tripId: string, order: string[]) =>
    fetch(`/api/trips/${tripId}/stops/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order }),
    }).then((r) => json<Trip>(r)),

  uploadMedia: (tripId: string, stopId: string, files: FileList) => {
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    return fetch(`/api/trips/${tripId}/stops/${stopId}/media`, { method: "POST", body: form }).then((r) =>
      json<Stop["media"]>(r)
    );
  },
  deleteMedia: (tripId: string, stopId: string, mediaId: string) =>
    fetch(`/api/trips/${tripId}/stops/${stopId}/media/${mediaId}`, { method: "DELETE" }),

  geocode: (q: string) => fetch(`/api/geocode?q=${encodeURIComponent(q)}`).then((r) => json<GeocodeResult[]>(r)),

  startRender: (tripId: string) => fetch(`/api/trips/${tripId}/render`, { method: "POST" }).then((r) => json<RenderJob>(r)),
  renderStatus: (tripId: string) => fetch(`/api/trips/${tripId}/render/status`).then((r) => json<RenderJob>(r)),

  listMusic: () => fetch("/api/music").then((r) => json<MusicTrack[]>(r)),
};
