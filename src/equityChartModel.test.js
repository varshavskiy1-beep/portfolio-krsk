import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHART_NEG,
  CHART_POS,
  buildSeries,
  chartSeriesColors,
  isChartUpVsSeed,
} from "./equityChartModel.js";

const adaptivePoints = [
  { t: "2026-09-21T13:10:00Z", equity: 1950000 },
  { t: "2026-09-22T13:10:33.697900Z", equity: 1837991.6832610487 },
];
const seed = 1_500_000;

test("forts_adr_adaptive: window slopes down but last equity is above seed → green", () => {
  const pct = buildSeries(adaptivePoints, seed, "pct");
  assert.ok(pct[0].value > pct[pct.length - 1].value, "окно 1М реально вниз");
  assert.ok(pct[pct.length - 1].value > 22 && pct[pct.length - 1].value < 23);
  assert.equal(isChartUpVsSeed(pct, seed, "pct"), true);
  assert.equal(chartSeriesColors(true).lineColor, CHART_POS.lineColor);

  const money = buildSeries(adaptivePoints, seed, "money");
  assert.ok(money[0].value > money[money.length - 1].value);
  assert.equal(isChartUpVsSeed(money, seed, "money"), true);
});

test("below seed stays red even if the visible window slopes up", () => {
  const points = [
    { t: "2026-09-01T00:00:00Z", equity: 1_200_000 },
    { t: "2026-09-22T00:00:00Z", equity: 1_400_000 },
  ];
  const pct = buildSeries(points, seed, "pct");
  assert.ok(pct[pct.length - 1].value > pct[0].value);
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

test("old first→last rule would paint adaptive red — we do not use it", () => {
  const pct = buildSeries(adaptivePoints, seed, "pct");
  const oldUp = pct[pct.length - 1].value >= pct[0].value;
  assert.equal(oldUp, false);
  assert.equal(isChartUpVsSeed(pct, seed, "pct"), true);
});
