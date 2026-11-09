import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { TRIPS_DIR } from "../config.js";
import type { Trip } from "../types.js";

export function tripDir(tripId: string) {
  return path.join(TRIPS_DIR, tripId);
}
export function tripJsonPath(tripId: string) {
  return path.join(tripDir(tripId), "trip.json");
}
export function tripMediaDir(tripId: string, stopId: string) {
  return path.join(tripDir(tripId), "media", stopId);
}
export function tripAudioDir(tripId: string) {
  return path.join(tripDir(tripId), "audio");
}
export function tripOutputDir(tripId: string) {
  return path.join(tripDir(tripId), "output");
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function listTrips(): Promise<Trip[]> {
  await ensureDir(TRIPS_DIR);
  const ids = await fs.readdir(TRIPS_DIR).catch(() => []);
  const trips: Trip[] = [];
  for (const id of ids) {
    try {
      trips.push(await readTrip(id));
    } catch {
      // skip malformed/incomplete trip dirs
    }
  }
  trips.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return trips;
}

export async function readTrip(tripId: string): Promise<Trip> {
  const raw = await fs.readFile(tripJsonPath(tripId), "utf-8");
  return JSON.parse(raw) as Trip;
}

// Written to a temp file and renamed so a reader never sees half a trip.json.
async function writeTrip(trip: Trip): Promise<void> {
  trip.updatedAt = new Date().toISOString();
  await ensureDir(tripDir(trip.id));
  const tempPath = `${tripJsonPath(trip.id)}.${nanoid(6)}.tmp`;
  try {
    await fs.writeFile(tempPath, JSON.stringify(trip, null, 2));
    await fs.rename(tempPath, tripJsonPath(trip.id));
  } catch (err) {
    await fs.rm(tempPath, { force: true });
    throw err;
  }
}

const tripLocks = new Map<string, Promise<unknown>>();

function withTripLock<T>(tripId: string, task: () => Promise<T>): Promise<T> {
  const previous = tripLocks.get(tripId) ?? Promise.resolve();
  const run = previous.then(task);
  const tail = run.catch(() => undefined);
  tripLocks.set(tripId, tail);
  void tail.then(() => {
    if (tripLocks.get(tripId) === tail) tripLocks.delete(tripId);
  });
  return run;
}

// The only way to change a saved trip. `mutate` gets the latest version from
// disk, with the lock held, so concurrent changes can't overwrite each other.
// Don't do slow work (Claude, TTS) inside it: everything else on the trip waits.
export function updateTrip<T>(tripId: string, mutate: (trip: Trip) => T | Promise<T>): Promise<T> {
  return withTripLock(tripId, async () => {
    const trip = await readTrip(tripId);
    const before = JSON.stringify(trip);
    const result = await mutate(trip);
    if (JSON.stringify(trip) !== before) await writeTrip(trip);
    return result;
  });
}

export async function createTrip(title: string): Promise<Trip> {
  const now = new Date().toISOString();
  const trip: Trip = {
    id: nanoid(10),
    title,
    createdAt: now,
    updatedAt: now,
    stops: [],
  };
  await writeTrip(trip);
  return trip;
}

export async function deleteTrip(tripId: string): Promise<void> {
  // This is a recursive delete, so independently of any route validation,
  // refuse to touch anything but a direct child of the trips folder.
  const target = path.resolve(tripDir(tripId));
  if (path.dirname(target) !== path.resolve(TRIPS_DIR)) {
    throw new Error(`Refusing to delete outside the trips folder: ${tripId}`);
  }
  await withTripLock(tripId, () => fs.rm(target, { recursive: true, force: true }));
}
