import { Router } from "express";
import fetch from "node-fetch";

export const geocodeRouter = Router();

let lastRequestAt = 0;
const MIN_INTERVAL_MS = 1100; // Nominatim usage policy: max ~1 req/sec
const cache = new Map<string, unknown>();

async function throttle() {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

geocodeRouter.get("/", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) {
    res.status(400).json({ error: "q is required" });
    return;
  }
  if (cache.has(q)) {
    res.json(cache.get(q));
    return;
  }
  try {
    await throttle();
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "TravelMap/0.1 (local personal project)" },
    });
    const results = await resp.json();
    cache.set(q, results);
    res.json(results);
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
});
