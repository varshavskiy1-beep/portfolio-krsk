import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HISTORY_RESETS, PAPER_BLOCK2_SERIES_KEY, V6B1_SERIES_KEY } from "./historyReset.js";
import { CHART_MODE_KEYS, CHART_RANGE_KEYS, DEFAULT_CHART_MODE, DEFAULT_CHART_RANGE } from "./chartPrefs.js";
import {
  STITCH_COPY,
  STITCH_EMPTY_LINE,
  average36m,
  lookupStitchPack,
  resolveStitchModel,
  stitchCopyValues,
  stitchView,
  yoyFromMonthly,
} from "./stitchEquity.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backtests = JSON.parse(readFileSync(join(root, "public/data/backtests.json"), "utf8"));

test("backtests.json series is empty — no invented rows", () => {
  assert.equal(backtests.schema, "equity_stitch.v1");
  assert.deepEqual(backtests.series, {});
  assert.equal(Object.keys(backtests.series).length, 0);
});

test("empty series: stitchView is Склейки нет and draws nothing", () => {
  const view = stitchView(backtests, "three_robots_okx_nasdaq_1h", "paper_block2");
  assert.equal(view.empty, true);
  assert.equal(view.message, STITCH_EMPTY_LINE);
  assert.equal(view.message, "Склейки нет");
  assert.deepEqual(view.lines, []);
  assert.deepEqual(view.yoy, []);
  assert.equal(view.avg36, null);

  const eth = stitchView({ series: {} }, "eth_okx_moex", "eth_okx_moex");
  assert.equal(eth.empty, true);
  assert.equal(eth.lines.length, 0);

  const missing = stitchView(null, "v6b1", "v6b1");
  assert.equal(missing.empty, true);
});

test("empty arrays in a pack are not drawn", () => {
  const view = resolveStitchModel({
    stitch: [],
    paper: [],
    ema100: [],
    growth_12m: [],
  });
  assert.equal(view.empty, true);
  assert.equal(view.message, "Склейки нет");
  assert.equal(view.lines.length, 0);
});

test("a single point is not a drawable line", () => {
  const view = resolveStitchModel({
    stitch: [{ t: "2026-01-01", equity: 10000 }],
    paper: [{ t: "2026-01-01", equity: 10000 }],
  });
  assert.equal(view.empty, true);
  assert.equal(view.lines.length, 0);
});

test("lookup prefers bot::account then bot_id", () => {
  const pack = { stitch: [{ t: "2024-01-01", equity: 1 }, { t: "2024-02-01", equity: 2 }] };
  const bt = {
    series: {
      "eth_okx_moex::eth_okx_moex": pack,
      other: { stitch: [] },
    },
  };
  assert.equal(lookupStitchPack(bt, "eth_okx_moex", "eth_okx_moex"), pack);
  assert.equal(lookupStitchPack(bt, "v6b1", "v6b1"), null);
});

test("does not invent a line when the bot key is absent even if another series exists", () => {
  const view = stitchView(
    {
      series: {
        someone_else: {
          stitch: [
            { t: "2024-01-01", equity: 100 },
            { t: "2024-02-01", equity: 110 },
          ],
        },
      },
    },
    "v6b1",
    "v6b1",
  );
  assert.equal(view.empty, true);
  assert.equal(view.lines.length, 0);
});

test("provided monthly stitch and paper become drawable lines; empty ema is skipped", () => {
  const pts = [];
  const start = Date.parse("2024-01-01T00:00:00Z");
  for (let i = 0; i < 14; i += 1) {
    const d = new Date(start);
    d.setUTCMonth(d.getUTCMonth() + i);
    pts.push({ t: d.toISOString().slice(0, 10), equity: 10000 + i * 100 });
  }
  const view = resolveStitchModel({
    stitch: pts,
    paper: pts.slice(-4),
    ema100: [],
  });
  assert.equal(view.empty, false);
  assert.equal(view.lines.some((l) => l.id === "stitch"), true);
  assert.equal(view.lines.some((l) => l.id === "paper"), true);
  assert.equal(view.lines.some((l) => l.id === "ema"), false);
  assert.ok(view.yoy.length >= 1);
});

test("12-month growth and 36-month average come from given points, not invented equity", () => {
  const monthly = [];
  const start = Date.parse("2020-01-01T00:00:00Z");
  for (let i = 0; i < 50; i += 1) {
    const d = new Date(start);
    d.setUTCMonth(d.getUTCMonth() + i);
    monthly.push({ t: d.toISOString().slice(0, 10), equity: 100 * (1.01 ** i) });
  }
  const yoy = yoyFromMonthly(monthly);
  assert.ok(yoy.length >= 24);
  const avg = average36m(yoy);
  assert.equal(typeof avg, "number");
  assert.ok(avg > 0);
  const short = yoyFromMonthly(monthly.slice(0, 5));
  assert.deepEqual(short, []);
  assert.equal(average36m(yoy.slice(0, 10)), null);
});

test("UI copy is Russian and has no English words", () => {
  assert.equal(STITCH_COPY.empty, "Склейки нет");
  assert.equal(STITCH_COPY.title, "Помесячная склейка");
  for (const s of stitchCopyValues()) {
    assert.doesNotMatch(s, /\bseed\b/i, s);
    assert.doesNotMatch(s, /\b(stitch|backtest|paper|chart|empty|histogram|average)\b/i, s);
    assert.doesNotMatch(s, /[A-Za-z]{2,}/, s);
  }
});

test("reset_from and chart v2 defaults are untouched", () => {
  assert.deepEqual(Object.keys(HISTORY_RESETS).sort(), [PAPER_BLOCK2_SERIES_KEY, V6B1_SERIES_KEY].sort());
  assert.equal(DEFAULT_CHART_MODE, "pct");
  assert.equal(DEFAULT_CHART_RANGE, "all");
  assert.equal(CHART_MODE_KEYS[0], "portfolio_krsk.chartMode.v2");
  assert.equal(CHART_RANGE_KEYS[0], "portfolio_krsk.chartRange.v2");
});
