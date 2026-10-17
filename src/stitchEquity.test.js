import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  HISTORY_RESETS,
  PAPER_BLOCK2_SERIES_KEY,
  RATE_CYCLE_RESET_FROM,
  RATE_CYCLE_SERIES_KEY,
  V6B1_SERIES_KEY,
  filterResetPoints,
} from "./historyReset.js";
import { CHART_MODE_KEYS, CHART_RANGE_KEYS, DEFAULT_CHART_MODE, DEFAULT_CHART_RANGE } from "./chartPrefs.js";
import { backtestSourceLine, feedSourceLine } from "./feedValidate.js";
import {
  EXTRA_HONESTY_BY_KEY,
  GAP_DAYS,
  backtestHonestyLines,
  backtestPointsFor,
  backtestRowFor,
  collapseDays,
  emaSeries,
  extraHonestyLine,
  kindHonestyLine,
  seriesKey,
  stitchCaption,
  stitchEquity,
  stitchPaperPoints,
} from "./stitchEquity.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backtests = JSON.parse(readFileSync(join(root, "public/data/backtests.json"), "utf8"));
const history = JSON.parse(readFileSync(join(root, "public/data/history.json"), "utf8"));
const OAC = { bot_id: "oac_paper", account_id: "oac_paper" };
const BLOCK2 = { bot_id: "three_robots_okx_nasdaq_1h", account_id: "paper_block2" };
const SERIES_KEYS = [
  "oac_paper::oac_paper",
  "desyatka_earn_paper::desyatka_earn_paper",
  "three_robots_okx_nasdaq_1h::paper_block2",
  "cycle_6040_paper::cycle_6040_paper",
  "rf_conservative_comon::rf_conservative_comon",
  "rf_bonds_rate_cycle::rf_bonds_rate_cycle",
  "eth_okx_moex::eth_okx_moex",
  "cny_mom_h360::cny_mom_h360",
];

function stitchAccount(account) {
  const paper = stitchPaperPoints(account, null, history);
  return stitchEquity(backtestPointsFor(backtests, account), paper);
}

function daily(start, n, step = 1) {
  const out = [];
  const t0 = Date.parse(`${start}T00:00:00Z`);
  for (let i = 0; i < n; i += 1) {
    const day = new Date(t0 + i * 86400000).toISOString().slice(0, 10);
    out.push({ t: day, equity: 100 + i * step });
  }
  return out;
}

test("P04: collapseDays keeps zero as -100% and negatives so stitch can reject them", () => {
  const input = [
    { t: "2026-10-15", equity: 100 },
    { t: "2026-10-16", equity: 0 },
    { t: "2026-10-17", equity: -20 },
  ];
  assert.deepEqual(collapseDays(input), [
    { day: "2026-10-15", eq: 100 },
    { day: "2026-10-16", eq: 0 },
    { day: "2026-10-17", eq: -20 },
  ]);
  const st = stitchEquity(input, [{ t: "2026-10-16", equity: 50 }]);
  assert.equal(st.ok, false);
  assert.equal(st.reason, "negative_equity");
  assert.equal(stitchCaption(st), "Склейки нет: отрицательная стоимость счёта.");
});

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

test("backtests.json has exactly eight tester series — no invented keys", () => {
  const sha = createHash("sha256")
    .update(readFileSync(join(root, "public/data/backtests.json")))
    .digest("hex");
  assert.equal(sha.slice(0, 8), "1d72cc20");
  assert.equal(backtests.schema, "backtest_equity.v1");
  assert.deepEqual(Object.keys(backtests.series), SERIES_KEYS);
  const pts = backtestPointsFor(backtests, OAC);
  assert.equal(pts.length, 481);
  assert.equal(pts[0].t, "2024-10-24");
  assert.equal(pts.at(-1).t, "2026-09-24");
  const b2 = backtestPointsFor(backtests, BLOCK2);
  assert.equal(b2.length, 113);
  assert.equal(b2[0].t, "2026-05-01");
  assert.equal(b2.at(-1).t, "2026-10-14");
  const rate = backtestPointsFor(backtests, { bot_id: "rf_bonds_rate_cycle", account_id: "rf_bonds_rate_cycle" });
  assert.equal(rate.length, 378);
  assert.equal(rate[0].t, "2019-06-21");
  assert.equal(rate.at(-1).t, "2026-10-09");
  const eth = backtestPointsFor(backtests, { bot_id: "eth_okx_moex", account_id: "eth_okx_moex" });
  assert.equal(eth.length, 299);
  assert.equal(eth[0].t, "2025-11-18");
  const cny = backtestPointsFor(backtests, { bot_id: "cny_mom_h360", account_id: "cny_mom_h360" });
  assert.equal(cny.length, 1053);
  assert.equal(cny[0].t, "2022-08-15");
});

