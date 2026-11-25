import { test } from "node:test";
import assert from "node:assert/strict";
import { findCity, parseYearInput } from "./yearInput.js";

const ok = (text: string) => {
  const r = parseYearInput(text);
  assert.ok(r.ok, r.ok ? "" : r.error);
  return r.value;
};
const err = (text: string) => {
  const r = parseYearInput(text);
  assert.ok(!r.ok, "expected an error");
  return r.error;
};

test("a simple list: places from the bundled list, plane by default, year from the first date", () => {
  const v = ok("Lisbon | 2026-02-14\nMadrid | 2026-03-20\nBarcelona | 2026-04-02 | train\n");
  assert.equal(v.year, 2026);
  assert.deepEqual(v.rows.map((r) => [r.city.name, r.city.iso3, r.mode]), [["Lisbon", "PRT", "plane"], ["Madrid", "ESP", "plane"], ["Barcelona", "ESP", "train"]]);
  assert.ok(Math.abs(v.rows[0].city.lat - 38.7) < 0.1);
});

test("an explicit year line wins; comments, blank lines and case don't matter", () => {
  const v = ok("# my year\nyear: 2025\n\nparis | 2026-01-02 | TRAIN\nberlin");
  assert.equal(v.year, 2025);
  assert.equal(v.rows[0].mode, "train");
  assert.equal(v.rows[1].date, undefined);
});

test("accents and countries: 'Zurich' finds Zürich; a country narrows the match", () => {
  assert.ok(ok("Zurich | 2026-05-01").rows[0].city.name.startsWith("Z"));
  assert.equal(ok("Paris, FR | 2026-05-01").rows[0].city.iso3, "FRA");
  assert.equal(ok("Paris, France | 2026-05-01").rows.length, 1);
});

test("malformed rows give a clear error with the line number, never a crash", () => {
  assert.match(err("Lisbon | 2026-02-14\nAtlantis | 2026-03-01"), /^Line 2: can't find "Atlantis"/);
  assert.match(err("Lisbon | 2026-13-01"), /^Line 1: "2026-13-01" isn't a date/);
  assert.match(err("Lisbon | 2026-02-30"), /isn't a date/);
  assert.match(err("Lisbon | 2026-02-14 | boat"), /^Line 1: "boat" isn't a travel mode/);
  assert.match(err("Lisbon | 2026-02-14 | plane | extra"), /too many "\|"/);
  assert.match(err("Madrid | 2026-06-01\nLisbon | 2026-02-14"), /^Line 2: 2026-02-14 is before 2026-06-01/);
  assert.match(err("year: twenty\nLisbon"), /^Line 1: "twenty" isn't a year/);
  assert.match(err("Lisbon\nMadrid"), /Add a date to at least one line/);
  assert.match(err(""), /at least one city/);
  assert.match(err("# only a comment"), /at least one city/);
  assert.match(err(42 as unknown as string), /at least one city/);
  assert.match(err("Paris, Narnia | 2026-01-01"), /in "Narnia"/);
});

test("findCity reports ambiguity instead of guessing across countries", () => {
  const r = findCity("Córdoba");
  if (!r.ok) assert.match(r.error, /matches places in .*Add the country/);
  else assert.ok(r.city.name.startsWith("C"), "only one Córdoba in the list is fine too");
});

test("English names find cities listed under their local name, and keep the English spelling", () => {
  const v = ok("Copenhagen | 2026-05-04\nMunich | 2026-06-01 | train\nVienna | 2026-07-01 | train\nKøbenhavn | 2026-08-01");
  assert.deepEqual(v.rows.map((r) => [r.city.name, r.city.iso3]), [["Copenhagen", "DNK"], ["Munich", "DEU"], ["Vienna", "AUT"], ["København", "DNK"]]);
});
