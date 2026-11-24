// Run: npm test --workspace server
// The server sizes the render; the Remotion composition sizes its preview. They must agree.
// Remotion's config is read as text: it's outside the server's TypeScript project.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { REMOTION_DIR, VIDEO_DIMENSIONS } from "../config.js";

function remotionDimensions() {
  const src = fs.readFileSync(path.join(REMOTION_DIR, "src", "config.ts"), "utf-8");
  const read = (name: string) => {
    const m = src.match(new RegExp(`${name}:\\s*\\{\\s*width:\\s*(\\d+),\\s*height:\\s*(\\d+)\\s*\\}`));
    assert.ok(m, `remotion/src/config.ts defines ${name}`);
    return { width: Number(m[1]), height: Number(m[2]) };
  };
  return { landscape: read("landscape"), portrait: read("portrait") };
}

test("server and Remotion use the same output sizes", () => {
  assert.deepEqual(remotionDimensions(), { landscape: { ...VIDEO_DIMENSIONS.landscape }, portrait: { ...VIDEO_DIMENSIONS.portrait } });
  assert.deepEqual(VIDEO_DIMENSIONS.landscape, { width: 1920, height: 1080 });
  assert.deepEqual(VIDEO_DIMENSIONS.portrait, { width: 1080, height: 1920 });
});
