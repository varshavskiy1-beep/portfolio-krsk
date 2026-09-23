import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHART_NEG,
  CHART_POS,
  DAY_SEC,
  buildSeries,
  chartSeriesColors,
  defaultChartRange,
  expandPriceRange,
  isAlreadySeed,
  isChartUpVsSeed,
  priceRangeIncludingSeed,
  lastEquityValue,
  resolveEquityPoints,
  toUnix,
} from "./equityChartModel.js";

const adaptivePoints = [
  { t: "2026-09-21T13:10:00Z", equity: 1950000 },
  { t: "2026-09-22T13:10:33.697900Z", equity: 1837991.6832610487 },
];
const seed = 1_500_000;

const staticPoints = [
  { t: "2026-09-19T03:58:39.659026Z", equity: 1508999.9999124017 },
  { t: "2026-09-19T13:20:39.618288Z", equity: 1500000 },
  { t: "2026-09-20T13:20:14.481711Z", equity: 1500000 },
  { t: "2026-09-21T13:21:16.771443Z", equity: 1500000 },
  { t: "2026-09-22T08:52:09.296331Z", equity: 1508999.9999124017 },
  { t: "2026-09-22T13:21:26.826825Z", equity: 1500499.9995284856 },
];

test("forts_adr_adaptive: prepends seed baseline so % starts at 0 and money at seed", () => {
  const firstReal = toUnix(adaptivePoints[0].t);
  const pct = buildSeries(adaptivePoints, seed, "pct");
  assert.equal(pct.length, 3);
  assert.equal(pct[0].time, firstReal - DAY_SEC);
  assert.equal(pct[0].value, 0);
  assert.ok(pct[1].value > 29 && pct[1].value < 31);
  assert.ok(pct[2].value > 22 && pct[2].value < 23);
  assert.ok(pct[1].value > pct[2].value, "последний отрезок всё ещё вниз");

  const money = buildSeries(adaptivePoints, seed, "money");
  assert.equal(money.length, 3);
  assert.equal(money[0].value, seed);
  assert.equal(money[1].value, 1950000);
  assert.ok(money[2].value > 1_830_000 && money[2].value < 1_840_000);
});

test("forts_adr_adaptive: last equity above seed stays green after prepend", () => {
  const pct = buildSeries(adaptivePoints, seed, "pct");
  assert.equal(isChartUpVsSeed(pct, seed, "pct"), true);
  assert.equal(chartSeriesColors(true).lineColor, CHART_POS.lineColor);

  const money = buildSeries(adaptivePoints, seed, "money");
  assert.equal(isChartUpVsSeed(money, seed, "money"), true);
});

test("short series (adaptive) defaults to «Всё» so seed stays in view", () => {
  const pct = buildSeries(adaptivePoints, seed, "pct");
  assert.equal(defaultChartRange(pct), "all");
});

test("history longer than 1M defaults to 1m", () => {
  const points = [
    { t: "2026-07-01T00:00:00Z", equity: 1_600_000 },
    { t: "2026-09-22T00:00:00Z", equity: 1_800_000 },
  ];
  const series = buildSeries(points, seed, "money");
  assert.ok(series.length >= 3, "seed prepended before July");
  assert.equal(defaultChartRange(series), "1m");
});

test("does not prepend when first point is already at seed", () => {
  const points = [
    { t: "2026-09-01T00:00:00Z", equity: seed },
    { t: "2026-09-22T00:00:00Z", equity: 1_800_000 },
  ];
  const money = buildSeries(points, seed, "money");
  assert.equal(money.length, 2);
  assert.equal(money[0].value, seed);
  assert.equal(money[0].time, toUnix(points[0].t));
});

test("always prepends baseline unless first point is already seed", () => {
  assert.equal(isAlreadySeed(9994, 10_000), false);
  const points = [
    { t: "2026-09-19T00:00:00Z", equity: 9994 },
    { t: "2026-09-22T00:00:00Z", equity: 12721 },
  ];
  const money = buildSeries(points, 10_000, "money");
  assert.equal(money.length, 3);
  assert.equal(money[0].value, 10_000);
  assert.equal(money[1].value, 9994);
});

test("Y-axis range includes seed even when visible window is only the peak", () => {
  const windowOnly = { minValue: 1_830_000, maxValue: 1_960_000 };
  const money = expandPriceRange(windowOnly, seed, "money");
  assert.equal(money.minValue, seed);
  assert.equal(money.maxValue, 1_960_000);

  const pctWindow = { minValue: 22, maxValue: 31 };
  const pct = expandPriceRange(pctWindow, seed, "pct");
  assert.equal(pct.minValue, 0);
  assert.equal(pct.maxValue, 31);

  const series = buildSeries(adaptivePoints, seed, "money");
  const full = priceRangeIncludingSeed(series, seed, "money");
  assert.equal(full.minValue, seed);
  assert.ok(full.maxValue >= 1_950_000);
});

test("pct mode expandPriceRange pins 0%", () => {
  const pct = expandPriceRange({ minValue: 22.53, maxValue: 30 }, seed, "pct");
  assert.equal(pct.minValue, 0);
});

test("no seed → no synthetic point on multi-point series", () => {
  const money = buildSeries(adaptivePoints, null, "money");
  assert.equal(money.length, 2);
  assert.equal(money[0].value, 1950000);
});

