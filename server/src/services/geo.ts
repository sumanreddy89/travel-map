import fs from "node:fs/promises";
import path from "node:path";
import * as turf from "@turf/turf";
import sharp from "sharp";
import { REMOTION_PUBLIC_DIR, REPO_ROOT } from "../config.js";

const GEO_DIR = path.join(REMOTION_PUBLIC_DIR, "geo");
const COUNTRIES_FILE = path.join(GEO_DIR, "countries.json");
const ADMIN1_FILE = path.join(GEO_DIR, "admin1.json");
const RELIEF_TIF = path.join(REPO_ROOT, "data", "geo-raw", "relief_hr", "NE1_LR_LC_SR_W.tif");
const RELIEF_W = 16200;
const RELIEF_H = 8100;
const MIN_TEXTURE_PX = 1400; // upsample small-country crops so the texture isn't blocky at video scale

// Same linear equirectangular mapping used both for the raster crop and,
// independently, by the browser-side d3-geo projection in the Remotion scene -
// keeping both in the same projection is what makes the texture line up with
// the vector outline with zero warping.
const toPx = (lng: number) => Math.round(((lng + 180) / 360) * RELIEF_W);
const toPy = (lat: number) => Math.round(((90 - lat) / 180) * RELIEF_H);

type FC = GeoJSON.FeatureCollection;

let countriesPromise: Promise<FC> | undefined;
let admin1Promise: Promise<FC> | undefined;

async function loadCountries(): Promise<FC> {
  if (!countriesPromise) {
    countriesPromise = fs.readFile(COUNTRIES_FILE, "utf-8").then((raw) => JSON.parse(raw));
  }
  return countriesPromise;
}

async function loadAdmin1(): Promise<FC> {
  if (!admin1Promise) {
    admin1Promise = fs.readFile(ADMIN1_FILE, "utf-8").then((raw) => JSON.parse(raw));
  }
  return admin1Promise;
}

export async function findCountryForPoint(
  lat: number,
  lng: number
): Promise<GeoJSON.Feature | undefined> {
  const fc = await loadCountries();
  const pt = turf.point([lng, lat]);
  for (const feature of fc.features) {
    try {
      if (feature.geometry && turf.booleanPointInPolygon(pt, feature as any)) {
        return feature;
      }
    } catch {
      // malformed geometry, skip
    }
  }
  return undefined;
}

// Countries can include land on the far side of the world (France's Réunion,
// Norway's Bouvet Island), and framing a map around all of it shrinks the part
// actually visited to a speck. So polygons are grouped into regions, and a trip
// only uses the regions it has stops in. Groups are joined within this gap so
// archipelagos like Japan stay whole. Longitude deliberately doesn't wrap at
// 180, which keeps Chukotka, Fiji's Lau Islands etc. out of the main region.
const REGION_GAP_DEG = 3;

function countryPolygons(feature: GeoJSON.Feature): GeoJSON.Position[][][] {
  if (feature.geometry.type === "Polygon") return [feature.geometry.coordinates];
  if (feature.geometry.type === "MultiPolygon") return feature.geometry.coordinates;
  return [];
}

const regionCache = new WeakMap<GeoJSON.Feature, number[]>();

// The region id of each polygon in the feature, in polygon order.
function polygonRegions(feature: GeoJSON.Feature): number[] {
  const cached = regionCache.get(feature);
  if (cached) return cached;

  const boxes = countryPolygons(feature).map((polygon) => turf.bbox(turf.lineString(polygon[0])));
  const parent = boxes.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  for (let a = 0; a < boxes.length; a++) {
    for (let b = a + 1; b < boxes.length; b++) {
      const lngGap = Math.max(boxes[a][0], boxes[b][0]) - Math.min(boxes[a][2], boxes[b][2]);
      const latGap = Math.max(boxes[a][1], boxes[b][1]) - Math.min(boxes[a][3], boxes[b][3]);
      if (lngGap <= REGION_GAP_DEG && latGap <= REGION_GAP_DEG) parent[find(a)] = find(b);
    }
  }
  const regions = boxes.map((_, i) => find(i));
  regionCache.set(feature, regions);
  return regions;
}

export function countryIso(feature: GeoJSON.Feature): string {
  return String((feature.properties as any)?.iso_a3 ?? "XXX");
}

export function regionForPoint(feature: GeoJSON.Feature, lat: number, lng: number): number {
  const regions = polygonRegions(feature);
  const index = countryPolygons(feature).findIndex((polygon) =>
    turf.booleanPointInPolygon(turf.point([lng, lat]), turf.polygon(polygon))
  );
  return regions[Math.max(index, 0)];
}

export type CountryAssets = {
  iso: string;
  name: string;
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat] - tight country bounds
  imageBbox: [number, number, number, number]; // padded bounds actually covered by terrainRelPath
  terrainRelPath: string; // relative to remotion public dir -> staticFile()
  countryGeometry: GeoJSON.Geometry;
  admin1: GeoJSON.Feature[];
};

function paddedBbox(bbox: [number, number, number, number]): [number, number, number, number] {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const padX = (maxLng - minLng) * 0.08 || 0.5;
  const padY = (maxLat - minLat) * 0.08 || 0.5;
  return [
    Math.max(-180, minLng - padX),
    Math.max(-90, minLat - padY),
    Math.min(180, maxLng + padX),
    Math.min(90, maxLat + padY),
  ];
}

const assetCache = new Map<string, Promise<CountryAssets>>();

