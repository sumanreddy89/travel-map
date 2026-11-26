# TravelMap

**Paste your cities, get your year film.** An animated map flies your year, city by city, by plane, train or car. It opens by counting up your countries, cities, kilometres and flights, and ends on a card you can share. Open source, no API keys.

[![A year in travel: Lisbon to Prague on the amber terrain map](docs/demo/year-finale.jpg)](https://github.com/sumanreddy89/travel-map/releases/download/demo-film-v5/demo-year-landscape.mp4)

*Sample year: Lisbon → Madrid → Barcelona → Paris → Amsterdam → Berlin → Prague (48s, with music). [Landscape](https://github.com/sumanreddy89/travel-map/releases/download/demo-film-v5/demo-year-landscape.mp4) · [portrait, for phones](https://github.com/sumanreddy89/travel-map/releases/download/demo-film-v5/demo-year-portrait.mp4) · [16-second vertical clip](https://github.com/sumanreddy89/travel-map/releases/download/demo-film-v5/demo-year-reels.mp4)*

| It counts your year up | Then flies it | And ends on a card to share |
|---|---|---|
| ![The opener: 6 countries, 7 cities, 3,125 km, 2 flights](docs/demo/year-opener.jpg) | ![The whole year on one map](docs/demo/year-finale.jpg) | <img src="docs/demo/year-share-portrait.jpg" alt="The share card in portrait" width="140"> |

### Your own year: no keys, no map download

You need [Node.js](https://nodejs.org/) 20 or newer. Write one city per line in a text file, in the order you went: `city | date | how you got there` (plane, train or car; plane if left out). Add a country when a name is ambiguous (`Valencia, ES`).

```text
Lisbon | 2026-02-14
Madrid | 2026-03-20 | plane
Barcelona | 2026-04-02 | train
```

Save it as `my-year.txt` in the repository folder, then:

```bash
npm ci
npm run year -- my-year.txt                          # out/year-2026-landscape.mp4
npm run year -- my-year.txt --orientation portrait   # out/year-2026-portrait.mp4, for phones
npm run year -- my-year.txt --preview                # watch and scrub it in your browser first, no render
```

On a fresh clone that took under two minutes on a laptop: about 20 s to install, then 70 s for the first film, which includes a one-time download of the headless browser it renders with. Later films take about 45 s for three cities.

- **No API keys.** The year film has no narration, so nothing paid is called.
- **No map download.** A small map is bundled ([geo-lite](geo-lite/README.md)). The optional [full map data](#full-map-data-optional-600mb) only makes the terrain sharper for small countries.
- **What goes online:** installing packages, the browser download, and road routes for car and train legs from the public OSRM server. The film itself renders with the network blocked.
- **Cities** come from a bundled list of about 1,250 major cities, English names included ([Natural Earth](https://www.naturalearthdata.com/), public domain), so nothing is looked up online. A line it can't read is reported with its line number and what to change.

There's also an API: `POST /api/trips/year` with `{"text": "..."}`. To render the sample year without writing a file: `node remotion/scripts/demo.mjs render --trip year` after `npm run demo:prepare`.

**Don't want to set anything up?** A hosted version is being considered. [Join the waitlist](https://sumanreddy89.github.io/travel-map/hosted/) if you'd use it.

## Trip films: your photos at every stop

For a single trip, TravelMap cuts from the map to your own photos and videos at each stop, with AI-written narration.

[![Porto to Palma: the whole route on the amber terrain map](docs/demo/poster.jpg)](https://github.com/sumanreddy89/travel-map/releases/download/demo-film-v5/demo-landscape.mp4)

*The trip demo, "Porto to Palma" (58s, narrated, with music): by car, train and plane. [Landscape](https://github.com/sumanreddy89/travel-map/releases/download/demo-film-v5/demo-landscape.mp4) · [portrait](https://github.com/sumanreddy89/travel-map/releases/download/demo-film-v5/demo-portrait.mp4). Render it yourself, keyless: `npm run demo:render` (add `-- --orientation portrait` for phones).*

| The route draws itself | Then your photos at each stop | Portrait, for phones |
|---|---|---|
| ![The plane leaving Madrid for Palma](docs/demo/map-frame.jpg) | ![Porto, with its caption](docs/demo/photo-frame.jpg) | <img src="docs/demo/portrait-photo-frame.jpg" alt="The Porto stop in portrait" width="140"> |

Photo, map and music sources: [docs/demo/ASSETS.md](docs/demo/ASSETS.md). More: [docs/demo/README.md](docs/demo/README.md).

## Full workflow: your own trips

Trip films are different from the year film: they write and speak a narration line for every stop, so they need two API keys (Anthropic for the words, ElevenLabs for the voice) and ffmpeg for your photos and videos. The map works out of the box, like the year film. What leaves your machine is listed under [What stays on your machine](#what-stays-on-your-machine).

### Setup

You need Node.js 20 or newer and ffmpeg (which includes `ffprobe`; macOS: `brew install ffmpeg`, Ubuntu: `sudo apt install ffmpeg`).

```bash
npm install
```

Copy `server/.env.example` to `server/.env` and fill in your own keys:

```bash
cp server/.env.example server/.env
```

```
ANTHROPIC_API_KEY=...     # console.anthropic.com - narration + closing lines
ELEVENLABS_API_KEY=...    # elevenlabs.io - voiceover TTS
ELEVENLABS_VOICE_ID=...   # must be a voice available to your ElevenLabs plan/account
PORT=4000
```

### Full map data (optional, ~600MB)

Every film works with the bundled lite map. For sharper terrain on small countries, fetch the full Natural Earth boundary and shaded-relief data once (it's gitignored) and convert it:

```bash
mkdir -p data/geo-raw && cd data/geo-raw
curl -sS -o countries.zip https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip
unzip -q countries.zip -d countries
curl -sS -o admin1.zip https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip
unzip -q admin1.zip -d admin1
curl -sS -o relief.zip https://naciscdn.org/naturalearth/10m/raster/NE1_LR_LC_SR_W.zip
unzip -q relief.zip -d relief_hr
cd ../../server && npx tsx src/scripts/convertGeo.ts
```

That last command writes `remotion/public/geo/countries.json` and `admin1.json`. TravelMap switches to the full data as soon as all of it is in place.

### Check your setup

```bash
npm run doctor
```

It checks Node, ffmpeg and ffprobe, your keys in `server/.env` (without printing them) and which map data you're using, and says how to fix anything missing. It doesn't call any paid service.
Per-country terrain textures (`remotion/public/terrain/*.png`) generate and
cache automatically the first time a trip visits that country.

## Run

```bash
npm run dev:server   # API on http://localhost:4000
npm run dev:web      # UI on http://localhost:5173
```

Open http://localhost:5173, create a trip, add stops (search or click the
map), upload photos/videos per stop, then click "Generate video".

## Preview map/scene work in isolation

```bash
npm run studio   # opens Remotion Studio with the demo trip (remotion/src/demo/demoProps.json)
```

## Notes

- Videos carry a small "TravelMap · github.com/sumanreddy89/travel-map" credit
  by default; untick "Show TravelMap credit" next to the format choice to drop
  it. Map scenes with a road route also show "Route data © OpenStreetMap
  contributors", which the routing data's licence requires.
- Background music is not auto-downloaded (copyright); drop an mp3/wav/m4a
  into `remotion/public/music/` and it's picked up automatically by every
  render at low volume - no per-trip wiring needed.
- The photo/video panel shown beside the map during transitions can be
  toggled off via `SHOW_MEDIA_PANEL_IN_MAP_SCENES` in `remotion/src/config.ts`.
- `data/` holds all trip content (uploads, generated audio, output videos),
  `data/geo-raw/` the optional full Natural Earth files, and `server/.env` your
  API keys - all gitignored.

## Contributing

Bug reports and small pull requests are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md).

## What stays on your machine

Your photos, videos, generated audio and finished videos stay local; the
server only listens on 127.0.0.1. Some trip details do go to outside services
to build the video:

| Service | What it receives |
|---|---|
| Anthropic | Trip title, stop names and your notes, to write the narration |
| ElevenLabs | The narration text, to read it aloud |
| OpenStreetMap Nominatim | Place names you search for |
| OSRM (project-osrm.org) | Stop coordinates, to draw the route |
| OpenFreeMap | Map tile requests for the area you're viewing |

## Tests

```bash
npm test
```

## Licence

Code: [MIT](LICENSE). The music once tracked in this repo is not covered and
stays all rights reserved; demo assets keep their own licences. See
[NOTICE.md](NOTICE.md) and [docs/demo/ASSETS.md](docs/demo/ASSETS.md).
