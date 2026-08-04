import fs from "node:fs/promises";
import path from "node:path";
import { REMOTION_DIR } from "../config.js";
import { buildMapScenes } from "../services/mapScenes.js";
import type { Trip } from "../types.js";

const trip: Trip = {
  id: "sample",
  title: "Cyprus Test Trip",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  stops: [
    {
      id: "s1",
      name: "Agía Napa",
      lat: 34.9885,
      lng: 34.0,
      date: "Day 1",
      notes: "A buzzing seaside resort town on the eastern tip of Cyprus.",
      media: [],
    },
    {
      id: "s2",
      name: "Limassol",
      lat: 34.6786,
      lng: 33.0413,
      date: "Day 2",
      notes: "Cyprus's second city, a busy port with a long seafront promenade.",
      media: [],
    },
  ],
};

const mapScenes = await buildMapScenes(trip.stops, trip.title);

const outFile = path.join(REMOTION_DIR, "src", "sampleProps.json");
await fs.writeFile(outFile, JSON.stringify({ trip, mapScenes }, null, 2));
console.log(`wrote ${outFile}`);
