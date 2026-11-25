import type { TravelMode } from "../types";

// The numbers for a "Year in travel" film, from the ordered stops. Pure, so it's easy to test.
// A leg is each move from one stop to the next; `mode` on a stop is how you arrived there.

export type StatsStop = { name: string; lat: number; lng: number; country?: string; mode?: TravelMode };
export type YearStats = {
  countries: number;
  cities: number;
  distanceKm: number; // great-circle, summed over the legs, rounded to the nearest km
  flights: number;
  longestLeg: { from: string; to: string; km: number } | null;
};

const EARTH_RADIUS_KM = 6371.0088; // mean radius

export function greatCircleKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const cityKey = (s: StatsStop) => `${s.name.trim().toLowerCase()}|${s.country ?? ""}`;

export function yearStats(stops: StatsStop[]): YearStats {
  const cities = new Set(stops.map(cityKey));
  const countries = new Set(stops.map((s) => s.country).filter((c): c is string => Boolean(c)));
  let total = 0;
  let flights = 0;
  let longestLeg: YearStats["longestLeg"] = null;
  for (let i = 1; i < stops.length; i++) {
    const from = stops[i - 1];
    const to = stops[i];
    if (cityKey(from) === cityKey(to)) continue; // listed twice in a row: not a journey
    const km = greatCircleKm(from, to);
    total += km;
    if (to.mode === "plane") flights++;
    if (!longestLeg || km > longestLeg.km) longestLeg = { from: from.name, to: to.name, km: Math.round(km) };
  }
  return { countries: countries.size, cities: cities.size, distanceKm: Math.round(total), flights, longestLeg };
}
