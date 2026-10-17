import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HISTORY_RESETS, PAPER_BLOCK2_SERIES_KEY, V6B1_SERIES_KEY } from "./historyReset.js";
import { CHART_MODE_KEYS, CHART_RANGE_KEYS, DEFAULT_CHART_MODE, DEFAULT_CHART_RANGE } from "./chartPrefs.js";
import {
  GAP_DAYS,
  backtestPointsFor,
  collapseDays,
  emaSeries,
  seriesKey,
  stitchCaption,
  stitchEquity,
} from "./stitchEquity.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backtests = JSON.parse(readFileSync(join(root, "public/data/backtests.json"), "utf8"));
const history = JSON.parse(readFileSync(join(root, "public/data/history.json"), "utf8"));
const OAC = { bot_id: "oac_paper", account_id: "oac_paper" };

function daily(start, n, step = 1) {
  const out = [];
  const t0 = Date.parse(`${start}T00:00:00Z`);
  for (let i = 0; i < n; i += 1) {
    const day = new Date(t0 + i * 86400000).toISOString().slice(0, 10);
    out.push({ t: day, equity: 100 + i * step });
  }
  return out;
}

test("collapse keeps the last print of a day", () => {
  const rows = collapseDays([
    { t: "2024-01-02T10:00:00Z", equity: 10 },
    { t: "2024-01-02T18:00:00Z", equity: 12 },
    { t: "2024-01-03T00:00:00Z", equity: 11 },
  ]);
  assert.deepEqual(rows, [
    { day: "2024-01-02", eq: 12 },
    { day: "2024-01-03", eq: 11 },
  ]);
});

test("stitch continues paper from the backtest level without a jump", () => {
  const backtest = daily("2020-01-01", 800, 0.1);
  const paper = [
    { t: "2022-03-11T12:00:00Z", equity: 10000 },
    { t: "2022-03-12T12:00:00Z", equity: 10100 },
  ];
  const st = stitchEquity(backtest, paper);
  assert.equal(st.ok, true);
  const paperRows = st.daily.filter((row) => row.segment === "paper");
  const before = st.daily.filter((row) => row.day < "2022-03-11").at(-1);
  assert.equal(paperRows[0].day, "2022-03-11");
  assert.ok(Math.abs(paperRows[0].eq - before.eq) < 1e-6);
  assert.ok(Math.abs(paperRows[1].eq / paperRows[0].eq - 1.01) < 1e-9);
  assert.equal(st.monthly.at(-1).segment, "paper");
  assert.ok(st.daily[99].ema100 != null);
  assert.equal(st.daily[98].ema100, null);
});

test("a hole longer than a week is not a seamless stitch", () => {
  const backtest = daily("2020-01-01", 40);
  const paper = [{ t: "2020-03-01T00:00:00Z", equity: 100 }];
  const st = stitchEquity(backtest, paper);
  assert.equal(st.ok, false);
  assert.equal(st.reason, "gap");
});

test("year on year needs the same month a year earlier, average needs 36 in a row", () => {
  const backtest = daily("2018-01-01", 1700, 0);
  for (let i = 0; i < backtest.length; i += 1) backtest[i].equity = 100 * 1.0002 ** i;
  const paper = [{ t: "2022-08-28T00:00:00Z", equity: 50 }];
  const st = stitchEquity(backtest, paper);
  assert.equal(st.ok, true);
  assert.ok(st.yoy.length > 40);
  assert.equal(st.yoy[0].sma36, null);
  const withSma = st.yoy.filter((row) => row.sma36 != null);
  assert.ok(withSma.length > 0);
  assert.ok(st.yoy.every((row) => row.yoy > 0));
});

test("ema span 100 matches a flat series", () => {
  const values = Array.from({ length: 120 }, () => 5);
  const ema = emaSeries(values, 100);
  assert.equal(ema[98], null);
  assert.equal(ema[99], 5);
  assert.equal(ema[119], 5);
});

