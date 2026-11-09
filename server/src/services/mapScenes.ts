import { countryIso, ensureCountryAssets, findCountryForPoint, regionForPoint, type CountryAssets } from "./geo.js";
import { fetchRoute } from "./routing.js";
import { generateClosingNarration, generateTravelNarration } from "./narration.js";
import type { MapScene, RouteLeg, Stop } from "../types.js";

function toPoint(stop: Stop) {
  return { id: stop.id, name: stop.name, lat: stop.lat, lng: stop.lng };
}

// A failed line only costs that line: its scene plays silent and a warning is
// added to `warnings`, rather than one Claude error stopping the whole render.
export async function buildMapScenes(
  stops: Stop[],
  tripTitle: string,
  warnings: string[] = []
): Promise<MapScene[]> {
  const scenes: MapScene[] = [];

  // Worked out up front so every scene in a country uses the same map, framed
  // around all the parts of that country this trip visits.
  const stopCountries = new Map<Stop, GeoJSON.Feature>();
  const visitedRegions = new Map<string, Set<number>>();
  for (const stop of stops) {
    const feature = await findCountryForPoint(stop.lat, stop.lng);
    if (!feature) continue;
    stopCountries.set(stop, feature);
    const iso = countryIso(feature);
    if (!visitedRegions.has(iso)) visitedRegions.set(iso, new Set());
    visitedRegions.get(iso)!.add(regionForPoint(feature, stop.lat, stop.lng));
  }

  // Accumulates completed legs for the country currently being visited, so
  // later scenes in the same country can show the whole route travelled so
  // far, not just the leg in progress. Resets whenever the destination's
  // country changes (including leaving and later re-entering one) - at
  // which point a closure recap scene is inserted for the country just left.
  let streak: RouteLeg[] = [];
  let streakCountryIso: string | undefined;
  let streakCountry: CountryAssets | undefined;
  let prevStop: Stop | undefined;

  async function closeStreakIfAny() {
    if (streak.length === 0 || !streakCountry || !prevStop) return;
    // prevStop is always the Stop object matching streak's last leg's `to` -
    // cache the closure line on it so re-rendering the same trip doesn't
    // re-roll a fresh Claude + TTS call (and its failure risk) every time.
    const lastStop = prevStop;
    if (!lastStop.closureNarration) {
      try {
        lastStop.closureNarration = await generateClosingNarration(tripTitle, streakCountry.name);
      } catch (err) {
        warnings.push(`Narration failed for the ${streakCountry.name} closing line - it plays silent.`);
        console.warn(`Closing narration failed for ${streakCountry.name}, continuing without it:`, err);
      }
    }
    scenes.push({
      toStop: streak[streak.length - 1].to,
      country: streakCountry,
      priorLegs: [...streak],
      closure: {
        narration: lastStop.closureNarration ?? "",
        audioPath: lastStop.closureAudioPath,
        audioDurationSec: lastStop.closureAudioDurationSec,
      },
    });
  }

  for (let i = 0; i < stops.length; i++) {
    const toStop = stops[i];

    const countryFeature = stopCountries.get(toStop);
    if (!countryFeature) {
      prevStop = toStop;
      continue; // e.g. a point over open ocean - skip the map scene, keep StopContent
    }

    const country = await ensureCountryAssets(countryFeature, [...visitedRegions.get(countryIso(countryFeature))!]);
    if (country.iso !== streakCountryIso) {
      await closeStreakIfAny();
      streak = [];
      streakCountryIso = country.iso;
    }
    streakCountry = country;

    let currentLeg: RouteLeg | undefined;
    let travel: MapScene["travel"];
    if (prevStop) {
      const routeCoords = await fetchRoute(prevStop, toStop);
      currentLeg = { from: toPoint(prevStop), to: toPoint(toStop), routeCoords };

      // Cache on toStop the same way closure lines are cached on the stop
      // that closes a country visit, so a re-render doesn't re-roll a fresh
      // Claude + TTS call for a leg that's already been voiced. The key ties
      // the line to this exact leg: reordering, adding, removing or renaming
      // stops changes what it should say, so it's rewritten and re-voiced.
      const isFinalLeg = i === stops.length - 1;
      const narrationKey = JSON.stringify([prevStop.name, toStop.name, isFinalLeg]);
      if (!toStop.travelNarration || toStop.travelNarrationKey !== narrationKey) {
        const otherLines = stops
          .filter((s) => s !== toStop && s.travelNarration)
          .map((s) => s.travelNarration as string);
        try {
          toStop.travelNarration = await generateTravelNarration(
            tripTitle,
            prevStop.name,
            toStop.name,
            isFinalLeg,
            otherLines
          );
          toStop.travelNarrationKey = narrationKey;
          toStop.travelAudioPath = undefined;
          toStop.travelAudioDurationSec = undefined;
        } catch (err) {
          warnings.push(`Narration failed for the transition to "${toStop.name}" - it plays silent.`);
          console.warn(`Travel narration failed for transition to ${toStop.name}, continuing without it:`, err);
        }
      }
      // A failed rewrite leaves the old line for the old leg in place, so only
      // use a line that belongs to this leg. The next render tries again.
      if (toStop.travelNarration && toStop.travelNarrationKey === narrationKey) {
        travel = {
          narration: toStop.travelNarration,
          audioPath: toStop.travelAudioPath,
          audioDurationSec: toStop.travelAudioDurationSec,
        };
      }
    }

    scenes.push({
      toStop: toPoint(toStop),
      country,
      currentLeg,
      priorLegs: [...streak],
      travel,
    });

    if (currentLeg) streak.push(currentLeg);
    prevStop = toStop;
  }

  await closeStreakIfAny(); // the trip ended - close out the final country visit too

  return scenes;
}
