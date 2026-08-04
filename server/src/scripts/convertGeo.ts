import fs from "node:fs/promises";
import path from "node:path";
import * as shapefile from "shapefile";
import { REPO_ROOT, REMOTION_PUBLIC_DIR } from "../config.js";

const RAW_DIR = path.join(REPO_ROOT, "data", "geo-raw");
const OUT_DIR = path.join(REMOTION_PUBLIC_DIR, "geo");

const NUL = String.fromCharCode(0);

function clean(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value.split(NUL).join("").trim();
}

async function readShapefile(shpPath: string, dbfPath: string) {
  const source = await shapefile.open(shpPath, dbfPath);
  const features: GeoJSON.Feature[] = [];
  let result = await source.read();
  while (!result.done) {
    features.push(result.value as GeoJSON.Feature);
    result = await source.read();
  }
  return features;
}

async function convertCountries() {
  const dir = path.join(RAW_DIR, "countries");
  const features = await readShapefile(
    path.join(dir, "ne_10m_admin_0_countries.shp"),
    path.join(dir, "ne_10m_admin_0_countries.dbf")
  );
  console.log(`countries: ${features.length} features`);

  const trimmed = features.map((f) => ({
    type: "Feature" as const,
    properties: {
      name: clean(f.properties?.NAME ?? f.properties?.NAME_EN),
      iso_a2: clean(f.properties?.ISO_A2),
      iso_a3: clean(f.properties?.ADM0_A3 ?? f.properties?.ISO_A3),
      continent: clean(f.properties?.CONTINENT),
    },
    geometry: f.geometry,
  }));

  const fc = { type: "FeatureCollection" as const, features: trimmed };
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUT_DIR, "countries.json"), JSON.stringify(fc));
  console.log(`wrote countries.json (${trimmed.length} features)`);
}

async function convertAdmin1() {
  const dir = path.join(RAW_DIR, "admin1");
  const features = await readShapefile(
    path.join(dir, "ne_10m_admin_1_states_provinces.shp"),
    path.join(dir, "ne_10m_admin_1_states_provinces.dbf")
  );
  console.log(`admin1: ${features.length} features`);

  const trimmed = features.map((f) => ({
    type: "Feature" as const,
    properties: {
      name: clean(f.properties?.name),
      admin: clean(f.properties?.admin),
      adm0_a3: clean(f.properties?.adm0_a3),
      iso_3166_2: clean(f.properties?.iso_3166_2),
    },
    geometry: f.geometry,
  }));

  const fc = { type: "FeatureCollection" as const, features: trimmed };
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUT_DIR, "admin1.json"), JSON.stringify(fc));
  console.log(`wrote admin1.json (${trimmed.length} features)`);
}

await convertCountries();
await convertAdmin1();
