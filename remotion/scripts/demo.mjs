// The keyless demo: npm run demo:prepare | demo:render | demo:stills (see docs/demo/README.md).
//
// Renders remotion/src/demo/demoProps.json straight through Remotion. No API server, no paid keys,
// no map-data download, no geocoding, routing or tile requests: routes, map shapes, terrain,
// photos and the font are all checked in. While rendering, every outside network request is
// blocked (DNS in Node; host resolution in the headless browser) and the render fails if anything
// tries one. Installing packages and the one-time browser download in demo:prepare do need internet.
import dns from "node:dns";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REMOTION = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(REMOTION, "..");
const OUT = path.join(ROOT, "out");
const DOCS = path.join(ROOT, "docs", "demo");
const PROPS = path.join(REMOTION, "src", "demo", "demoProps.json");
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

// Frames for the README stills, picked from the rendered demo (30fps). Re-pick them if the demo
// trip or its timing changes: open the MP4 and note the frame numbers.
const STILLS = [
  { file: "poster.jpg", frame: 1110, label: "poster: the whole route, Porto to Madrid" },
  { file: "map-frame.jpg", frame: 560, label: "map: the route drawing into Salamanca" },
  { file: "photo-frame.jpg", frame: 330, label: "photo: Porto" },
];

const fail = (msg) => {
  console.error(`\n${msg}`);
  process.exit(1);
};

function checkDemoFiles() {
  const props = JSON.parse(fs.readFileSync(PROPS, "utf-8"));
  const needed = [path.join(REMOTION, "public", "fonts", "Oswald-Variable.ttf")];
  for (const stop of props.trip.stops) for (const m of stop.media) needed.push(path.join(REMOTION, "public", "demo", m.path));
  for (const scene of props.mapScenes) needed.push(path.join(REMOTION, "public", scene.country.terrainRelPath));
  const missing = [...new Set(needed)].filter((f) => !fs.existsSync(f));
  if (missing.length) fail(`Demo files are missing:\n  ${missing.map((f) => path.relative(ROOT, f)).join("\n  ")}\nRe-clone the repository or restore them from git.`);
  return props;
}

async function browserPath(download) {
  const { ensureBrowser } = await import("@remotion/renderer");
  let shown = false;
  const status = await ensureBrowser({
    onBrowserDownload: () => {
      if (!download) fail("No headless browser yet. Run: npm run demo:prepare");
      console.log("Downloading the headless browser Remotion renders with (one time, needs internet)...");
      shown = true;
      let lastPct = -1;
      return {
        version: null,
        onProgress: ({ percent }) => {
          const pct = Math.floor(percent * 10) * 10;
          if (pct !== lastPct) process.stdout.write(`\r  ${pct}%   `);
          lastPct = pct;
        },
      };
    },
  });
  if (shown) process.stdout.write("\n");
  if (!("path" in status)) fail(`Couldn't find or download the headless browser (${status.type}). Run: npm run demo:prepare`);
  return status.path;
}

// Everything below runs with outside network refused. Rendering only talks to its own local server.
function blockNetwork(attempts) {
  const original = dns.lookup;
  dns.lookup = function (hostname, options, callback) {
    // IP literals (e.g. the 0.0.0.0 port check) resolve locally; only names would go to DNS.
    if (LOCAL_HOSTS.has(hostname) || net.isIP(hostname)) return original.call(this, hostname, options, callback);
    attempts.push(`Node tried to reach ${hostname}`);
    const cb = typeof options === "function" ? options : callback;
    const err = Object.assign(new Error(`demo: network blocked (${hostname})`), { code: "ENOTFOUND" });
    process.nextTick(() => cb(err));
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    if (!LOCAL_HOSTS.has(url.hostname) && !["127.0.0.1", "[::1]"].includes(url.hostname)) {
      attempts.push(`Node tried to fetch ${url.origin}`);
      return Promise.reject(new Error(`demo: network blocked (${url.origin})`));
    }
    return originalFetch(input, init);
  };
}

