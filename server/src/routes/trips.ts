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
  updateTrip,
} from "../lib/tripStore.js";
import { validateIdParam } from "../lib/validateId.js";
import { DATA_DIR } from "../config.js";
import { generateNarration, generateOpeningNarration } from "../services/narration.js";
import type { MediaItem, Stop } from "../types.js";

export const tripsRouter = Router();

tripsRouter.param("id", validateIdParam);
tripsRouter.param("stopId", validateIdParam);

// The only stop fields a client may set. Everything else (media and audio
// paths especially) is server-managed, and those paths get read and deleted.
const EDITABLE_STOP_FIELDS = ["name", "lat", "lng", "date", "notes", "narration"] as const;

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
    const { title, music, orientation, titleCardNarration } = req.body ?? {};
    const trip = await updateTrip(req.params.id, (trip) => {
      if (title !== undefined) trip.title = title;
      if (music !== undefined) trip.music = music;
      if (orientation !== undefined) trip.orientation = orientation;
      if (titleCardNarration !== undefined && titleCardNarration !== trip.titleCardNarration) {
        trip.titleCardNarration = titleCardNarration;
        // text changed - the previously recorded audio no longer matches it
        trip.titleCardAudioPath = undefined;
        trip.titleCardAudioDurationSec = undefined;
      }
      return trip;
    });
    res.json(trip);
  } catch {
    res.status(404).json({ error: "Trip not found" });
  }
});

