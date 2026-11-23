# The keyless demo

`npm run demo:render` makes a 39-second film of an illustrative trip, Porto → Salamanca → Madrid. It needs no API keys and no map download. It's the quickest way to see what TravelMap makes.

```bash
npm ci                 # install (needs internet)
npm run demo:prepare   # checks the demo files, downloads Remotion's headless browser once (~95MB, needs internet)
npm run demo:render    # writes out/demo-landscape.mp4 (1920x1080, 30fps, about 40s)
npm run demo:stills    # rewrites docs/demo/poster.jpg, map-frame.jpg and photo-frame.jpg
```

## What it does and doesn't do

- Renders `remotion/src/demo/demoProps.json` straight through Remotion. It doesn't start the API server, write narration, record a voiceover, geocode, fetch routes or map tiles, or convert map data.
- **The network is blocked while it renders.** Node refuses DNS lookups for anything but localhost, and the headless browser only resolves localhost. If anything still tries a request, or the bundled font fails to load, the command fails and deletes what it wrote. Installing packages and the one-time browser download do need internet.
- Uses only checked-in files: 4 photos, 2 terrain textures, the map shapes and routes in `demoProps.json`, and the Oswald font. About 4MB in total. Sources and licences are in [ASSETS.md](ASSETS.md).
- The film is silent. The narration text is in the trip, but nothing is voiced and no music is included.
- Runs on macOS and Linux. Windows isn't supported yet, because the network block uses a shell wrapper around the browser.
- `npm run studio` opens the same trip in Remotion Studio.

## Rebuilding the demo trip (maintainers)

The trip is defined in `server/src/scripts/demo-source/trip.json`. After changing it:

1. Set up the full map data (main README, "Full workflow").
2. `cd server && npx tsx src/scripts/buildDemo.ts` rewrites `demoProps.json` and the terrain textures. It makes two route requests to the public OSRM server.
3. `npm run demo:render`, then pick new still frames in `remotion/scripts/demo.mjs` if the timing changed, and run `npm run demo:stills`.
4. Update [ASSETS.md](ASSETS.md) for any new photo.

`npm test` checks that the demo still references only checked-in files and no web addresses.
