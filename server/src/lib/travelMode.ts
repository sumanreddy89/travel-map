// How a leg is travelled, which decides the vehicle drawn on the map and whether it follows roads.
// A stop's `travelMode` is how you arrived there. "auto" picks by distance; no mode at all draws
// the plain travelling dot, as before modes existed.

export const TRAVEL_MODES = ["car", "train", "plane"] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];
export type TravelModeChoice = TravelMode | "auto";

// Straight-line distance bands for "auto": a drive, a train ride, or a flight.
export const AUTO_CAR_MAX_KM = 250;
export const AUTO_TRAIN_MAX_KM = 700;

export function legMode(choice: TravelModeChoice | undefined, distanceKm: number): TravelMode | undefined {
  if (choice === "auto") return distanceKm <= AUTO_CAR_MAX_KM ? "car" : distanceKm <= AUTO_TRAIN_MAX_KM ? "train" : "plane";
  return choice && (TRAVEL_MODES as readonly string[]).includes(choice) ? choice : undefined;
}

// Flights don't follow roads: no road route, so the map draws a curved arc instead.
export function followsRoads(mode: TravelMode | undefined): boolean {
  return mode !== "plane";
}

export function isTravelModeChoice(v: unknown): v is TravelModeChoice {
  return v === "auto" || (TRAVEL_MODES as readonly unknown[]).includes(v);
}
