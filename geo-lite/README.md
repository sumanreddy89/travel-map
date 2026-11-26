# The bundled lite map

A small copy of the map data, so `npm run year` and the trip films work on a fresh clone with no download.

- `countries.json`: country borders, simplified to 0.01° (the detail the map draws at anyway).
- `admin1.json`: state and province borders, simplified to 0.02°.
- `relief.jpg`: the shaded relief at half resolution (8100 × 4050).

All from [Natural Earth](https://www.naturalearthdata.com/) 1:10m (public domain). It's built from the full download by `server/src/scripts/buildLiteGeo.ts`. When the full data is in place (README, "Full map data"), TravelMap uses that instead: the terrain is sharper for small countries, and the lite and full caches are kept apart.
