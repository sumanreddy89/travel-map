import { findCountryForPoint, ensureCountryAssets } from "../services/geo.js";

const lat = 46.0569;
const lng = 14.5058; // Ljubljana

const feature = await findCountryForPoint(lat, lng);
console.log("matched feature properties:", feature?.properties);
console.log("geometry type:", feature?.geometry?.type);

if (feature) {
  const assets = await ensureCountryAssets(feature);
  console.log("iso:", assets.iso, "name:", assets.name);
  console.log("bbox:", assets.bbox);
  console.log("imageBbox:", assets.imageBbox);
}
