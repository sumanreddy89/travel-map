import type { RequestParamHandler } from "express";

// Trip and stop IDs are nanoid(10) values. These IDs end up in filesystem
// paths, so anything else (notably an encoded "../") must never get that far.
const ID_PATTERN = /^[A-Za-z0-9_-]{10}$/;

export const validateIdParam: RequestParamHandler = (_req, res, next, value) => {
  if (typeof value === "string" && ID_PATTERN.test(value)) {
    next();
    return;
  }
  res.status(400).json({ error: "Invalid ID" });
};
