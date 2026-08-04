import { Router } from "express";
import { getJob, startRenderJob } from "../services/render.js";

export const renderRouter = Router();

renderRouter.post("/:id/render", async (req, res) => {
  await startRenderJob(req.params.id);
  res.status(202).json(getJob(req.params.id));
});

renderRouter.get("/:id/render/status", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.json({ tripId: req.params.id, state: "idle", progress: 0 });
    return;
  }
  res.json(job);
});
