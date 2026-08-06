import { Router } from "express";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import {
  createTrip,
  deleteTrip,
  listTrips,
  readTrip,
  tripMediaDir,
  writeTrip,
} from "../lib/tripStore.js";
import { DATA_DIR } from "../config.js";
import { generateNarration, generateOpeningNarration } from "../services/narration.js";
import type { MediaItem, Stop } from "../types.js";

export const tripsRouter = Router();

tripsRouter.get("/", async (_req, res) => {
  res.json(await listTrips());
});

tripsRouter.post("/", async (req, res) => {
  const title = String(req.body?.title ?? "Untitled Trip");
  const trip = await createTrip(title);
  res.status(201).json(trip);
});

tripsRouter.get("/:id", async (req, res) => {
  try {
    res.json(await readTrip(req.params.id));
  } catch {
    res.status(404).json({ error: "Trip not found" });
  }
});

tripsRouter.put("/:id", async (req, res) => {
  try {
    const trip = await readTrip(req.params.id);
    const { title, stops, music, orientation, titleCardNarration } = req.body ?? {};
    if (title !== undefined) trip.title = title;
    if (stops !== undefined) trip.stops = stops;
    if (music !== undefined) trip.music = music;
    if (orientation !== undefined) trip.orientation = orientation;
    if (titleCardNarration !== undefined && titleCardNarration !== trip.titleCardNarration) {
      trip.titleCardNarration = titleCardNarration;
      // text changed - the previously recorded audio no longer matches it
      trip.titleCardAudioPath = undefined;
      trip.titleCardAudioDurationSec = undefined;
    }
    await writeTrip(trip);
    res.json(trip);
  } catch {
    res.status(404).json({ error: "Trip not found" });
  }
});

tripsRouter.post("/:id/title-narration", async (req, res) => {
  try {
    const trip = await readTrip(req.params.id);
    trip.titleCardNarration = await generateOpeningNarration(trip);
    trip.titleCardAudioPath = undefined;
    trip.titleCardAudioDurationSec = undefined;
    await writeTrip(trip);
    res.json({ titleCardNarration: trip.titleCardNarration });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

tripsRouter.delete("/:id", async (req, res) => {
  await deleteTrip(req.params.id);
  res.status(204).end();
});

tripsRouter.post("/:id/stops", async (req, res) => {
  try {
    const trip = await readTrip(req.params.id);
    const { name, lat, lng, date, notes } = req.body ?? {};
    if (!name || typeof lat !== "number" || typeof lng !== "number") {
      res.status(400).json({ error: "name, lat, lng are required" });
      return;
    }
    const stop: Stop = { id: nanoid(10), name, lat, lng, date, notes, media: [] };
    trip.stops.push(stop);
    await writeTrip(trip);
    res.status(201).json(stop);
  } catch {
    res.status(404).json({ error: "Trip not found" });
  }
});

tripsRouter.put("/:id/stops/:stopId", async (req, res) => {
  try {
    const trip = await readTrip(req.params.id);
    const stop = trip.stops.find((s) => s.id === req.params.stopId);
    if (!stop) {
      res.status(404).json({ error: "Stop not found" });
      return;
    }
    const patch = req.body ?? {};
    if (patch.narration !== undefined && patch.narration !== stop.narration) {
      // text changed - the previously recorded audio no longer matches it
      stop.audioPath = undefined;
      stop.audioDurationSec = undefined;
    }
    Object.assign(stop, patch, { id: stop.id });
    await writeTrip(trip);
    res.json(stop);
  } catch {
    res.status(404).json({ error: "Trip not found" });
  }
});

tripsRouter.post("/:id/stops/:stopId/narration", async (req, res) => {
  try {
    const trip = await readTrip(req.params.id);
    const stop = trip.stops.find((s) => s.id === req.params.stopId);
    if (!stop) {
      res.status(404).json({ error: "Stop not found" });
      return;
    }
    stop.narration = await generateNarration(trip.title, stop);
    stop.audioPath = undefined;
    stop.audioDurationSec = undefined;
    await writeTrip(trip);
    res.json(stop);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

tripsRouter.delete("/:id/stops/:stopId", async (req, res) => {
  try {
    const trip = await readTrip(req.params.id);
    trip.stops = trip.stops.filter((s) => s.id !== req.params.stopId);
    await writeTrip(trip);
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Trip not found" });
  }
});

tripsRouter.put("/:id/stops/reorder", async (req, res) => {
  try {
    const trip = await readTrip(req.params.id);
    const order: string[] = req.body?.order ?? [];
    const byId = new Map(trip.stops.map((s) => [s.id, s]));
    const reordered = order.map((id) => byId.get(id)).filter((s): s is Stop => Boolean(s));
    if (reordered.length === trip.stops.length) {
      trip.stops = reordered;
      await writeTrip(trip);
    }
    res.json(trip);
  } catch {
    res.status(404).json({ error: "Trip not found" });
  }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

tripsRouter.post("/:id/stops/:stopId/media", upload.array("files", 20), async (req, res) => {
  try {
    const trip = await readTrip(req.params.id);
    const stop = trip.stops.find((s) => s.id === req.params.stopId);
    if (!stop) {
      res.status(404).json({ error: "Stop not found" });
      return;
    }
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const dir = tripMediaDir(trip.id, stop.id);
    await fs.mkdir(dir, { recursive: true });
    const added: MediaItem[] = [];
    for (const file of files) {
      const isVideo = file.mimetype.startsWith("video/");
      const ext = path.extname(file.originalname) || (isVideo ? ".mp4" : ".jpg");
      const filename = `${nanoid(10)}${ext}`;
      await fs.writeFile(path.join(dir, filename), file.buffer);
      const relPath = path.relative(DATA_DIR, path.join(dir, filename));
      const item: MediaItem = { id: nanoid(10), type: isVideo ? "video" : "photo", path: relPath };
      stop.media.push(item);
      added.push(item);
    }
    await writeTrip(trip);
    res.status(201).json(added);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

tripsRouter.delete("/:id/stops/:stopId/media/:mediaId", async (req, res) => {
  try {
    const trip = await readTrip(req.params.id);
    const stop = trip.stops.find((s) => s.id === req.params.stopId);
    if (!stop) {
      res.status(404).json({ error: "Stop not found" });
      return;
    }
    const item = stop.media.find((m) => m.id === req.params.mediaId);
    if (item) {
      await fs.rm(path.join(DATA_DIR, item.path), { force: true });
      stop.media = stop.media.filter((m) => m.id !== req.params.mediaId);
      await writeTrip(trip);
    }
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Trip not found" });
  }
});