// `regionIds` are the regions the trip has stops in, from regionForPoint.
export function ensureCountryAssets(feature: GeoJSON.Feature, regionIds: number[]): Promise<CountryAssets> {
  const iso = countryIso(feature);
  const regions = polygonRegions(feature);
  const wanted = new Set(regionIds);
  const isWholeCountry = new Set(regions).size === wanted.size;
  // The whole-country key matches the file names of existing cached assets.
  const assetKey = isWholeCountry ? iso : `${iso}-${[...wanted].sort((a, b) => a - b).join("_")}`;
  if (!assetCache.has(assetKey)) {
    const scoped: GeoJSON.Feature = isWholeCountry
      ? feature
      : {
          ...feature,
          geometry: {
            type: "MultiPolygon",
            coordinates: countryPolygons(feature).filter((_, i) => wanted.has(regions[i])),
          },
        };
    assetCache.set(assetKey, buildCountryAssets(iso, assetKey, scoped, isWholeCountry));
  }
  return assetCache.get(assetKey)!;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function bboxesOverlap(a: number[], b: number[]): boolean {
  return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
}

async function buildCountryAssets(
  iso: string,
  assetKey: string,
  feature: GeoJSON.Feature,
  isWholeCountry: boolean
): Promise<CountryAssets> {
  const geoDir = path.join(GEO_DIR, "countries");
  const terrainDir = path.join(REMOTION_PUBLIC_DIR, "terrain");
  await fs.mkdir(geoDir, { recursive: true });
  await fs.mkdir(terrainDir, { recursive: true });

  const geoFile = path.join(geoDir, `${assetKey}.json`);
  const terrainFile = path.join(terrainDir, `${assetKey}.png`);
  const bbox = turf.bbox(feature) as [number, number, number, number];
  const name = String((feature.properties as any)?.name ?? iso);

  let cached: { country: GeoJSON.Feature; admin1: GeoJSON.Feature[] };
  if (await exists(geoFile)) {
    cached = JSON.parse(await fs.readFile(geoFile, "utf-8"));
  } else {
    const admin1All = await loadAdmin1();
    const admin1 = admin1All.features.filter(
      (f) => (f.properties as any)?.adm0_a3 === iso && (isWholeCountry || bboxesOverlap(turf.bbox(f), bbox))
    );
    const simplified = turf.simplify(feature as any, { tolerance: 0.01, highQuality: true });
    const simplifiedAdmin1 = admin1.map((f) => turf.simplify(f as any, { tolerance: 0.01, highQuality: true }));
    cached = { country: simplified as GeoJSON.Feature, admin1: simplifiedAdmin1 as GeoJSON.Feature[] };
    await fs.writeFile(geoFile, JSON.stringify({ ...cached, bbox, name, iso }));
  }

  if (!(await exists(terrainFile))) {
    await buildTerrainPng(feature, bbox, terrainFile);
  }

  return {
    iso,
    name,
    bbox,
    imageBbox: paddedBbox(bbox),
    terrainRelPath: `terrain/${assetKey}.png`,
    countryGeometry: cached.country.geometry,
    admin1: cached.admin1,
  };
}

function geometryToSvgPath(
  geometry: GeoJSON.Geometry,
  project: (pt: [number, number]) => [number, number]
): string {
  const ringToPath = (ring: number[][]) =>
    ring
      .map(([lng, lat], i) => {
        const [x, y] = project([lng, lat]);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ") + " Z";

  if (geometry.type === "Polygon") {
    return geometry.coordinates.map(ringToPath).join(" ");
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.map((poly) => poly.map(ringToPath).join(" ")).join(" ");
  }
  return "";
}

async function buildTerrainPng(
  feature: GeoJSON.Feature,
  bbox: [number, number, number, number],
  outFile: string
): Promise<void> {
  const [pMinLng, pMinLat, pMaxLng, pMaxLat] = paddedBbox(bbox);

  const left = toPx(pMinLng);
  const right = toPx(pMaxLng);
  const top = toPy(pMaxLat);
  const bottom = toPy(pMinLat);
  const width = Math.max(2, right - left);
  const height = Math.max(2, bottom - top);

  // Upsample small/medium countries so the relief texture isn't blocky once
  // it's displayed at video scale - the raw raster is only ~45px/degree,
  // which is a handful of pixels across for a small country like Cyprus.
  const upscale = Math.max(1, MIN_TEXTURE_PX / Math.max(width, height));
  const outWidth = Math.round(width * upscale);
  const outHeight = Math.round(height * upscale);

  let resizedPipeline = sharp(RELIEF_TIF)
    .extract({ left, top, width, height })
    .resize(outWidth, outHeight, { kernel: "lanczos3" });
  if (upscale > 3) resizedPipeline = resizedPipeline.blur(1.2);
  const cropBuf = await resizedPipeline.toBuffer();

  const project = ([lng, lat]: [number, number]): [number, number] => [
    ((toPx(lng) - left) / width) * outWidth,
    ((toPy(lat) - top) / height) * outHeight,
  ];
  const svgPath = geometryToSvgPath(feature.geometry, project);
  const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${outWidth}" height="${outHeight}"><path d="${svgPath}" fill="#fff"/></svg>`;

  const tintSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${outWidth}" height="${outHeight}"><rect width="100%" height="100%" fill="rgb(206,88,24)"/></svg>`;

  const tinted = await sharp(cropBuf)
    .composite([{ input: Buffer.from(tintSvg), blend: "multiply" }])
    .toBuffer();

  await sharp(tinted)
    .composite([{ input: Buffer.from(maskSvg), blend: "dest-in" }])
    .png()
    .toFile(outFile);
}
