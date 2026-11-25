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
import { parseYearInput, yearTripFields } from "../lib/yearInput.js";
import { validateNewStop, validateStopPatch, validateTitle, validateTripPatch } from "../lib/validateTrip.js";
import { DATA_DIR } from "../config.js";
import { detectMedia } from "../lib/mediaType.js";
import { generateNarration, generateOpeningNarration } from "../services/narration.js";
import type { MediaItem, Stop } from "../types.js";

export const tripsRouter = Router();

tripsRouter.param("id", validateIdParam);
tripsRouter.param("stopId", validateIdParam);

// Every client-supplied field goes through lib/validateTrip.ts. Only known fields survive:
// media and audio paths are server-managed, and those paths get read and deleted.

tripsRouter.get("/", async (_req, res) => {
  res.json(await listTrips());
});

tripsRouter.post("/", async (req, res) => {
  const title = validateTitle(req.body?.title ?? "Untitled Trip");
  if (!title.ok) {
    res.status(400).json({ error: title.error });
    return;
  }
  const trip = await createTrip(title.value);
  res.status(201).json(trip);
});

// "Year in travel": paste an ordered list of cities (see lib/yearInput.ts for the format) and
// get a trip whose film opens with the year's stats. A malformed line is a 400 naming the line.
tripsRouter.post("/year", async (req, res) => {
  const parsed = parseYearInput(req.body?.text);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const fields = yearTripFields(parsed.value, () => nanoid(10));
  const trip = await createTrip(fields.title);
  const saved = await updateTrip(trip.id, (t) => {
    t.stops = fields.stops;
    t.yearInTravel = fields.yearInTravel;
    return t;
  });
  res.status(201).json(saved);
});

tripsRouter.get("/:id", async (req, res) => {
  try {
    res.json(await readTrip(req.params.id));
  } catch {
    res.status(404).json({ error: "Trip not found" });
  }
});

tripsRouter.put("/:id", async (req, res) => {
  const checked = validateTripPatch(req.body);
  if (!checked.ok) {
    res.status(400).json({ error: checked.error });
    return;
  }
  try {
    const { title, music, orientation, titleCardNarration, showWatermark } = checked.value;
    const trip = await updateTrip(req.params.id, (trip) => {
      if (title !== undefined) trip.title = title;
      if (music !== undefined) trip.music = music;
      if (orientation !== undefined) trip.orientation = orientation;
      if (showWatermark !== undefined) trip.showWatermark = showWatermark;
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
  const checked = validateNewStop(req.body);
  if (!checked.ok) {
    res.status(400).json({ error: checked.error });
    return;
  }
  try {
    const stop: Stop = { id: nanoid(10), ...checked.value, media: [] };
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
  const checked = validateStopPatch(req.body);
  if (!checked.ok) {
    res.status(400).json({ error: checked.error });
    return;
  }
  try {
    const patch = checked.value;
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
    await updateTrip(req.params.id, async (trip) => {
      trip.stops = trip.stops.filter((s) => s.id !== req.params.stopId);
      // The stop's photos and videos go with it (stopId is validated, so this stays inside the trip).
      await fs.rm(tripMediaDir(trip.id, req.params.stopId), { recursive: true, force: true });
    });
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Trip not found" });
  }
});

// Uploads stream to a temp folder on the same disk (not into memory), are checked by content,
// then moved into the stop's folder. Anything that isn't a photo or video is refused.
const UPLOAD_TMP = path.join(DATA_DIR, "tmp-uploads");
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdir(UPLOAD_TMP, { recursive: true }).then(() => cb(null, UPLOAD_TMP), (err) => cb(err as Error, UPLOAD_TMP));
    },
    filename: (_req, _file, cb) => cb(null, nanoid(16)),
  }),
  limits: { fileSize: 500 * 1024 * 1024, files: 20 },
});

async function readHead(file: string): Promise<Buffer> {
  const fh = await fs.open(file, "r");
  try {
    const buf = Buffer.alloc(16);
    const { bytesRead } = await fh.read(buf, 0, 16, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

tripsRouter.post("/:id/stops/:stopId/media", upload.array("files", 20), async (req, res) => {
  try {
    const before = await readTrip(req.params.id);
    if (!before.stops.some((s) => s.id === req.params.stopId)) {
      res.status(404).json({ error: "Stop not found" });
      return;
    }
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const kinds = await Promise.all(files.map(async (f) => detectMedia(await readHead(f.path))));
    const rejected = files.filter((_, i) => !kinds[i]).map((f) => f.originalname);
    if (rejected.length) {
      res.status(415).json({ error: `Not a photo or video: ${rejected.join(", ")}` });
      return;
    }
    const dir = tripMediaDir(before.id, req.params.stopId);
    await fs.mkdir(dir, { recursive: true });
    const added: MediaItem[] = [];
    for (const [i, file] of files.entries()) {
      const kind = kinds[i]!;
      const filename = `${nanoid(10)}${kind.ext}`;
      await fs.rename(file.path, path.join(dir, filename));
      const relPath = path.relative(DATA_DIR, path.join(dir, filename));
      added.push({ id: nanoid(10), type: kind.kind, path: relPath });
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
  } finally {
    // Files moved into the stop are gone from the temp folder; this removes the rest.
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    await Promise.all(files.map((f) => fs.rm(f.path, { force: true })));
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
