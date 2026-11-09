import { Router } from "express";
import { validateIdParam } from "../lib/validateId.js";
import { getJob, getRenderStatus, startRenderJob } from "../services/render.js";

export const renderRouter = Router();

renderRouter.param("id", validateIdParam);

renderRouter.post("/:id/render", async (req, res) => {
  await startRenderJob(req.params.id);
  res.status(202).json(getJob(req.params.id));
});

renderRouter.get("/:id/render/status", async (req, res) => {
  res.json(await getRenderStatus(req.params.id));
});
