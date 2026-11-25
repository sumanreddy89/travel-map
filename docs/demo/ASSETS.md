# Demo assets: sources and licences

Everything the keyless demo (`npm run demo:render`) uses is listed here. The demo trip, "Porto to Palma", is illustrative: an invented itinerary, not anyone's real travel.

## Photos (`remotion/public/demo/media/`)

All five come from Wikimedia Commons. Each was resized to at most 1920px wide, re-encoded as JPEG and stripped of all metadata (EXIF, XMP, IPTC). The image content is otherwise unchanged.

| File | Original | Creator | Licence |
|---|---|---|---|
| `porto-douro.jpg` | [Porto - Portugal - 5-2023.jpg](https://commons.wikimedia.org/wiki/File:Porto_-_Portugal_-_5-2023.jpg) | Mussi Katz | CC0 1.0 |
| `porto-ribeira.jpg` | [Portugal, Porto, Cais Da Ribeira (52594421918).jpg](https://commons.wikimedia.org/wiki/File:Portugal,_Porto,_Cais_Da_Ribeira_(52594421918).jpg) | Lark Ascending | Public domain |
| `salamanca-plaza-mayor.jpg` | [Salamanca - Plaza Mayor, nocturno 3.jpg](https://commons.wikimedia.org/wiki/File:Salamanca_-_Plaza_Mayor,_nocturno_3.jpg) | Zarateman | CC0 1.0 |
| `madrid-plaza-mayor.jpg` | [Plaza Mayor, Madrid, low sun.jpg](https://commons.wikimedia.org/wiki/File:Plaza_Mayor,_Madrid,_low_sun.jpg) | Gerda Arendt | CC0 1.0 |
| `palma-cathedral.jpg` | [Palma de Mallorca Catedral La Seu 07.JPG](https://commons.wikimedia.org/wiki/File:Palma_de_Mallorca_Catedral_La_Seu_07.JPG) | Zairon | CC0 1.0 |

Licences were read from each file's Commons metadata on 23 November 2026 (Palma: 25 November 2026). Neither CC0 nor public domain requires credit; it's given here anyway.

## Map data (`remotion/src/demo/demoProps.json`, `remotion/public/demo/terrain/`)

- **Country and province outlines, terrain textures:** [Natural Earth](https://www.naturalearthdata.com/) (1:10m admin-0 countries, admin-1 states/provinces, and the "Natural Earth I with Shaded Relief" raster). Public domain. Outlines are simplified, and textures are crops of Portugal and Spain, built by `server/src/scripts/buildDemo.ts`.
- **Road routes for the two road legs** (car and train; the flight to Palma is drawn as an arc): computed once with the public [OSRM](https://project-osrm.org/) demo server from OpenStreetMap data, then simplified and stored in `demoProps.json`. Route data © OpenStreetMap contributors, available under the [Open Database License](https://www.openstreetmap.org/copyright).

## Font (`remotion/public/fonts/`)

- **Oswald** (variable, weights 200-700), © 2016 The Oswald Project Authors, [SIL Open Font License 1.1](../../remotion/public/fonts/Oswald-OFL.txt). Copied unmodified from [google/fonts](https://github.com/google/fonts/tree/main/ofl/oswald).

## Music (`remotion/public/demo/music/`)

- **"The Winding Path — Travel"** (60 s, looped quietly under both demos, fading in and out). © Suman Reddy, made with ElevenMusic (ElevenLabs). Included with the owner's permission for the demo only: not covered by the MIT licence, and not licensed for reuse outside this repository. See [`NOTICE.md`](../../NOTICE.md).

## Not included

- **Voiceover:** none. The narration text is in the trip, but the demo makes no text-to-speech requests.
