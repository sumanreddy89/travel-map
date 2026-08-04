import fs from "node:fs/promises";
import path from "node:path";
import { REMOTION_PUBLIC_DIR } from "../config.js";
import { getAudioDurationSec } from "./tts.js";

const MUSIC_DIR = path.join(REMOTION_PUBLIC_DIR, "music");
const AUDIO_EXTENSIONS = new Set([".mp3", ".m4a", ".wav", ".ogg"]);

export async function findDefaultMusic(): Promise<{ path: string; durationSec: number } | undefined> {
  const files = await fs.readdir(MUSIC_DIR).catch(() => [] as string[]);
  const audioFile = files.find((f) => AUDIO_EXTENSIONS.has(path.extname(f).toLowerCase()));
  if (!audioFile) return undefined;

  const fullPath = path.join(MUSIC_DIR, audioFile);
  const durationSec = await getAudioDurationSec(fullPath);
  return { path: `music/${audioFile}`, durationSec };
}
