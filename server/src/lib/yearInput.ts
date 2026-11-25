// "Year in travel" input: an ordered list of cities, one per line, turned into trip stops.
//
//   year: 2026                      (optional; otherwise the year of the first dated row)
//   Lisbon | 2026-02-14
//   Madrid | 2026-03-20 | plane     (mode = how you got here: plane, train or car; default plane)
//   Paris, FR | 2026-06-11 | train  (add a country, as a code or name, when a name is ambiguous)
//
// Blank lines and lines starting with # are skipped. Places come from a bundled list of ~1,250
// cities (Natural Earth, public domain), so nothing is looked up online. Every problem is
// reported with its line number and what to change; this never throws on bad input.
import fs from "node:fs";
import { TRAVEL_MODES, type TravelMode } from "./travelMode.js";
import type { Stop } from "../types.js";

export type City = { name: string; iso3: string; iso2: string; lat: number; lng: number; pop: number };
export type YearRow = { line: number; city: City; date?: string; mode: TravelMode };
export type YearInput = { year: number; rows: YearRow[] };
export type YearResult = { ok: true; value: YearInput } | { ok: false; error: string };

export const MAX_ROWS = 60;
const DEFAULT_MODE: TravelMode = "plane";

const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

type Row = [string, string, string, string, number, number, number, string[]?];
// server/places/cities.json: the same relative path from src/lib (tsx) and dist/lib (built).
const citiesFile = JSON.parse(fs.readFileSync(new URL("../../places/cities.json", import.meta.url), "utf-8")) as { cities: Row[]; countries: Record<string, string> };
const COUNTRY_NAMES = citiesFile.countries;
export const CITIES: City[] = (citiesFile.cities as Row[]).map(([name, , iso3, iso2, lat, lng, pop]) => ({ name, iso3, iso2, lat, lng, pop }));
// Names to match: the local name, its plain-letters form, and Natural Earth's alternatives (the
// English "Copenhagen" for København). A match on an alternative keeps that spelling as the label.
const byName = new Map<string, { city: City; label: string }[]>();
for (const [i, row] of (citiesFile.cities as Row[]).entries()) {
  const names: [string, string][] = [[row[0], row[0]], [row[1], row[0]], ...(row[7] ?? []).map((a): [string, string] => [a, a])];
  const seen = new Set<string>();
  for (const [name, label] of names) {
    const key = fold(name);
    if (seen.has(key)) continue;
    seen.add(key);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push({ city: CITIES[i], label });
  }
}

// Country names people are likely to type, beyond the two- and three-letter codes.
const COUNTRY_ALIASES: Record<string, string> = {
  uk: "GBR", "united kingdom": "GBR", england: "GBR", scotland: "GBR", usa: "USA", "united states": "USA", us: "USA",
};

function matchesCountry(c: City, q: string): boolean {
  const f = fold(q);
  if (!f) return true;
  if (COUNTRY_ALIASES[f]) return c.iso3 === COUNTRY_ALIASES[f];
  return f === c.iso2.toLowerCase() || f === c.iso3.toLowerCase() || f === fold(COUNTRY_NAMES[c.iso3] ?? "");
}

export function findCity(query: string): { ok: true; city: City } | { ok: false; error: string } {
  const [namePart, countryPart = ""] = query.split(/,(?=[^,]*$)/).map((s) => s.trim());
  const matches = (byName.get(fold(namePart)) ?? []).filter((m) => matchesCountry(m.city, countryPart));
  const candidates = matches.map((m) => m.city);
  if (!namePart) return { ok: false, error: "the place is empty" };
  if (candidates.length === 0) {
    return {
      ok: false,
      error: countryPart
        ? `can't find "${namePart}" in "${countryPart}". Use the country's name or two-letter code (for example "Paris, FR"), or a bigger city nearby.`
        : `can't find "${namePart}". The built-in list has about 1,250 major cities; check the spelling or use a bigger city nearby.`,
    };
  }
  const countries = [...new Set(candidates.map((c) => c.iso2 || c.iso3))];
  if (countries.length > 1) {
    return { ok: false, error: `"${namePart}" matches places in ${countries.join(", ")}. Add the country, for example "${namePart}, ${countries[0]}".` };
  }
  const best = matches.reduce((a, b) => (b.city.pop > a.city.pop ? b : a));
  return { ok: true, city: { ...best.city, name: best.label } };
}

const isRealDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

export function parseYearInput(text: unknown): YearResult {
  if (typeof text !== "string" || !text.trim()) return { ok: false, error: "Paste at least one city, one per line." };
  let year: number | undefined;
  const rows: YearRow[] = [];
  const lines = text.split(/\r?\n/);
  for (const [i, raw] of lines.entries()) {
    const n = i + 1;
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const yearLine = line.match(/^year\s*:\s*(.*)$/i);
    if (yearLine) {
      if (!/^\d{4}$/.test(yearLine[1].trim())) return { ok: false, error: `Line ${n}: "${yearLine[1].trim()}" isn't a year. Write it like "year: 2026".` };
      year = Number(yearLine[1].trim());
      continue;
    }
    const parts = line.split("|").map((s) => s.trim());
    if (parts.length > 3) return { ok: false, error: `Line ${n}: too many "|". Each line is: city | date | mode.` };
    const [place, date = "", modeText = ""] = parts;
    const found = findCity(place);
    if (!found.ok) return { ok: false, error: `Line ${n}: ${found.error}` };
    if (date && !isRealDate(date)) return { ok: false, error: `Line ${n}: "${date}" isn't a date. Use YYYY-MM-DD, for example 2026-03-20.` };
    const mode = (modeText.toLowerCase() || DEFAULT_MODE) as TravelMode;
    if (!(TRAVEL_MODES as readonly string[]).includes(mode)) {
      return { ok: false, error: `Line ${n}: "${modeText}" isn't a travel mode. Use plane, train or car (or leave it out for plane).` };
    }
    const prevDate = [...rows].reverse().find((r) => r.date)?.date;
    if (date && prevDate && date < prevDate) {
      return { ok: false, error: `Line ${n}: ${date} is before ${prevDate} on an earlier line. List the cities in the order you visited them.` };
    }
    rows.push({ line: n, city: found.city, date: date || undefined, mode });
    if (rows.length > MAX_ROWS) return { ok: false, error: `Too many cities: the most is ${MAX_ROWS}.` };
  }
  if (!rows.length) return { ok: false, error: "Paste at least one city, one per line." };
  const firstDated = rows.find((r) => r.date);
  const resolvedYear = year ?? (firstDated ? Number(firstDated.date!.slice(0, 4)) : undefined);
  if (!resolvedYear) return { ok: false, error: 'Add a date to at least one line, or a first line like "year: 2026", so the film knows which year it is.' };
  return { ok: true, value: { year: resolvedYear, rows } };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// The trip fields for a parsed year: one stop per row (how you arrived is its travelMode).
export function yearTripFields(v: YearInput, makeId: () => string): { title: string; yearInTravel: { year: number }; stops: Stop[] } {
  return {
    title: `${v.year} in travel`,
    yearInTravel: { year: v.year },
    stops: v.rows.map((r) => ({
      id: makeId(),
      name: r.city.name,
      lat: r.city.lat,
      lng: r.city.lng,
      ...(r.date ? { date: `${Number(r.date.slice(8, 10))} ${MONTHS[Number(r.date.slice(5, 7)) - 1]}` } : {}),
      travelMode: r.mode,
      media: [],
    })),
  };
}