// The headless browser, launched so that only localhost resolves.
function offlineBrowser(realPath) {
  if (process.platform === "win32") fail("demo:render and demo:stills run on macOS and Linux for now.");
  fs.mkdirSync(OUT, { recursive: true });
  const wrapper = path.join(OUT, ".offline-browser.sh");
  fs.writeFileSync(
    wrapper,
    `#!/bin/sh\nexec "${realPath}" --host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1" "$@"\n`,
    { mode: 0o755 }
  );
  return wrapper;
}

function browserLog(attempts) {
  return (log) => {
    const text = `${log.text ?? ""}`;
    if (/ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|net::ERR_/.test(text)) attempts.push(`Browser: ${text.slice(0, 200)}`);
    // A frame drawn in a fallback font would look wrong, so a font that never loads fails the demo.
    if (text.includes("Couldn't load the bundled Oswald font")) attempts.push("Browser: the bundled font failed to load");
  };
}

async function setup() {
  const props = checkDemoFiles();
  const real = await browserPath(false);
  const attempts = [];
  blockNetwork(attempts);
  const { bundle } = await import("@remotion/bundler");
  const { selectComposition } = await import("@remotion/renderer");
  console.log("Bundling the video project...");
  const serveUrl = await bundle({ entryPoint: path.join(REMOTION, "src", "index.ts") });
  const browserExecutable = offlineBrowser(real);
  const composition = await selectComposition({ serveUrl, id: "TripVideo", inputProps: props, browserExecutable, onBrowserLog: browserLog(attempts) });
  return { props, attempts, serveUrl, browserExecutable, composition };
}

function stopIfAnythingWentOut(attempts, files) {
  if (!attempts.length) return;
  for (const f of files) fs.rmSync(f, { force: true });
  fail(`The demo render went wrong (network use or a missing font):\n  ${[...new Set(attempts)].join("\n  ")}`);
}

async function prepare() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 20) fail(`Node.js 20 or newer is needed (you have ${process.versions.node}).`);
  checkDemoFiles();
  const p = await browserPath(true);
  console.log(`Ready. Demo files are present and the headless browser is at:\n  ${p}\nNow run: npm run demo:render`);
}

async function render() {
  const { attempts, serveUrl, browserExecutable, composition } = await setup();
  const { renderMedia } = await import("@remotion/renderer");
  const out = path.join(OUT, "demo-landscape.mp4");
  console.log(`Rendering ${composition.durationInFrames} frames (${(composition.durationInFrames / composition.fps).toFixed(1)}s) with the network blocked...`);
  let last = -1;
  await renderMedia({
    composition, serveUrl, codec: "h264", outputLocation: out, inputProps: composition.props, browserExecutable,
    onBrowserLog: browserLog(attempts),
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 20) * 5;
      if (pct !== last) process.stdout.write(`\r  ${pct}%   `);
      last = pct;
    },
  });
  process.stdout.write("\n");
  stopIfAnythingWentOut(attempts, [out]);
  console.log(`Done: ${path.relative(ROOT, out)} (no network requests were made)`);
}

async function stills() {
  const { attempts, serveUrl, browserExecutable, composition } = await setup();
  const { renderStill } = await import("@remotion/renderer");
  fs.mkdirSync(DOCS, { recursive: true });
  const written = [];
  for (const s of STILLS) {
    const output = path.join(DOCS, s.file);
    await renderStill({
      composition, serveUrl, frame: s.frame, output, inputProps: composition.props, browserExecutable,
      imageFormat: "jpeg", jpegQuality: 82, scale: 2 / 3, onBrowserLog: browserLog(attempts),
    });
    written.push(output);
    console.log(`  ${path.relative(ROOT, output)}  (frame ${s.frame}, ${s.label})`);
  }
  stopIfAnythingWentOut(attempts, written);
  console.log("Done (no network requests were made).");
}

const commands = { prepare, render, stills };
const cmd = process.argv[2];
if (!commands[cmd]) fail(`Usage: node remotion/scripts/demo.mjs ${Object.keys(commands).join("|")}`);
commands[cmd]().catch((err) => fail(`demo:${cmd} failed: ${err?.message ?? err}`));