test("backtests.json has only oac_paper — no invented other keys or points", () => {
  assert.equal(backtests.schema, "backtest_equity.v1");
  assert.deepEqual(Object.keys(backtests.series), ["oac_paper::oac_paper"]);
  assert.equal(seriesKey(OAC), "oac_paper::oac_paper");
  const pts = backtestPointsFor(backtests, OAC);
  assert.equal(pts.length, 481);
  assert.equal(pts[0].t, "2024-10-24");
  assert.equal(pts[0].equity, 10000);
  assert.equal(pts.at(-1).t, "2026-09-24");
  assert.equal(typeof pts[0].t, "string");
  assert.equal(typeof pts[0].equity, "number");
  assert.ok(pts.every((p) => p.t && Number(p.equity) > 0));
});

test("empty series: caption is Склейки нет: … and draws nothing", () => {
  const paper = [{ t: "2026-10-15T08:57:31Z", equity: 10000 }];
  const empty = stitchEquity(backtestPointsFor(backtests, { bot_id: "three_robots_okx_nasdaq_1h", account_id: "paper_block2" }), paper);
  assert.equal(empty.ok, false);
  assert.equal(empty.reason, "no_backtest");
  assert.equal(stitchCaption(empty), "Склейки нет: нет дневного бэктеста до старта бумаги.");

  const eth = stitchEquity(backtestPointsFor({ series: {} }, { bot_id: "eth_okx_moex", account_id: "eth_okx_moex" }), paper);
  assert.equal(eth.ok, false);
  assert.equal(stitchCaption(eth).startsWith("Склейки нет:"), true);

  const missing = stitchEquity(backtestPointsFor(null, { bot_id: "v6b1", account_id: "v6b1" }), paper);
  assert.equal(missing.ok, false);
  assert.equal(stitchCaption({ ok: false, reason: "no_paper" }), "Склейки нет: у бумаги ещё нет точек эквити.");
  assert.equal(stitchCaption({ ok: false, reason: "backtest_after_paper" }), "Склейки нет: бэктест начинается позже бумаги.");
});

test("oac_paper stitch from backtests.json + history.json: join ≤7d, yoy bars, no sma36", () => {
  const paper = history.series[seriesKey(OAC)]?.points;
  assert.ok(Array.isArray(paper) && paper.length >= 1);
  const st = stitchEquity(backtestPointsFor(backtests, OAC), paper);
  assert.equal(st.ok, true);
  assert.equal(st.joinDay, "2026-09-24");
  assert.equal(st.paperStart, "2026-09-25");
  const gapMs = Date.parse(`${st.paperStart}T00:00:00Z`) - Date.parse(`${st.joinDay}T00:00:00Z`);
  const gapDays = Math.round(gapMs / 86400000);
  assert.ok(gapDays <= GAP_DAYS);
  const paperRows = st.daily.filter((row) => row.segment === "paper");
  const before = st.daily.filter((row) => row.day < st.paperStart).at(-1);
  assert.ok(before);
  assert.ok(Math.abs(paperRows[0].eq - before.eq) < 1e-6);
  assert.ok(st.yoy.length >= 1, `yoy bars: ${st.yoy.length}`);
  assert.equal(st.yoy.every((row) => row.sma36 == null), true);
  assert.equal(st.yoy.some((row) => row.sma36 != null), false);
});

test("sync-equity.mjs does not write backtests.json", () => {
  const src = readFileSync(join(root, "scripts/sync-equity.mjs"), "utf8");
  const writes = [...src.matchAll(/writeFileSync\(([^,]+)/g)].map((m) => m[1]);
  assert.ok(writes.includes("historyPath"));
  assert.ok(writes.includes("latestPath"));
  assert.equal(writes.some((w) => /backtest/i.test(w)), false);
  assert.equal(/writeFileSync\([^)]*backtests/.test(src), false);
});

test("reset_from and chart v2 defaults are untouched", () => {
  assert.deepEqual(Object.keys(HISTORY_RESETS).sort(), [PAPER_BLOCK2_SERIES_KEY, V6B1_SERIES_KEY].sort());
  assert.equal(DEFAULT_CHART_MODE, "pct");
  assert.equal(DEFAULT_CHART_RANGE, "all");
  assert.equal(CHART_MODE_KEYS[0], "portfolio_krsk.chartMode.v2");
  assert.equal(CHART_RANGE_KEYS[0], "portfolio_krsk.chartRange.v2");
});
