import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../../");

export const DATA_DIR = path.join(REPO_ROOT, "data");
export const TRIPS_DIR = path.join(DATA_DIR, "trips");
export const REMOTION_DIR = path.join(REPO_ROOT, "remotion");
export const REMOTION_PUBLIC_DIR = path.join(REMOTION_DIR, "public");
export const REMOTION_ENTRY = path.join(REMOTION_DIR, "src", "index.ts");

export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
export const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? "";
export const ELEVENLABS_VOICE_ID =
  process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";

export const PORT = Number(process.env.PORT ?? 4000);
// Local-only: the API has no auth, so it must not be reachable from the network.
export const HOST = "127.0.0.1";
export const WEB_ORIGIN = "http://localhost:5173";

export const FPS = 30;

export const VIDEO_DIMENSIONS = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 },
} as const;
