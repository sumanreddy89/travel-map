// What an uploaded file really is, from its first bytes rather than its name or the
// browser's MIME type (a .txt renamed .jpg used to be stored as a photo).
export type Detected = { kind: "photo" | "video"; ext: string };

const PHOTO_BRANDS = new Set(["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1", "avif"]);

export function detectMedia(head: Buffer): Detected | null {
  const at = (offset: number, text: string) => head.subarray(offset, offset + text.length).toString("latin1") === text;
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return { kind: "photo", ext: ".jpg" };
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { kind: "photo", ext: ".png" };
  if (at(0, "GIF87a") || at(0, "GIF89a")) return { kind: "photo", ext: ".gif" };
  if (at(0, "RIFF") && at(8, "WEBP")) return { kind: "photo", ext: ".webp" };
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return { kind: "video", ext: ".webm" };
  if (at(4, "ftyp")) {
    const brand = head.subarray(8, 12).toString("latin1").trim().toLowerCase();
    if (PHOTO_BRANDS.has(brand)) return { kind: "photo", ext: brand === "avif" ? ".avif" : ".heic" };
    if (brand === "qt") return { kind: "video", ext: ".mov" };
    return { kind: "video", ext: ".mp4" };
  }
  return null;
}

// A finished render must be a non-empty file; an empty or half-written final.mp4 left by a
// crash or restart isn't a video.
export function renderStateFromFile(size: number | null): "done" | "idle" {
  return size !== null && size > 0 ? "done" : "idle";
}