test("kindHonestyLine maps known kinds and hides unknown", () => {
  assert.equal(kindHonestyLine("backtest_full_preregistered"), "Бэктест: правила зафиксированы заранее.");
  assert.equal(
    kindHonestyLine("backtest_in_sample_replay"),
    "Бэктест: только in-sample, параметры подбирались на этом же окне.",
  );
  assert.equal(
    kindHonestyLine("backtest_in_sample_replica_model_book"),
    "Бэктест: только in-sample, параметры подбирались на этом же окне.",
  );
  assert.equal(
    kindHonestyLine("backtest_in_sample_golden_account"),
    "Бэктест: только in-sample, параметры подбирались на этом же окне.",
  );
  assert.equal(
    kindHonestyLine("backtest_is_to_2026-09-08_then_oos"),
    "Бэктест: in-sample до 08.09.2026, дальше вне выборки.",
  );
  assert.equal(
    kindHonestyLine("backtest_in_sample_replay_weekly"),
    "Бэктест: только in-sample, параметры подбирались на этом же окне.",
  );
  assert.equal(
    kindHonestyLine("backtest_in_sample_lag_corrected"),
    "Бэктест: только in-sample, параметры подбирались на этом же окне.",
  );
  assert.equal(
    kindHonestyLine("backtest_in_sample_reimplementation"),
    "Бэктест: только in-sample, параметры подбирались на этом же окне.",
  );
  assert.equal(kindHonestyLine("other_kind"), "");
  assert.equal(kindHonestyLine(""), "");
  assert.equal(kindHonestyLine(null), "");
  const oac = backtestHonestyLines(backtestRowFor(backtests, OAC));
  assert.equal(oac[0], "Бэктест: правила зафиксированы заранее.");
  assert.ok(oac[1]);
  const oacRow = backtestRowFor(backtests, OAC);
  assert.match(backtestSourceLine(oacRow.source), /Источник ряда/);
  assert.match(feedSourceLine("2026-10-17T10:45:45Z"), /equity-ro latest\.json/);
  const b2 = backtestHonestyLines(backtestRowFor(backtests, BLOCK2), BLOCK2);
  assert.equal(b2[0], "Бэктест: in-sample до 08.09.2026, дальше вне выборки.");
  assert.equal(b2.includes(EXTRA_HONESTY_BY_KEY[seriesKey(BLOCK2)]), true);
  const ethAcc = { bot_id: "eth_okx_moex", account_id: "eth_okx_moex" };
  const ethLines = backtestHonestyLines(backtestRowFor(backtests, ethAcc), ethAcc);
  assert.equal(ethLines[0], "Бэктест: только in-sample, параметры подбирались на этом же окне.");
  assert.equal(ethLines.includes(extraHonestyLine(ethAcc)), true);
  assert.equal(backtestHonestyLines({ kind: "nope" }).length, 0);
});

test("accounts without a series stay Склейки нет: …", () => {
  const paper = [{ t: "2026-10-15T08:57:31Z", equity: 10000 }];
  const mayak = stitchEquity(
    backtestPointsFor(backtests, { bot_id: "mayak_imoex_mom10", account_id: "mayak_imoex_mom10" }),
    paper,
  );
  assert.equal(mayak.ok, false);
  assert.equal(mayak.reason, "no_backtest");
  assert.equal(stitchCaption(mayak), "Склейки нет: нет дневного бэктеста до старта бумаги.");

  const missing = stitchEquity(backtestPointsFor(null, { bot_id: "v6b1", account_id: "v6b1" }), paper);
  assert.equal(missing.ok, false);
  assert.equal(stitchCaption({ ok: false, reason: "no_paper" }), "Склейки нет: у бумаги ещё нет точек эквити.");
  assert.equal(stitchCaption({ ok: false, reason: "backtest_after_paper" }), "Склейки нет: бэктест начинается позже бумаги.");
});

