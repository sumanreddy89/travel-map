// npm run doctor: checks everything TravelMap needs before you create a trip, and says how
// to fix what's missing. It never prints your keys and never calls a paid API.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type Check = { name: string; ok: boolean; required: boolean; fix?: string; detail?: string };

const MIN_NODE = 20;

export function nodeCheck(version: string): Check {
  const major = Number(version.replace(/^v/, "").split(".")[0]);
  return {
    name: `Node.js ${MIN_NODE} or newer`,
    ok: major >= MIN_NODE,
    required: true,
    detail: version,
    fix: `Install Node ${MIN_NODE}+ from nodejs.org (you have ${version}).`,
  };
}

export function toolCheck(tool: string, found: boolean): Check {
  return {
    name: `${tool} on your PATH`,
    ok: found,
    required: true,
    fix: `Install ffmpeg, which includes ${tool} (macOS: brew install ffmpeg; Ubuntu: sudo apt install ffmpeg).`,
  };
}

/** Reads KEY=value lines; values are only checked for being non-empty, never printed. */
export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#")) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

export function envChecks(envText: string | null): Check[] {
  if (envText === null) {
    return [{ name: "server/.env exists", ok: false, required: true, fix: "cp server/.env.example server/.env, then add your keys." }];
  }
  const env = parseEnv(envText);
  const key = (name: string, what: string): Check => ({
    name: `${name} is set`,
    ok: Boolean(env[name]),
    required: true,
    fix: `Add ${name} to server/.env (${what}).`,
  });
  return [
    { name: "server/.env exists", ok: true, required: true },
    key("ANTHROPIC_API_KEY", "console.anthropic.com; writes the narration"),
    key("ELEVENLABS_API_KEY", "elevenlabs.io; reads the narration aloud"),
    key("ELEVENLABS_VOICE_ID", "a voice your ElevenLabs plan can use"),
  ];
}

export function geoChecks(root: string, exists: (p: string) => boolean): Check[] {
  const converted = ["countries.json", "admin1.json"].every((f) => exists(path.join(root, "remotion/public/geo", f)));
  const relief = exists(path.join(root, "data/geo-raw/relief_hr/NE1_LR_LC_SR_W.tif"));
  const raw = exists(path.join(root, "data/geo-raw"));
  const lite = exists(path.join(root, "geo-lite/countries.json"));
  return [
    {
      name: "Map data (the bundled lite map works; the full download is sharper)",
      ok: converted && relief,
      // The bundled map is enough to make every film, so the full download is optional.
      required: !lite,
      detail: converted && relief ? "full" : "lite",
      fix: !lite
        ? "geo-lite/ is missing from your checkout; restore it with git checkout -- geo-lite"
        : raw && !converted
          ? "Using the bundled lite map. Raw data is in data/geo-raw; convert it for the full map: cd server && npx tsx src/scripts/convertGeo.ts"
          : "Using the bundled lite map. For sharper terrain and borders, see 'Full map data' in the README (~600 MB, no keys).",
    },
  ];
}

export function report(checks: Check[]): { text: string; ok: boolean } {
  const lines = checks.map((c) => `${c.ok ? "ok  " : c.required ? "FIX " : "note"} ${c.name}` + (!c.ok && c.fix ? `\n     ${c.fix}` : ""));
  const failing = checks.filter((c) => !c.ok && c.required).length;
  lines.push("", failing ? `${failing} thing${failing === 1 ? "" : "s"} to fix before you generate a video.` : "Ready: npm run dev:server and npm run dev:web.");
  return { text: lines.join("\n"), ok: failing === 0 };
}

function has(tool: string): boolean {
  const r = spawnSync(tool, ["-version"], { stdio: "ignore" });
  return r.status === 0;
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../");
  const envPath = path.join(root, "server/.env");
  const checks: Check[] = [
    nodeCheck(process.version),
    { name: "Dependencies installed (npm install)", ok: fs.existsSync(path.join(root, "node_modules")), required: true, fix: "Run npm install in the repository root." },
    toolCheck("ffmpeg", has("ffmpeg")),
    toolCheck("ffprobe", has("ffprobe")),
    ...envChecks(fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : null),
    ...geoChecks(root, fs.existsSync),
    {
      name: "Background music (optional)",
      ok: fs.existsSync(path.join(root, "remotion/public/music")) &&
        fs.readdirSync(path.join(root, "remotion/public/music")).some((f) => /\.(mp3|wav|m4a)$/i.test(f)),
      required: false,
      fix: "Drop an mp3, wav or m4a into remotion/public/music/ if you want music under the narration.",
    },
  ];
  const { text, ok } = report(checks);
  console.log(text);
  process.exitCode = ok ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
