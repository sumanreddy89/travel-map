import { ensureCountryAssets, findCountryForPoint, type CountryAssets } from "./geo.js";
import { fetchRoute } from "./routing.js";
import { generateClosingNarration, generateTravelNarration } from "./narration.js";
import type { MapScene, RouteLeg, Stop } from "../types.js";

function toPoint(stop: Stop) {
  return { id: stop.id, name: stop.name, lat: stop.lat, lng: stop.lng };
}

export async function buildMapScenes(stops: Stop[], tripTitle: string): Promise<MapScene[]> {
  const scenes: MapScene[] = [];

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
      lastStop.closureNarration = await generateClosingNarration(tripTitle, streakCountry.name);
    }
    scenes.push({
      toStop: streak[streak.length - 1].to,
      country: streakCountry,
      priorLegs: [...streak],
      closure: {
        narration: lastStop.closureNarration,
        audioPath: lastStop.closureAudioPath,
        audioDurationSec: lastStop.closureAudioDurationSec,
      },
    });
  }

  for (let i = 0; i < stops.length; i++) {
    const toStop = stops[i];

    const countryFeature = await findCountryForPoint(toStop.lat, toStop.lng);
    if (!countryFeature) {
      prevStop = toStop;
      continue; // e.g. a point over open ocean - skip the map scene, keep StopContent
    }

    const country = await ensureCountryAssets(countryFeature);
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
      // Claude + TTS call for a leg that's already been voiced.
      const isFinalLeg = i === stops.length - 1;
      if (!toStop.travelNarration) {
        toStop.travelNarration = await generateTravelNarration(
          tripTitle,
          prevStop.name,
          toStop.name,
          isFinalLeg
        );
      }
      travel = {
        narration: toStop.travelNarration,
        audioPath: toStop.travelAudioPath,
        audioDurationSec: toStop.travelAudioDurationSec,
      };
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
