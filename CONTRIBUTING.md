# Contributing to TravelMap

Thanks for looking. TravelMap is a small project run by one person, so short, focused pull requests are easiest to say yes to.

## Before you start

- **Bugs:** open an issue with the "Bug" template. If it's about your year file, paste the lines that fail (change the cities if you like; the line numbers are what matter).
- **Ideas:** open an issue first, before writing code. A few things are deliberately not planned yet: GPX import, user accounts and payments.
- **Map look and motion** live in `remotion/src/lib/motion.ts` (timing) and `remotion/src/scenes/`. Before and after stills help a lot in the pull request.

## Set up

You need Node.js 20 or newer. No keys are needed for anything below.

```bash
npm ci
npm test                                           # server and Remotion tests
npm run year -- my-year.txt --preview              # your change in the browser, no render
npm run demo:prepare && npm run demo:render        # the keyless trip demo, network blocked
```

Trip films with narration need the two API keys in `server/.env` (see the README); you don't need them to work on the map, the year film or the demo.

## What CI checks

Every pull request runs the type-check (server, web, Remotion), the Remotion lint and `npm test` (`.github/workflows/check.yml`). Run `npm test` before you push.

## House rules

- **A bug fix comes with a test** that fails without the fix.
- **Keep it keyless and offline where it is now.** The year film and the demo must render with no API keys and the network blocked; `demo.mjs` blocks the network while it renders.
- **Assets:** only add photos, music or data you can show the licence for, and list it in `docs/demo/ASSETS.md`. The demo music is reserved (`NOTICE.md`); don't reuse it.
- **Docs:** if a command or setup step changes, change the README in the same pull request.

Code is MIT (`LICENSE`). By contributing you agree your contribution is under the same licence.