test("oac_paper stitch from backtests.json + history.json: join ≤7d, yoy bars, no sma36", () => {
  const st = stitchAccount(OAC);
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
});

test("paper_block2 stitch: join 2026-10-14→2026-10-15, no yoy (short series)", () => {
  const st = stitchAccount(BLOCK2);
  assert.equal(st.ok, true);
  assert.equal(st.joinDay, "2026-10-14");
  assert.equal(st.paperStart, "2026-10-15");
  const gapMs = Date.parse(`${st.paperStart}T00:00:00Z`) - Date.parse(`${st.joinDay}T00:00:00Z`);
  assert.equal(Math.round(gapMs / 86400000), 1);
  const paperRows = st.daily.filter((row) => row.segment === "paper");
  const before = st.daily.filter((row) => row.day < st.paperStart).at(-1);
  assert.ok(Math.abs(paperRows[0].eq - before.eq) < 1e-6);
  assert.equal(st.yoy.length, 0);
});

test("rf_bonds_rate_cycle: wealth-index 2.44 would explode stitch; reset keeps RUB scale", () => {
  const acc = { bot_id: "rf_bonds_rate_cycle", account_id: "rf_bonds_rate_cycle" };
  const backtest = backtestPointsFor(backtests, acc);
  const mixed = [
    { t: "2026-10-09T09:37:15Z", equity: 2.441925306087005 },
    { t: RATE_CYCLE_RESET_FROM, equity: 300000 },
    { t: "2026-10-17T01:01:54Z", equity: 300909.56 },
  ];
  const exploded = stitchEquity(backtest, mixed);
  assert.equal(exploded.ok, true);
  assert.ok(exploded.daily.at(-1).eq > 1e10, `exploded ${exploded.daily.at(-1).eq}`);

  const kept = filterResetPoints(RATE_CYCLE_SERIES_KEY, mixed);
  const st = stitchEquity(backtest, kept);
  assert.equal(st.ok, true);
  assert.equal(st.paperStart, "2026-10-10");
  const paperRows = st.daily.filter((row) => row.segment === "paper");
  const before = st.daily.filter((row) => row.day < st.paperStart).at(-1);
  assert.ok(Math.abs(paperRows[0].eq - before.eq) < 1e-4);
  assert.ok(st.daily.every((row) => row.eq < 2e6));
  assert.ok(st.daily.every((row) => row.eq > 1e5));
});

test("all eight tester series stitch with history.json within GAP_DAYS", () => {
  const accounts = SERIES_KEYS.map((k) => {
    const [bot_id, account_id] = k.split("::");
    return { bot_id, account_id };
  });
  for (const a of accounts) {
    const st = stitchAccount(a);
    assert.equal(st.ok, true, seriesKey(a));
    const gapMs = Date.parse(`${st.paperStart}T00:00:00Z`) - Date.parse(`${st.joinDay}T00:00:00Z`);
    assert.ok(Math.round(gapMs / 86400000) <= GAP_DAYS, seriesKey(a));
  }
});

test("sync-equity.mjs does not write backtests.json", () => {
  const src = readFileSync(join(root, "scripts/sync-equity.mjs"), "utf8");
  assert.match(src, /writeJsonAtomic\(historyPath/);
  assert.match(src, /writeJsonAtomic\(latestPath/);
  assert.doesNotMatch(src, /writeFileSync\(historyPath/);
  assert.doesNotMatch(src, /function loadJson\(p, fallback\)/);
  assert.equal(/writeFileSync\([^)]*backtests/.test(src), false);
  assert.equal(/writeJsonAtomic\([^)]*backtests/.test(src), false);
});

test("reset_from and chart v2 defaults are untouched", () => {
  assert.deepEqual(
    Object.keys(HISTORY_RESETS).sort(),
    [PAPER_BLOCK2_SERIES_KEY, RATE_CYCLE_SERIES_KEY, V6B1_SERIES_KEY].sort(),
  );
  assert.equal(DEFAULT_CHART_MODE, "pct");
  assert.equal(DEFAULT_CHART_RANGE, "all");
  assert.equal(CHART_MODE_KEYS[0], "portfolio_krsk.chartMode.v2");
  assert.equal(CHART_RANGE_KEYS[0], "portfolio_krsk.chartRange.v2");
});
