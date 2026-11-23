import type { Orientation, Stop, Trip } from "../types.js";

// Checks for everything a client can send about a trip or a stop. Each returns either the cleaned
// value or one plain-English error for a 400. Unknown fields are dropped, never copied: media and
// audio paths are server-managed and later read and deleted from disk.

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export const LIMITS = { title: 120, name: 120, date: 80, text: 2000 } as const;
const ORIENTATIONS: readonly Orientation[] = ["landscape", "portrait"];
// Music comes only from remotion/public/music/ (see services/music.ts), one file deep.
const MUSIC_PATH = /^music\/[A-Za-z0-9 ._()-]+\.(mp3|m4a|wav|ogg)$/i;
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function text(value: unknown, field: string, max: number, required: boolean): Result<string | undefined> {
  if (value === undefined || value === null) return required ? fail(`${field} is required`) : { ok: true, value: undefined };
  if (typeof value !== "string") return fail(`${field} must be text`);
  if (CONTROL_CHARS.test(value)) return fail(`${field} contains control characters`);
  if (value.length > max) return fail(`${field} must be ${max} characters or fewer`);
  return { ok: true, value };
}

function trimmedName(value: unknown, field: string, max: number): Result<string> {
  const r = text(value, field, max, true);
  if (!r.ok) return r;
  const v = (r.value as string).trim();
  return v ? { ok: true, value: v } : fail(`${field} can't be empty`);
}

function coordinate(value: unknown, field: "lat" | "lng"): Result<number> {
  const limit = field === "lat" ? 90 : 180;
  if (typeof value !== "number" || !Number.isFinite(value)) return fail(`${field} must be a number`);
  if (value < -limit || value > limit) return fail(`${field} must be between -${limit} and ${limit}`);
  return { ok: true, value };
}

export const validateTitle = (value: unknown): Result<string> => trimmedName(value, "title", LIMITS.title);

type NewStop = Pick<Stop, "name" | "lat" | "lng" | "date" | "notes">;

export function validateNewStop(body: unknown): Result<NewStop> {
  if (!body || typeof body !== "object") return fail("name, lat, lng are required");
  const b = body as Record<string, unknown>;
  const name = trimmedName(b.name, "name", LIMITS.name);
  if (!name.ok) return name;
  const lat = coordinate(b.lat, "lat");
  if (!lat.ok) return lat;
  const lng = coordinate(b.lng, "lng");
  if (!lng.ok) return lng;
  const date = text(b.date, "date", LIMITS.date, false);
  if (!date.ok) return date;
  const notes = text(b.notes, "notes", LIMITS.text, false);
  if (!notes.ok) return notes;
  return { ok: true, value: { name: name.value, lat: lat.value, lng: lng.value, date: date.value, notes: notes.value } };
}

type StopPatch = Partial<Pick<Stop, "name" | "lat" | "lng" | "date" | "notes" | "narration">>;

export function validateStopPatch(body: unknown): Result<StopPatch> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const patch: StopPatch = {};
  if (b.name !== undefined) {
    const r = trimmedName(b.name, "name", LIMITS.name);
    if (!r.ok) return r;
    patch.name = r.value;
  }
  for (const field of ["lat", "lng"] as const) {
    if (b[field] === undefined) continue;
    const r = coordinate(b[field], field);
    if (!r.ok) return r;
    patch[field] = r.value;
  }
  for (const [field, max] of [["date", LIMITS.date], ["notes", LIMITS.text], ["narration", LIMITS.text]] as const) {
    if (b[field] === undefined) continue;
    const r = text(b[field], field, max, false);
    if (!r.ok) return r;
    patch[field] = r.value;
  }
  return { ok: true, value: patch };
}

type TripPatch = Partial<Pick<Trip, "title" | "music" | "orientation" | "titleCardNarration">>;

export function validateTripPatch(body: unknown): Result<TripPatch> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const patch: TripPatch = {};
  if (b.title !== undefined) {
    const r = validateTitle(b.title);
    if (!r.ok) return r;
    patch.title = r.value;
  }
  if (b.orientation !== undefined) {
    if (!ORIENTATIONS.includes(b.orientation as Orientation)) return fail(`orientation must be one of: ${ORIENTATIONS.join(", ")}`);
    patch.orientation = b.orientation as Orientation;
  }
  if (b.titleCardNarration !== undefined) {
    const r = text(b.titleCardNarration, "titleCardNarration", LIMITS.text, false);
    if (!r.ok) return r;
    patch.titleCardNarration = r.value;
  }
  if (b.music !== undefined) {
    const m = b.music as Record<string, unknown> | null;
    if (!m || typeof m !== "object") return fail("music must be an object with path and volume");
    if (typeof m.path !== "string" || (m.path !== "" && (!MUSIC_PATH.test(m.path) || m.path.includes(".."))))
      return fail("music path must be a track from the music list");
    if (typeof m.volume !== "number" || !Number.isFinite(m.volume) || m.volume < 0 || m.volume > 1)
      return fail("music volume must be between 0 and 1");
    if (m.durationSec !== undefined && (typeof m.durationSec !== "number" || !Number.isFinite(m.durationSec) || m.durationSec < 0))
      return fail("music durationSec must be a positive number");
    patch.music = { path: m.path, volume: m.volume, ...(m.durationSec !== undefined ? { durationSec: m.durationSec as number } : {}) };
  }
  return { ok: true, value: patch };
}