test("below seed stays red even if the later window slopes up", () => {
  const points = [
    { t: "2026-09-01T00:00:00Z", equity: 1_200_000 },
    { t: "2026-09-22T00:00:00Z", equity: 1_400_000 },
  ];
  const pct = buildSeries(points, seed, "pct");
  assert.equal(pct[0].value, 0);
  assert.ok(pct[pct.length - 1].value < 0);
  assert.ok(pct[pct.length - 1].value > pct[1].value, "реальные точки идут вверх");
  assert.equal(isChartUpVsSeed(pct, seed, "pct"), false);
  assert.equal(isChartUpVsSeed(buildSeries(points, seed, "money"), seed, "money"), false);
  assert.equal(chartSeriesColors(false).lineColor, CHART_NEG.lineColor);
});

test("exactly at seed is green — same as header delta >= 0", () => {
  const points = [
    { t: "2026-09-01T00:00:00Z", equity: 1_800_000 },
    { t: "2026-09-22T00:00:00Z", equity: seed },
  ];
  assert.equal(isChartUpVsSeed(buildSeries(points, seed, "pct"), seed, "pct"), true);
  assert.equal(isChartUpVsSeed(buildSeries(points, seed, "money"), seed, "money"), true);
});

test("color follows seed, not the last drawdown leg", () => {
  const pct = buildSeries(adaptivePoints, seed, "pct");
  const lastLegUp = pct[pct.length - 1].value >= pct[pct.length - 2].value;
  assert.equal(lastLegUp, false);
  assert.equal(isChartUpVsSeed(pct, seed, "pct"), true);
});

test("forts_adr_static: six history points stay drawable and include seed on axis", () => {
  const money = buildSeries(staticPoints, seed, "money");
  assert.ok(money.length >= 6);
  assert.equal(money[0].value, seed);
  const range = priceRangeIncludingSeed(money, seed, "money");
  assert.equal(range.minValue, seed);
  assert.ok(range.maxValue >= 1_508_000);
  assert.equal(isChartUpVsSeed(money, seed, "money"), true);
});

test("paper_block2: one point at seed still draws a horizontal", () => {
  const points = [{ t: "2026-09-21T14:11:01Z", equity: 10_000 }];
  const money = buildSeries(points, 10_000, "money");
  assert.equal(money.length, 2);
  assert.equal(money[0].value, 10_000);
  assert.equal(money[1].value, 10_000);
  assert.equal(money[1].time - money[0].time, DAY_SEC);
  assert.equal(isChartUpVsSeed(money, 10_000, "money"), true);
  const pct = buildSeries(points, 10_000, "pct");
  assert.equal(pct.length, 2);
  assert.equal(pct[0].value, 0);
  assert.equal(pct[1].value, 0);
});

test("single point above seed draws seed → fact", () => {
  const points = [{ t: "2026-09-21T00:00:00Z", equity: 12_000 }];
  const money = buildSeries(points, 10_000, "money");
  assert.equal(money.length, 2);
  assert.equal(money[0].value, 10_000);
  assert.equal(money[1].value, 12_000);
});

test("flat range around seed is padded so Area has height", () => {
  const flat = expandPriceRange({ minValue: seed, maxValue: seed }, seed, "money");
  assert.ok(flat.minValue < seed);
  assert.ok(flat.maxValue > seed);
});

test("resolveEquityPoints prefers non-empty equity_curve, else history", () => {
  const account = { bot_id: "forts_adr_static", account_id: "forts_adr_static", equity_curve: [] };
  const history = {
    series: {
      "forts_adr_static::forts_adr_static": { points: staticPoints },
    },
  };
  assert.equal(resolveEquityPoints(account, history).length, 6);
  assert.deepEqual(
    resolveEquityPoints({ ...account, equity_curve: [{ t: "x", equity: 1 }] }, history),
    [{ t: "x", equity: 1 }],
  );
  assert.deepEqual(resolveEquityPoints({ ...account, no_data: true }, history), []);
});

test("young bounce: equity series at seed stays on 10000, no fake zero", () => {
  const points = [
    { t: "2026-09-21T00:00:00Z", equity: 10000 },
    { t: "2026-09-22T00:00:00Z", equity: 10000 },
  ];
  const money = buildSeries(points, 10000, "money");
  assert.equal(money.length, 2);
  assert.equal(money[0].value, 10000);
  assert.equal(money[1].value, 10000);
  assert.ok(money.every((p) => p.value !== 0));
  assert.equal(isChartUpVsSeed(money, 10000, "money"), true);
});

test("resolveEquityPoints uses equity field when it is a series", () => {
  const series = [
    { t: "2026-09-22T00:00:00Z", equity: 10000 },
    { t: "2026-09-23T00:00:00Z", equity: 10000 },
  ];
  const account = {
    bot_id: "young_bounce_combo",
    account_id: "young_bounce_combo",
    equity: series,
    seed: "10000",
    positions: [],
  };
  assert.deepEqual(resolveEquityPoints(account, null), series);
  assert.equal(lastEquityValue(account), 10000);
});

test("error + empty equity yields no chart points (not a zero line)", () => {
  const account = {
    bot_id: "young_bounce_combo",
    account_id: "young_bounce_combo",
    error: "feed timeout",
    equity: [],
    seed: "10000",
  };
  assert.deepEqual(resolveEquityPoints(account, { series: {} }), []);
  assert.deepEqual(buildSeries([], 10000, "money"), []);
  assert.equal(lastEquityValue(account), null);
});

test("lastEquityValue reads scalar or last series point", () => {
  assert.equal(lastEquityValue({ equity: "10000" }), 10000);
  assert.equal(
    lastEquityValue({
      equity: [
        { t: "a", equity: 10000 },
        { t: "b", equity: 10125.5 },
      ],
    }),
    10125.5,
  );
  assert.equal(lastEquityValue({ equity: [] }), null);
  assert.equal(lastEquityValue(null), null);
});
