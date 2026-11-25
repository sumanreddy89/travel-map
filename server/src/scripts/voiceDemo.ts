// Maintainers only: voices the trip demo's narration once, so the demo plays with a voiceover
// and still renders with no keys. Run after buildDemo.ts (which writes the lines without audio):
//
//   npx tsx src/scripts/voiceDemo.ts      (from server/, with ELEVENLABS_API_KEY in server/.env)
//
// Writes remotion/public/demo/voice/*.mp3 and fills in the audio paths and durations in
// demoProps.json. A line whose file already exists for the same text is skipped, so re-running
// only voices what changed. Voiceover is generated with ElevenLabs; see docs/demo/ASSETS.md.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { REMOTION_DIR, REMOTION_PUBLIC_DIR } from "../config.js";
import { getAudioDurationSec, synthesizeSpeech } from "../services/tts.js";

const PROPS_FILE = path.join(REMOTION_DIR, "src", "demo", "demoProps.json");
const VOICE_DIR = path.join(REMOTION_PUBLIC_DIR, "demo", "voice");

// One file per line, named after what it is and a hash of its text, so a changed line gets a new file.
async function voice(name: string, text: string | undefined): Promise<{ audioPath: string; sec: number } | null> {
  if (!text) return null;
  const hash = crypto.createHash("sha1").update(text).digest("hex").slice(0, 8);
  const rel = `voice/${name}-${hash}.mp3`;
  const file = path.join(REMOTION_PUBLIC_DIR, "demo", rel);
  try {
    await fs.access(file);
  } catch {
    console.log(`Voicing ${name}: ${text}`);
    await synthesizeSpeech(text, file);
  }
  return { audioPath: rel, sec: Math.round((await getAudioDurationSec(file)) * 100) / 100 };
}

const props = JSON.parse(await fs.readFile(PROPS_FILE, "utf-8"));
await fs.mkdir(VOICE_DIR, { recursive: true });
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const t = props.trip;
const title = await voice("title", t.titleCardNarration);
if (title) Object.assign(t, { titleCardAudioPath: title.audioPath, titleCardAudioDurationSec: title.sec });
for (const stop of t.stops) {
  const v = await voice(`stop-${slug(stop.name)}`, stop.narration);
  if (v) Object.assign(stop, { audioPath: v.audioPath, audioDurationSec: v.sec });
}
for (const scene of props.mapScenes) {
  if (scene.travel) {
    const v = await voice(`leg-to-${slug(scene.toStop.name)}`, scene.travel.narration);
    if (v) Object.assign(scene.travel, { audioPath: v.audioPath, audioDurationSec: v.sec });
  }
  if (scene.closure) {
    const v = await voice(`closure-${slug(scene.country.iso)}`, scene.closure.narration);
    if (v) Object.assign(scene.closure, { audioPath: v.audioPath, audioDurationSec: v.sec });
  }
}

// Files no line uses any more (a line was reworded) are removed.
const used = new Set(JSON.stringify(props).match(/voice\/[a-z0-9-]+\.mp3/g) ?? []);
for (const f of await fs.readdir(VOICE_DIR)) if (!used.has(`voice/${f}`)) await fs.rm(path.join(VOICE_DIR, f));

await fs.writeFile(PROPS_FILE, JSON.stringify(props) + "\n");
console.log(`Voiced ${used.size} lines into remotion/public/demo/voice/`);
