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
  toUnix,
} from "./equityChartModel.js";

const adaptivePoints = [
  { t: "2026-09-21T13:10:00Z", equity: 1950000 },
  { t: "2026-09-22T13:10:33.697900Z", equity: 1837991.6832610487 },
];
const seed = 1_500_000;

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

test("no seed → no synthetic point", () => {
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
