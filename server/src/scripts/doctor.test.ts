// Run: npm test --workspace server
import { test } from "node:test";
import assert from "node:assert/strict";
import { envChecks, geoChecks, nodeCheck, parseEnv, report, toolCheck } from "./doctor.js";

test("old Node fails, current Node passes", () => {
  assert.equal(nodeCheck("v18.19.0").ok, false);
  assert.equal(nodeCheck("v22.3.0").ok, true);
});

test("missing ffprobe is a required fix (the README used to leave it out)", () => {
  const c = toolCheck("ffprobe", false);
  assert.equal(c.ok, false);
  assert.equal(c.required, true);
  assert.match(c.fix ?? "", /ffmpeg/);
});

test("env: missing file, empty key, filled key; values are never echoed", () => {
  assert.equal(envChecks(null)[0].ok, false);
  const checks = envChecks("ANTHROPIC_API_KEY=sk-secret\nELEVENLABS_API_KEY=\n# ELEVENLABS_VOICE_ID=x\n");
  const byName = Object.fromEntries(checks.map((c) => [c.name, c.ok]));
  assert.equal(byName["ANTHROPIC_API_KEY is set"], true);
  assert.equal(byName["ELEVENLABS_API_KEY is set"], false);
  assert.equal(byName["ELEVENLABS_VOICE_ID is set"], false);
  assert.ok(!report(checks).text.includes("sk-secret"));
});

test("parseEnv strips quotes and ignores comments", () => {
  assert.deepEqual(parseEnv('A="1"\n# B=2\nC = 3'), { A: "1", C: "3" });
});

test("geo: points at the converter when raw data exists, else at the README", () => {
  const rawOnly = geoChecks("/r", (p) => p.endsWith("data/geo-raw"));
  assert.equal(rawOnly[0].ok, false);
  assert.match(rawOnly[0].fix ?? "", /convertGeo/);
  const nothing = geoChecks("/r", () => false);
  assert.match(nothing[0].fix ?? "", /README/);
  assert.equal(geoChecks("/r", () => true)[0].ok, true);
});

test("report: optional misses don't block, required ones do", () => {
  assert.equal(report([{ name: "music", ok: false, required: false }]).ok, true);
  assert.equal(report([{ name: "key", ok: false, required: true, fix: "add it" }]).ok, false);
});