tripsRouter.post("/:id/title-narration", async (req, res) => {
  try {
    // Written outside updateTrip: the Claude call shouldn't hold the trip lock.
    const titleCardNarration = await generateOpeningNarration(await readTrip(req.params.id));
    await updateTrip(req.params.id, (trip) => {
      trip.titleCardNarration = titleCardNarration;
      trip.titleCardAudioPath = undefined;
      trip.titleCardAudioDurationSec = undefined;
    });
    res.json({ titleCardNarration });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

tripsRouter.delete("/:id", async (req, res) => {
  await deleteTrip(req.params.id);
  res.status(204).end();
});

tripsRouter.post("/:id/stops", async (req, res) => {
  const { name, lat, lng, date, notes } = req.body ?? {};
  if (!name || typeof lat !== "number" || typeof lng !== "number") {
    res.status(400).json({ error: "name, lat, lng are required" });
    return;
  }
  try {
    const stop: Stop = { id: nanoid(10), name, lat, lng, date, notes, media: [] };
    await updateTrip(req.params.id, (trip) => {
      trip.stops.push(stop);
    });
    res.status(201).json(stop);
  } catch {
    res.status(404).json({ error: "Trip not found" });
  }
});

// Must stay above PUT /:id/stops/:stopId, which would otherwise match first
// and treat "reorder" as a stop ID.
tripsRouter.put("/:id/stops/reorder", async (req, res) => {
  const order: unknown = req.body?.order;
  let trip;
  try {
    trip = await updateTrip(req.params.id, (trip) => {
      const currentIds = new Set(trip.stops.map((s) => s.id));
      const isCompleteOrder =
        Array.isArray(order) &&
        order.length === trip.stops.length &&
        new Set(order).size === order.length &&
        order.every((id) => currentIds.has(id));
      if (!isCompleteOrder) return undefined;
      const byId = new Map(trip.stops.map((s) => [s.id, s]));
      trip.stops = (order as string[]).map((id) => byId.get(id) as Stop);
      return trip;
    });
  } catch {
    res.status(404).json({ error: "Trip not found" });
    return;
  }
  if (!trip) {
    res.status(400).json({ error: "order must list every stop exactly once" });
    return;
  }
  res.json(trip);
});

tripsRouter.put("/:id/stops/:stopId", async (req, res) => {
  try {
    const body = req.body ?? {};
    const patch: Partial<Stop> = Object.fromEntries(
      EDITABLE_STOP_FIELDS.filter((field) => body[field] !== undefined).map((field) => [field, body[field]])
    );
    const stop = await updateTrip(req.params.id, (trip) => {
      const stop = trip.stops.find((s) => s.id === req.params.stopId);
      if (!stop) return undefined;
      if (patch.narration !== undefined && patch.narration !== stop.narration) {
        // text changed - the previously recorded audio no longer matches it
        stop.audioPath = undefined;
        stop.audioDurationSec = undefined;
      }
      Object.assign(stop, patch);
      return stop;
    });
    if (!stop) {
      res.status(404).json({ error: "Stop not found" });
      return;
    }
    res.json(stop);
  } catch {
    res.status(404).json({ error: "Trip not found" });
  }
});

tripsRouter.post("/:id/stops/:stopId/narration", async (req, res) => {
  try {
    const before = await readTrip(req.params.id);
    const beforeStop = before.stops.find((s) => s.id === req.params.stopId);
    if (!beforeStop) {
      res.status(404).json({ error: "Stop not found" });
      return;
    }
    // Written outside updateTrip: the Claude call shouldn't hold the trip lock.
    const narration = await generateNarration(before.title, beforeStop);
    const stop = await updateTrip(req.params.id, (trip) => {
      const stop = trip.stops.find((s) => s.id === req.params.stopId);
      if (!stop) return undefined;
      stop.narration = narration;
      stop.audioPath = undefined;
      stop.audioDurationSec = undefined;
      return stop;
    });
    if (!stop) {
      res.status(404).json({ error: "Stop not found" });
      return;
    }
    res.json(stop);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

tripsRouter.delete("/:id/stops/:stopId", async (req, res) => {
  try {
    await updateTrip(req.params.id, (trip) => {
      trip.stops = trip.stops.filter((s) => s.id !== req.params.stopId);
    });
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Trip not found" });
  }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

tripsRouter.post("/:id/stops/:stopId/media", upload.array("files", 20), async (req, res) => {
  try {
    const before = await readTrip(req.params.id);
    if (!before.stops.some((s) => s.id === req.params.stopId)) {
      res.status(404).json({ error: "Stop not found" });
      return;
    }
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const dir = tripMediaDir(before.id, req.params.stopId);
    await fs.mkdir(dir, { recursive: true });
    const added: MediaItem[] = [];
    for (const file of files) {
      const isVideo = file.mimetype.startsWith("video/");
      const ext = path.extname(file.originalname) || (isVideo ? ".mp4" : ".jpg");
      const filename = `${nanoid(10)}${ext}`;
      await fs.writeFile(path.join(dir, filename), file.buffer);
      const relPath = path.relative(DATA_DIR, path.join(dir, filename));
      added.push({ id: nanoid(10), type: isVideo ? "video" : "photo", path: relPath });
    }
    const saved = await updateTrip(req.params.id, (trip) => {
      const stop = trip.stops.find((s) => s.id === req.params.stopId);
      stop?.media.push(...added);
      return Boolean(stop);
    });
    if (!saved) {
      res.status(404).json({ error: "Stop not found" });
      return;
    }
    res.status(201).json(added);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

tripsRouter.delete("/:id/stops/:stopId/media/:mediaId", async (req, res) => {
  try {
    const result = await updateTrip(req.params.id, async (trip) => {
      const stop = trip.stops.find((s) => s.id === req.params.stopId);
      if (!stop) return "no-stop" as const;
      const item = stop.media.find((m) => m.id === req.params.mediaId);
      if (!item) return "ok" as const;
      // item.path comes from trip.json, so check it rather than trust it.
      const target = path.resolve(DATA_DIR, item.path);
      if (path.dirname(target) !== path.resolve(tripMediaDir(trip.id, stop.id))) {
        return "outside" as const;
      }
      await fs.rm(target, { force: true });
      stop.media = stop.media.filter((m) => m.id !== req.params.mediaId);
      return "ok" as const;
    });
    if (result === "no-stop") {
      res.status(404).json({ error: "Stop not found" });
    } else if (result === "outside") {
      res.status(400).json({ error: "Media path is outside this stop's media folder" });
    } else {
      res.status(204).end();
    }
  } catch {
    res.status(404).json({ error: "Trip not found" });
  }
});
