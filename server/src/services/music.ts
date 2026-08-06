import fs from "node:fs/promises";
import path from "node:path";
import { REMOTION_PUBLIC_DIR } from "../config.js";
import { getAudioDurationSec } from "./tts.js";

const MUSIC_DIR = path.join(REMOTION_PUBLIC_DIR, "music");
const AUDIO_EXTENSIONS = new Set([".mp3", ".m4a", ".wav", ".ogg"]);

export async function findDefaultMusic(): Promise<{ path: string; durationSec: number } | undefined> {
  const tracks = await listMusicTracks();
  return tracks[0];
}

export type MusicTrack = { path: string; name: string; durationSec: number };

export async function listMusicTracks(): Promise<MusicTrack[]> {
  const files = await fs.readdir(MUSIC_DIR).catch(() => [] as string[]);
  const audioFiles = files.filter((f) => AUDIO_EXTENSIONS.has(path.extname(f).toLowerCase())).sort();

  const tracks: MusicTrack[] = [];
  for (const file of audioFiles) {
    const fullPath = path.join(MUSIC_DIR, file);
    try {
      const durationSec = await getAudioDurationSec(fullPath);
      const name = path.basename(file, path.extname(file)).replace(/[_-]+/g, " ").trim();
      tracks.push({ path: `music/${file}`, name, durationSec });
    } catch {
      // unreadable/corrupt file - skip it rather than fail the whole list
    }
  }
  return tracks;
}
