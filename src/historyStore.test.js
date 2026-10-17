import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  EMPTY_HISTORY,
  HISTORY_POINT_CAP,
  capHistoryPoints,
  loadHistoryFile,
  writeJsonAtomic,
} from "./historyStore.js";

const here = path.dirname(fileURLToPath(import.meta.url));

test("P09: missing history file is empty; broken JSON throws and does not write", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hist-"));
  const missing = path.join(dir, "no-such.json");
  const empty = loadHistoryFile(missing);
  assert.equal(empty.schema, EMPTY_HISTORY.schema);
  assert.deepEqual(empty.series, {});

  const broken = path.join(dir, "history.json");
  fs.writeFileSync(broken, "{");
  assert.throws(() => loadHistoryFile(broken), SyntaxError);
  assert.equal(fs.readFileSync(broken, "utf8"), "{");
});

test("P09: writeJsonAtomic uses a temp file, keeps a .bak, then renames", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hist-"));
  const file = path.join(dir, "history.json");
  fs.writeFileSync(file, '{"old":true}');
  writeJsonAtomic(file, { schema: "equity_history.v1", series: { a: 1 } });
  const written = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(written.schema, "equity_history.v1");
  assert.equal(fs.readFileSync(`${file}.bak`, "utf8"), '{"old":true}');
  assert.equal(fs.readdirSync(dir).some((name) => name.endsWith(".tmp")), false);
});

test("P10: over the cap, the start is kept instead of slicing off the first point", () => {
  const points = [];
  const t0 = Date.parse("2026-01-01T00:00:00Z");
  for (let i = 0; i < HISTORY_POINT_CAP + 1; i += 1) {
    points.push({
      t: new Date(t0 + i * 60_000).toISOString(),
      equity: 10000 + i,
    });
  }
  const capped = capHistoryPoints(points);
  assert.ok(capped.length <= HISTORY_POINT_CAP);
  assert.equal(capped[0].t, points[0].t);
  assert.notEqual(capped[0].t, points[1].t);
  assert.equal(capped[capped.length - 1].t, points[points.length - 1].t);
});

test("P10: a long book thins old days to one print and keeps a dense tail plus the start", () => {
  const points = [];
  const t0 = Date.parse("2026-01-01T00:00:00Z");
  for (let d = 0; d < 20; d += 1) {
    for (let m = 0; m < 1200; m += 1) {
      points.push({
        t: new Date(t0 + (d * 1440 + m) * 60_000).toISOString(),
        equity: 10000 + d * 1200 + m,
      });
    }
  }
  assert.ok(points.length > HISTORY_POINT_CAP);
  const capped = capHistoryPoints(points);
  assert.ok(capped.length <= HISTORY_POINT_CAP);
  assert.equal(capped[0].t, points[0].t);
  assert.equal(capped[capped.length - 1].t, points[points.length - 1].t);
  const firstDay = capped.filter((p) => p.t.startsWith("2026-01-01"));
  assert.ok(firstDay.length >= 1);
  assert.ok(firstDay.length <= 2);
  const lastDay = capped.filter((p) => p.t.startsWith("2026-01-20"));
  assert.ok(lastDay.length > 2, "recent day stays dense");
});

test("P09: sync-equity no longer falls back from broken JSON to an empty history", () => {
  const src = fs.readFileSync(path.join(here, "../scripts/sync-equity.mjs"), "utf8");
  assert.doesNotMatch(src, /function loadJson\(p, fallback\)/);
  assert.match(src, /loadHistoryFile\(historyPath\)/);
  assert.match(src, /writeJsonAtomic\(historyPath/);
  assert.match(src, /capHistoryPoints/);
});
