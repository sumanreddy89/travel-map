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

export async function writeTrip(trip: Trip): Promise<void> {
  trip.updatedAt = new Date().toISOString();
  await ensureDir(tripDir(trip.id));
  await fs.writeFile(tripJsonPath(trip.id), JSON.stringify(trip, null, 2));
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
  await fs.rm(tripDir(tripId), { recursive: true, force: true });
}
