import express from "express";
import cors from "cors";
import path from "node:path";
import { DATA_DIR, HOST, PORT, WEB_ORIGIN } from "./config.js";
import { tripsRouter } from "./routes/trips.js";
import { geocodeRouter } from "./routes/geocode.js";
import { renderRouter } from "./routes/render.js";
import { listMusicTracks } from "./services/music.js";

const app = express();
app.use(cors({ origin: WEB_ORIGIN }));
app.use(express.json());

app.use("/data", express.static(DATA_DIR));
app.use("/api/trips", tripsRouter);
app.use("/api/trips", renderRouter);
app.use("/api/geocode", geocodeRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.get("/api/music", async (_req, res) => {
  res.json(await listMusicTracks());
});

app.listen(PORT, HOST, () => {
  console.log(`TravelMap server listening on http://${HOST}:${PORT}`);
});
