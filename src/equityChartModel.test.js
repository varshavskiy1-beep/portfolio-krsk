import { test } from "node:test";
import assert from "node:assert/strict";
import { PCT_BASE_FROM_FIRST_POINT, PCT_NO_POSITIVE_SEED } from "./feedValidate.js";
import {
  CHART_NEG,
  CHART_POS,
  buildSeries,
  chartSeriesColors,
  defaultChartRange,
  expandPriceRange,
  feedSeedMissing,
  formatChartPctLabel,
  isAlreadySeed,
  isChartUpVsSeed,
  lastEquityValue,
  normalizePoints,
  pctModeUnavailable,
  priceRangeIncludingSeed,
  resolveChartBase,
  resolveEquityPoints,
  seedPriceLineSpec,
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

test("forts_adr_adaptive: uses only real points; seed is a reference line, not a fake day", () => {
  const firstReal = toUnix(adaptivePoints[0].t);
  const pct = buildSeries(adaptivePoints, seed, "pct");
  assert.equal(pct.length, 2);
  assert.equal(pct[0].time, firstReal);
  assert.ok(pct[0].value > 29 && pct[0].value < 31);
  assert.ok(pct[1].value > 22 && pct[1].value < 23);
  assert.ok(pct[0].value > pct[1].value, "последний отрезок всё ещё вниз");
  assert.deepEqual(seedPriceLineSpec(seed, "pct"), { price: 0, title: "начальный капитал" });

  const money = buildSeries(adaptivePoints, seed, "money");
  assert.equal(money.length, 2);
  assert.equal(money[0].time, firstReal);
  assert.equal(money[0].value, 1950000);
  assert.ok(money[1].value > 1_830_000 && money[1].value < 1_840_000);
  assert.deepEqual(seedPriceLineSpec(seed, "money"), { price: seed, title: "начальный капитал" });
});

test("P02: a single observation is not padded with a synthetic seed day", () => {
  const input = [{ t: "2026-10-17T10:00:00Z", equity: 120 }];
  const result = buildSeries(input, 100, "money");
  assert.equal(result.length, 1);
  assert.equal(result[0].time, toUnix(input[0].t));
  assert.equal(result[0].value, 120);
  assert.notEqual(result[0].time, toUnix(input[0].t) - 86400);
  assert.deepEqual(seedPriceLineSpec(100, "money"), { price: 100, title: "начальный капитал" });
});

test("P03: Infinity JSON string is dropped; zero seed blocks percent mode", () => {
  const input = JSON.parse('[{"t":"2026-10-17T10:00:00Z","equity":"Infinity"}]');
  assert.equal(normalizePoints(input).length, 0);
  assert.equal(pctModeUnavailable(0, "pct"), true);
  assert.equal(pctModeUnavailable(100, "pct"), false);
  assert.equal(pctModeUnavailable(0, "money"), false);
  assert.deepEqual(buildSeries([{ t: "2026-10-17", equity: 0 }], 0, "pct"), []);
  const money = buildSeries([{ t: "2026-10-17", equity: 0 }], 0, "money");
  assert.equal(money.length, 1);
  assert.equal(money[0].value, 0);
  assert.ok(money.every((row) => Number.isFinite(row.value)));
  assert.equal(PCT_NO_POSITIVE_SEED, "Доходность не рассчитана: нет положительного начального капитала");
  const blockedZero = resolveChartBase(
    { bot_id: "x", account_id: "x", seed: 0 },
    [{ t: "2026-10-17", equity: 100 }],
    { series: { "x::x": { initial_equity: 15000 } } },
  );
  assert.equal(blockedZero.base, null);
  assert.equal(blockedZero.caption, null);
  assert.equal(pctModeUnavailable(blockedZero.base, "pct"), true);
  assert.deepEqual(buildSeries([{ t: "2026-10-17", equity: 100 }], blockedZero.base, "pct"), []);
  const weirdSeed = { bot_id: "x", account_id: "x", seed: "Infinity" };
  const blockedNaN = resolveChartBase(weirdSeed, [{ t: "2026-10-17", equity: 100 }], null);
  assert.equal(feedSeedMissing(weirdSeed), false);
  assert.equal(blockedNaN.base, null);
  assert.equal(pctModeUnavailable(blockedNaN.base, "pct"), true);
});

test("forts_adr_adaptive: last equity above seed stays green without a fake start point", () => {
  const pct = buildSeries(adaptivePoints, seed, "pct");
  assert.equal(isChartUpVsSeed(pct, seed, "pct"), true);
  assert.equal(chartSeriesColors(true).lineColor, CHART_POS.lineColor);

  const money = buildSeries(adaptivePoints, seed, "money");
  assert.equal(isChartUpVsSeed(money, seed, "money"), true);
});

test("percent axis labels use a Russian comma and never say seed", () => {
  assert.equal(formatChartPctLabel(22.451), "+22,45%");
  assert.equal(formatChartPctLabel(0), "+0,00%");
  assert.match(formatChartPctLabel(-5.6), /−5,60%|-5,60%/);
  assert.doesNotMatch(formatChartPctLabel(13.1), /\./);
  assert.doesNotMatch(formatChartPctLabel(13.1), /seed/i);
});

test("short series (adaptive) defaults to «Всё» so the seed line stays in view", () => {
  const pct = buildSeries(adaptivePoints, seed, "pct");
  assert.equal(defaultChartRange(pct), "all");
});

test("history longer than 1M still defaults to «Всё»", () => {
  const points = [
    { t: "2026-07-01T00:00:00Z", equity: 1_600_000 },
    { t: "2026-09-22T00:00:00Z", equity: 1_800_000 },
  ];
  const series = buildSeries(points, seed, "money");
  assert.equal(series.length, 2);
  assert.equal(series[0].time, toUnix(points[0].t));
  assert.equal(defaultChartRange(series), "all");
  assert.equal(defaultChartRange(buildSeries(points, seed, "pct")), "all");
});

test("first real point at seed is kept as-is, without an extra day", () => {
  const points = [
    { t: "2026-09-01T00:00:00Z", equity: seed },
    { t: "2026-09-22T00:00:00Z", equity: 1_800_000 },
  ];
  const money = buildSeries(points, seed, "money");
  assert.equal(money.length, 2);
  assert.equal(money[0].value, seed);
  assert.equal(money[0].time, toUnix(points[0].t));
});

test("does not invent a seed observation when the first print differs from seed", () => {
  assert.equal(isAlreadySeed(9994, 10_000), false);
  const points = [
    { t: "2026-09-19T00:00:00Z", equity: 9994 },
    { t: "2026-09-22T00:00:00Z", equity: 12721 },
  ];
  const money = buildSeries(points, 10_000, "money");
  assert.equal(money.length, 2);
  assert.equal(money[0].value, 9994);
  assert.equal(money[0].time, toUnix(points[0].t));
  assert.equal(seedPriceLineSpec(10_000, "money").price, 10_000);
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
  assert.ok(pct[0].value < 0);
  assert.ok(pct[pct.length - 1].value < 0);
  assert.ok(pct[pct.length - 1].value > pct[0].value, "реальные точки идут вверх");
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
  assert.equal(money.length, 6);
  assert.equal(money[0].value, staticPoints[0].equity);
  const range = priceRangeIncludingSeed(money, seed, "money");
  assert.equal(range.minValue, seed);
  assert.ok(range.maxValue >= 1_508_000);
  assert.equal(isChartUpVsSeed(money, seed, "money"), true);
});

test("paper_block2: one point at seed is a 0% marker, not a two-point fake line", () => {
  const points = [{ t: "2026-10-15T08:57:31Z", equity: 10_000 }];
  const money = buildSeries(points, 10_000, "money");
  assert.equal(money.length, 1);
  assert.equal(money[0].value, 10_000);
  assert.equal(isChartUpVsSeed(money, 10_000, "money"), true);
  const pct = buildSeries(points, 10_000, "pct");
  assert.equal(pct.length, 1);
  assert.equal(pct[0].value, 0);
});

test("single point above seed keeps the fact; seed is only a price line", () => {
  const points = [{ t: "2026-09-21T00:00:00Z", equity: 12_000 }];
  const money = buildSeries(points, 10_000, "money");
  assert.equal(money.length, 1);
  assert.equal(money[0].value, 12_000);
  assert.equal(seedPriceLineSpec(10_000, "money").price, 10_000);
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

test("oac paper: scalar equity at seed draws line at 10000, not zero", () => {
  const account = {
    bot_id: "oac_paper",
    account_id: "oac_paper",
    equity: "10000.0",
    seed: "10000",
    updated_utc: "2026-09-25T14:34:39Z",
    as_of: "2026-09-24",
    positions: [],
  };
  const points = resolveEquityPoints(account, null);
  assert.equal(points.length, 1);
  assert.equal(lastEquityValue(account), 10000);
  const money = buildSeries(points, 10000, "money");
  assert.ok(money.every((p) => p.value !== 0));
  assert.equal(isChartUpVsSeed(money, 10000, "money"), true);
});

test("oac paper: error + empty equity yields no chart points", () => {
  const account = {
    bot_id: "oac_paper",
    account_id: "oac_paper",
    error: "ledger_missing",
    equity: [],
    seed: "10000",
  };
  assert.deepEqual(resolveEquityPoints(account, { series: {} }), []);
  assert.equal(lastEquityValue(account), null);
});

test("desyatka: scalar equity uses main NAV, not shadow sit/qqq/spy", () => {
  const account = {
    bot_id: "desyatka_earn_paper",
    account_id: "desyatka_earn_paper",
    equity: "10000.0",
    seed: "10000",
    sit: "9900",
    earn_boxx: "10100",
    qqq_x14: "14000",
    qqq: "480",
    spy: "670",
    updated_utc: "2026-09-30T00:00:00Z",
    as_of: "2026-09-29",
  };
  assert.equal(lastEquityValue(account), 10000);
  const points = resolveEquityPoints(account, null);
  assert.equal(points.length, 1);
  assert.equal(Number(points[0].equity), 10000);
  const money = buildSeries(points, 10000, "money");
  assert.ok(money.every((p) => p.value !== 0));
  assert.equal(money[money.length - 1].value, 10000);
});

test("desyatka: empty positions with equity=cash=10000 is a live cash book", () => {
  const account = {
    bot_id: "desyatka_earn_paper",
    account_id: "desyatka_earn_paper",
    equity: "10000",
    cash: "10000",
    seed: "10000",
    positions: [],
    updated_utc: "2026-09-30T05:04:14Z",
    next_rebalance: "2026-10-06",
  };
  assert.equal(lastEquityValue(account), 10000);
  const points = resolveEquityPoints(account, null);
  assert.equal(points.length, 1);
  assert.equal(Number(points[0].equity), 10000);
  const money = buildSeries(points, 10000, "money");
  assert.equal(money[money.length - 1].value, 10000);
  assert.ok(!money.some((p) => p.value === 100000));
});

test("desyatka: error + empty equity yields no chart points and no invented seed line", () => {
  const account = {
    bot_id: "desyatka_earn_paper",
    account_id: "desyatka_earn_paper",
    error: "ledger_missing",
    equity: [],
    seed: "10000",
    sit: "10000",
  };
  assert.deepEqual(resolveEquityPoints(account, { series: {} }), []);
  assert.equal(lastEquityValue(account), null);
  assert.deepEqual(buildSeries([], 10000, "money"), []);
});

test("cycle 60/40: main NAV only, never nav_model / nav_lqdt", () => {
  const account = {
    bot_id: "cycle_6040_paper",
    account_id: "cycle_6040_paper",
    equity: "1000000",
    seed: "1000000",
    nav_model: "1012500",
    nav_lqdt: "998000",
    updated_utc: "2026-10-01T04:00:00Z",
    as_of: "2026-10-01",
  };
  assert.equal(lastEquityValue(account), 1_000_000);
  const points = resolveEquityPoints(account, null);
  assert.equal(points.length, 1);
  assert.equal(Number(points[0].equity), 1_000_000);
  const money = buildSeries(points, 1_000_000, "money");
  assert.ok(money.every((p) => p.value !== 1_012_500));
  assert.ok(money.every((p) => p.value !== 998_000));
  assert.equal(money[money.length - 1].value, 1_000_000);
});

test("cycle 60/40: absent / no_data yields no chart and no invented 1e6 line", () => {
  const shell = {
    bot_id: "cycle_6040_paper",
    account_id: "cycle_6040_paper",
    currency: "RUB",
    seed: "1000000",
    no_data: true,
  };
  assert.deepEqual(resolveEquityPoints(shell, { series: {} }), []);
  assert.equal(lastEquityValue({ equity: [] }), null);
  assert.deepEqual(buildSeries([], 1_000_000, "money"), []);
});

test("rf conservative: main NAV only, never shadow fields", () => {
  const account = {
    bot_id: "rf_conservative_comon",
    account_id: "rf_conservative_comon",
    equity: "50000",
    seed: "50000",
    nav_model: "51200",
    nav_lqdt: "49800",
    updated_utc: "2026-10-01T04:00:00Z",
    as_of: "2026-10-01",
  };
  assert.equal(lastEquityValue(account), 50_000);
  const points = resolveEquityPoints(account, null);
  assert.equal(points.length, 1);
  assert.equal(Number(points[0].equity), 50_000);
  const money = buildSeries(points, 50_000, "money");
  assert.ok(money.every((p) => p.value !== 51_200));
  assert.ok(money.every((p) => p.value !== 49_800));
  assert.equal(money[money.length - 1].value, 50_000);
});

test("rf conservative: absent / no_data yields no chart and no invented 50000 line", () => {
  const shell = {
    bot_id: "rf_conservative_comon",
    account_id: "rf_conservative_comon",
    currency: "RUB",
    seed: "50000",
    no_data: true,
  };
  assert.deepEqual(resolveEquityPoints(shell, { series: {} }), []);
  assert.equal(lastEquityValue({ equity: [] }), null);
  assert.deepEqual(buildSeries([], 50_000, "money"), []);
});

test("rate-cycle 80/20: line comes only from account.history, one point stays drawable", () => {
  const account = {
    bot_id: "rf_bonds_rate_cycle",
    account_id: "rf_bonds_rate_cycle",
    currency: "RUB",
    equity: "300000.0",
    seed: "300000",
    history: [{ t: "2026-10-09", equity: "300000.0" }],
    positions: [{ symbol: "OBLG", side: "long", qty: "1136", avg_px: "211.1" }],
  };
  assert.equal(lastEquityValue(account), 300000);
  const points = resolveEquityPoints(account, {
    series: {
      "rf_bonds_rate_cycle::rf_bonds_rate_cycle": {
        points: [{ t: "2019-06-28", equity: "2.4419" }],
      },
    },
  });
  assert.equal(points.length, 1);
  assert.equal(Number(points[0].equity), 300000);
  const pct = buildSeries(points, 300000, "pct");
  assert.equal(pct.length, 1);
  assert.equal(pct[0].value, 0);

  const noHist = { ...account, history: [] };
  assert.deepEqual(resolveEquityPoints(noHist, null), []);

  const shell = {
    bot_id: "rf_bonds_rate_cycle",
    account_id: "rf_bonds_rate_cycle",
    currency: "RUB",
    no_data: true,
  };
  assert.deepEqual(resolveEquityPoints(shell, { series: {} }), []);
});

test("yuan 360: line comes only from account.history, one point stays drawable", () => {
  const account = {
    bot_id: "cny_mom_h360",
    account_id: "cny_mom_h360",
    currency: "RUB",
    equity: "300000.0",
    seed: "300000",
    history: [{ t: "2026-10-12", equity: "300000.0" }],
    positions: [{ symbol: "LQDT", side: "long", qty: "142429", avg_px: "2.1063" }],
  };
  assert.equal(lastEquityValue(account), 300000);
  const points = resolveEquityPoints(account, {
    series: {
      "cny_mom_h360::cny_mom_h360": {
        points: [{ t: "2025-01-01", equity: "12.75" }],
      },
    },
  });
  assert.equal(points.length, 1);
  assert.equal(Number(points[0].equity), 300000);
  const pct = buildSeries(points, 300000, "pct");
  assert.equal(pct.length, 1);
  assert.equal(pct[0].value, 0);

  const noHist = { ...account, history: [] };
  assert.deepEqual(resolveEquityPoints(noHist, null), []);

  const shell = {
    bot_id: "cny_mom_h360",
    account_id: "cny_mom_h360",
    currency: "RUB",
    no_data: true,
  };
  assert.deepEqual(resolveEquityPoints(shell, { series: {} }), []);
});

test("eth okx moex: line comes only from account.history, same-day last point wins", () => {
  const account = {
    bot_id: "eth_okx_moex",
    account_id: "eth_okx_moex",
    currency: "RUB",
    equity: "299970.19681904",
    seed: "300000",
    history: [
      { t: "2026-10-13", equity: "300000" },
      { t: "2026-10-13T05:45:00Z", equity: "299970.19681904" },
    ],
    positions: [{ symbol: "EHV6", side: "short", qty: "70", mark: "2536.7" }],
  };
  assert.equal(lastEquityValue(account), 299970.19681904);
  const points = resolveEquityPoints(account, {
    series: {
      "eth_okx_moex::eth_okx_moex": {
        points: [{ t: "2025-01-01", equity: "2.046839" }],
      },
    },
  });
  assert.equal(points.length, 1);
  assert.equal(points[0].t, "2026-10-13");
  assert.equal(Number(points[0].equity), 299970.19681904);
  assert.ok(points.every((p) => Number(p.equity) !== 2.046839));
  const pct = buildSeries(points, 300000, "pct");
  assert.equal(pct.length, 1);
  assert.ok(Math.abs(pct[0].value + 0.009934393653333) < 1e-9);

  const noHist = { ...account, history: [] };
  assert.deepEqual(resolveEquityPoints(noHist, null), []);

  const shell = {
    bot_id: "eth_okx_moex",
    account_id: "eth_okx_moex",
    currency: "RUB",
    no_data: true,
  };
  assert.deepEqual(resolveEquityPoints(shell, { series: {} }), []);
});

test("paper_block2: resolveEquityPoints drops pre-reset history and keeps 10000", () => {
  const account = {
    bot_id: "three_robots_okx_nasdaq_1h",
    account_id: "paper_block2",
    equity: "10000.00",
    seed: "10000",
    currency: "USDT",
    updated_utc: "2026-10-15T08:57:31Z",
    positions: [],
  };
  const points = resolveEquityPoints(account, {
    series: {
      "three_robots_okx_nasdaq_1h::paper_block2": {
        points: [
          { t: "2026-09-21T14:11:01Z", equity: 10000 },
          { t: "2026-10-14T19:09:46Z", equity: 8475.67 },
          { t: "2026-10-15T08:57:31Z", equity: 10000 },
        ],
      },
    },
  });
  assert.equal(points.length, 1);
  assert.equal(points[0].t, "2026-10-15T08:57:31Z");
  assert.equal(Number(points[0].equity), 10000);
  assert.ok(points.every((p) => Number(p.equity) !== 8475.67));
  const pct = buildSeries(points, 10000, "pct");
  assert.equal(pct.length, 1);
  assert.equal(pct[0].value, 0);
});

test("v6b1: resolveEquityPoints drops pre-reset history and keeps 10000", () => {
  const account = {
    bot_id: "v6b1",
    account_id: "v6b1",
    equity: "10000",
    seed: "10000",
    currency: "USDT",
    updated_utc: "2026-10-15T17:27:12Z",
    positions: [],
  };
  const points = resolveEquityPoints(account, {
    series: {
      "v6b1::v6b1": {
        points: [
          { t: "2026-09-19T03:58:23Z", equity: 9994 },
          { t: "2026-10-15T15:02:44Z", equity: 8106.48 },
          { t: "2026-10-15T17:27:12Z", equity: 10000 },
        ],
      },
    },
  });
  assert.equal(points.length, 1);
  assert.equal(points[0].t, "2026-10-15T17:27:12Z");
  assert.equal(Number(points[0].equity), 10000);
  assert.ok(points.every((p) => Number(p.equity) !== 8106.48));
  const pct = buildSeries(points, 10000, "pct");
  assert.equal(pct.length, 1);
  assert.equal(pct[0].value, 0);
});

test("mayak: main equity only, seed from feed, no invented line when absent", () => {
  const account = {
    bot_id: "mayak_imoex_mom10",
    account_id: "mayak_imoex_mom10",
    equity: "88000",
    seed: "85000",
    updated_utc: "2026-10-06T16:20:00Z",
    as_of: "2026-10-06",
  };
  assert.equal(lastEquityValue(account), 88_000);
  const points = resolveEquityPoints(account, null);
  assert.equal(points.length, 1);
  assert.equal(Number(points[0].equity), 88_000);
  const shell = {
    bot_id: "mayak_imoex_mom10",
    account_id: "mayak_imoex_mom10",
    currency: "RUB",
    no_data: true,
  };
  assert.deepEqual(resolveEquityPoints(shell, { series: {} }), []);
  assert.deepEqual(buildSeries([], 85_000, "money"), []);
});

test("missing seed uses first real history print as % base, no synthetic day", () => {
  const points = [
    { t: "2026-09-19T06:34:49Z", equity: 25000 },
    { t: "2026-10-17T15:14:47Z", equity: 24858.53 },
  ];
  const account = { bot_id: "who_pays", account_id: "paper_us_eq" };
  const resolved = resolveChartBase(account, points, { series: {} });
  assert.equal(feedSeedMissing(account), true);
  assert.equal(resolved.base, 25000);
  assert.equal(resolved.caption, PCT_BASE_FROM_FIRST_POINT);
  const pct = buildSeries(points, resolved.base, "pct");
  assert.equal(pct.length, 2);
  assert.equal(pct[0].time, toUnix(points[0].t));
  assert.notEqual(pct[0].time, toUnix(points[0].t) - 86400);
  assert.equal(pct[0].value, 0);
  assert.ok(pct[1].value < 0);
  const noPrint = resolveChartBase(account, [], null);
  assert.equal(noPrint.base, null);
  assert.equal(noPrint.caption, null);
  assert.equal(pctModeUnavailable(noPrint.base, "pct"), true);
  const zeroPrint = resolveChartBase(account, [{ t: "2026-09-19", equity: 0 }], null);
  assert.equal(zeroPrint.base, null);
  assert.equal(pctModeUnavailable(zeroPrint.base, "pct"), true);
  assert.deepEqual(buildSeries([{ t: "2026-09-19", equity: 0 }], zeroPrint.base, "pct"), []);
});

test("missing seed prefers backtest initial_equity over first print, no caption", () => {
  const points = [
    { t: "2026-09-19T06:34:49Z", equity: 14900.72 },
    { t: "2026-10-17T15:14:47Z", equity: 14998.1 },
  ];
  const account = { bot_id: "who_pays", account_id: "paper_crypto_perp" };
  const backtests = { series: { "who_pays::paper_crypto_perp": { initial_equity: 15000 } } };
  const resolved = resolveChartBase(account, points, backtests);
  assert.equal(resolved.base, 15000);
  assert.equal(resolved.caption, null);
  const pct = buildSeries(points, resolved.base, "pct");
  assert.equal(pct.length, 2);
  assert.ok(pct[0].value < 0);
  assert.ok(pct[0].value > -1);
  const seeded = resolveChartBase({ ...account, seed: "10000" }, points, backtests);
  assert.equal(seeded.base, 10000);
  assert.equal(seeded.caption, null);
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

test("«Всё»: длинный ряд без seed начинается с 0% и помещается в карточку", async () => {
  const { TIME_SCALE_MIN_BAR_SPACING, seriesFitsWidth } = await import("./equityChartModel.js");
  const start = Date.parse("2026-09-19T06:34:49Z");
  const points = [];
  for (let i = 0; i < 2823; i++) {
    points.push({ t: new Date(start + i * 15 * 60 * 1000).toISOString(), equity: 2000000 - i * 39 });
  }
  const account = { bot_id: "who_pays", account_id: "paper_ru_eq", equity: "1889892" };
  const { base, caption } = resolveChartBase(account, points, { series: {} });
  assert.equal(base, 2000000);
  assert.equal(caption, PCT_BASE_FROM_FIRST_POINT);
  const series = buildSeries(points, base, "pct");
  assert.equal(series[0].value, 0);
  assert.ok(TIME_SCALE_MIN_BAR_SPACING < 0.5);
  assert.equal(seriesFitsWidth(series.length, 200), true);
  assert.equal(seriesFitsWidth(series.length, 200, 0.5), false);
});
