// Run: npm test --workspace server
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectMedia, renderStateFromFile } from "./mediaType.js";

const ftyp = (brand: string) => Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftyp" + brand.padEnd(4, " "), "latin1")]);

test("real photos and videos are recognised by their first bytes", () => {
  assert.deepEqual(detectMedia(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), { kind: "photo", ext: ".jpg" });
  assert.deepEqual(detectMedia(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), { kind: "photo", ext: ".png" });
  assert.deepEqual(detectMedia(Buffer.from("RIFF\x00\x00\x00\x00WEBP", "latin1")), { kind: "photo", ext: ".webp" });
  assert.deepEqual(detectMedia(ftyp("heic")), { kind: "photo", ext: ".heic" });
  assert.deepEqual(detectMedia(ftyp("isom")), { kind: "video", ext: ".mp4" });
  assert.deepEqual(detectMedia(ftyp("qt")), { kind: "video", ext: ".mov" });
  assert.deepEqual(detectMedia(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])), { kind: "video", ext: ".webm" });
});

test("regression: a text file named .jpg is refused, not stored as a photo", () => {
  assert.equal(detectMedia(Buffer.from("hello, this is not a photo", "utf8")), null);
  assert.equal(detectMedia(Buffer.alloc(0)), null);
});

test("regression: an empty final.mp4 after a restart doesn't count as done", () => {
  assert.equal(renderStateFromFile(0), "idle");
  assert.equal(renderStateFromFile(null), "idle");
  assert.equal(renderStateFromFile(1024), "done");
});
