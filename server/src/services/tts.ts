import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import fetch from "node-fetch";
import { ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID } from "../config.js";

export async function synthesizeSpeech(text: string, outFile: string): Promise<void> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.4, similarity_boost: 0.75 },
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`ElevenLabs TTS failed (${resp.status}): ${body}`);
  }
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  const buffer = Buffer.from(await resp.arrayBuffer());
  await fs.writeFile(outFile, buffer);
}

export async function getAudioDurationSec(file: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      file,
    ]);
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", (d) => (err += d));
    proc.on("close", (code) => {
      if (code === 0) resolve(parseFloat(out.trim()));
      else reject(new Error(`ffprobe failed: ${err}`));
    });
  });
}
