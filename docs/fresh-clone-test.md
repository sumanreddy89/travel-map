# Fresh-clone test: `npm run year`

26 Nov 2026, macOS (Apple silicon), Node 26, following the README's "Your own year" section word for word in an empty folder. Three cities: Lisbon, Madrid (plane), Barcelona (train).

## Timings, after the fixes in this PR

| Step | Time |
|---|---|
| `git clone` from GitHub (33 MB) | 6 s |
| `npm ci`, empty npm cache | 19 s |
| First `npm run year -- my-year.txt` (includes the one-time headless browser download) | 70 s |
| Later runs, 3 cities, 26 s film | 43 s |

Clone to first film: under two minutes. No keys, no `.env`, no map download.

## Snags, in the order hit

1. **Before this PR, the map was a ~600 MB manual download.** The README sent you to a separate section with six `curl`/`unzip` commands and a converter. Fixed: a 10 MB lite map is checked in (`geo-lite/`) and used automatically until the full data is present.
2. **The first lite map crashed the film**: "Couldn't prepare the map: invalid polygon, fewer than 4 points". Simplifying collapsed some tiny islands into slivers. Fixed in `buildLiteGeo.ts` (slivers dropped), with a test that every lite shape is valid.
3. **"No headless browser yet. Run: npm run demo:prepare."** The "Your own year" section never mentioned that step; it was in the demo section above. Fixed: `npm run year` downloads the browser itself the first time (it already goes online for road routes), so the step is gone. The keyless demo keeps `demo:prepare`.
4. **The year section didn't say what you need first.** It now says Node 20 or newer, `npm ci`, and where to save the file.
5. **The README said own films need API keys and the map download.** That's only true of trip films (narration). The README now says plainly: the year film needs no keys and no download; trip films need two keys (Anthropic, ElevenLabs) and ffmpeg.

## Not fixed, worth knowing

- Your own year film has no music. The demo's track is reserved for the demo (`NOTICE.md`), so it isn't added to your films.

- The file path is relative to the repository folder, because npm runs scripts from there. Saving `my-year.txt` somewhere else needs a full path.
- Car and train legs need the public OSRM server while the map is prepared. Offline (or if it times out after 8 s), those legs are drawn as a direct line instead of following the roads.
- Not yet tried on Windows or Linux.
- Lite vs full: at film size the two look the same for Spain and Portugal; the full data is sharper on small countries (Luxembourg, Malta), where the lite relief is upscaled more.
