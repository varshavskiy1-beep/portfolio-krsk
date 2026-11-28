import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  HISTORY_RESETS,
  RATE_CYCLE_RESET_FROM,
  RATE_CYCLE_SERIES_KEY,
  V6B1_SERIES_KEY,
  filterResetPoints,
} from "./historyReset.js";
import { CHART_MODE_KEYS, CHART_RANGE_KEYS, DEFAULT_CHART_MODE, DEFAULT_CHART_RANGE } from "./chartPrefs.js";
import { feedSourceLine } from "./feedValidate.js";
import {
  COSTS_RU_BY_KEY,
  EXTRA_HONESTY_BY_KEY,
  MAYAK_BACKTEST_LINE,
  MAYAK_KEYS,
  GAP_DAYS,
  SOURCE_RU_BY_KEY,
  backtestHonestyLines,
  backtestPointsFor,
  backtestRowFor,
  backtestSourceDisplay,
  cardLineHasTesterJargon,
  collapseDays,
  costsHonestyLine,
  emaSeries,
  extraHonestyLine,
  kindHonestyLine,
  NO_TAPE_BACKTEST_LINE,
  noTapeHonestyLine,
  seriesKey,
  stitchCaption,
  stitchEquity,
  stitchPaperPoints,
  WHO_PAYS_NO_TAPE_KEYS,
} from "./stitchEquity.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backtests = JSON.parse(readFileSync(join(root, "public/data/backtests.json"), "utf8"));
const history = JSON.parse(readFileSync(join(root, "public/data/history.json"), "utf8"));
const OAC = { bot_id: "oac_paper", account_id: "oac_paper" };
const RETIRED_BACKTEST_KEYS = [
  "three_robots_okx_nasdaq_1h::paper_block2",
  "v6b1::v6b1",
];
/** Portal-retired series that still keep Russian stitch copy for archival curves. */
const RETIRED_STITCH_COPY_KEYS = ["v6b1::v6b1"];
const SERIES_KEYS = [
  "oac_paper::oac_paper",
  "desyatka_earn_paper::desyatka_earn_paper",
  "cycle_6040_paper::cycle_6040_paper",
  "rf_conservative_comon::rf_conservative_comon",
  "rf_bonds_rate_cycle::rf_bonds_rate_cycle",
  "eth_okx_moex::eth_okx_moex",
  "cny_mom_h360::cny_mom_h360",
  "who_pays::paper_crypto_perp",
  "mayak_imoex_lowvol10::mayak_imoex_lowvol10",
  "mayak_imoex_mom10::mayak_imoex_mom10",
  "mayak_imoex_mom10_lev15::mayak_imoex_mom10_lev15",
  "mayak_imoex_mom10_lev2::mayak_imoex_mom10_lev2",
  "moex_quad_360_carry_v1::paper_moex_quad_360_carry_v1",
  "moex_trio_360_clean_v1::paper_moex_trio_360_clean_v1",
];
const MOEX_MULTI_360_KEYS = [
  "moex_quad_360_carry_v1::paper_moex_quad_360_carry_v1",
  "moex_trio_360_clean_v1::paper_moex_trio_360_clean_v1",
];
/** Bundled history.json is the Oct 24 fallback; live paper of these books starts 2026-11-27. */
const MOEX_MULTI_360_PAPER_START = [{ t: "2026-11-27", equity: 1000000 }];
/** Archived backtest curve still present in stitchEquity.js; portal card retired. */
const V6B1 = { bot_id: "v6b1", account_id: "v6b1" };
const WHO_PERP = { bot_id: "who_pays", account_id: "paper_crypto_perp" };
const IN_SAMPLE_ONLY = "Бэктест: только на тех же данных, где подбирались правила.";
const IN_SAMPLE_UNTIL_SEP = "Бэктест: на тех же данных, где подбирались правила, до 08.09.2026, дальше вне выборки.";
const IN_SAMPLE_UNTIL_JUN = "Бэктест: на тех же данных, где подбирались правила, до 30.06.2026, дальше вне выборки.";

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

test("backtests.json has the live tester series — no invented keys", () => {
  assert.equal(backtests.schema, "backtest_equity.v1");
  assert.deepEqual(
    Object.keys(backtests.series).sort(),
    [...SERIES_KEYS, ...RETIRED_BACKTEST_KEYS].sort(),
  );
  const pts = backtestPointsFor(backtests, OAC);
  assert.equal(pts.length, 481);
  assert.equal(pts[0].t, "2024-10-24");
  assert.equal(pts.at(-1).t, "2026-09-24");
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
  const v6 = backtestPointsFor(backtests, V6B1);
  assert.equal(v6.length, 2445);
  assert.equal(v6[0].t, "2020-02-04");
  assert.equal(v6.at(-1).t, "2026-10-14");
  assert.equal(backtestRowFor(backtests, V6B1).kind, "backtest_causal_gate_reimplementation");
  const who = backtestPointsFor(backtests, WHO_PERP);
  assert.equal(who.length, 32);
  assert.equal(who[0].t, "2026-08-19");
  assert.equal(who.at(-1).t, "2026-09-19");
  assert.equal(backtestRowFor(backtests, WHO_PERP).kind, "backtest_in_sample");
  assert.equal(backtestRowFor(backtests, WHO_PERP).currency, "USDT");
  assert.equal(backtestRowFor(backtests, WHO_PERP).initial_equity, 15000);
  const quadAcc = { bot_id: "moex_quad_360_carry_v1", account_id: "paper_moex_quad_360_carry_v1" };
  const trioAcc = { bot_id: "moex_trio_360_clean_v1", account_id: "paper_moex_trio_360_clean_v1" };
  const quad = backtestPointsFor(backtests, quadAcc);
  assert.equal(quad.length, 856);
  assert.equal(quad[0].t, "2023-12-18");
  assert.equal(quad[0].equity, 994840.41);
  assert.equal(quad.at(-1).t, "2026-11-27");
  assert.equal(quad.at(-1).equity, 4899082.62);
  assert.equal(backtestRowFor(backtests, quadAcc).kind, "backtest_in_sample_replay");
  assert.equal(backtestRowFor(backtests, quadAcc).currency, "RUB");
  assert.equal(backtestRowFor(backtests, quadAcc).initial_equity, 1000000);
  const trio = backtestPointsFor(backtests, trioAcc);
  assert.equal(trio.length, 1234);
  assert.equal(trio[0].t, "2022-06-27");
  assert.equal(trio[0].equity, 1007573.84);
  assert.equal(trio.at(-1).t, "2026-11-27");
  assert.equal(trio.at(-1).equity, 5366328.5);
  assert.equal(backtestRowFor(backtests, trioAcc).kind, "backtest_in_sample_replay");
  assert.equal(backtestRowFor(backtests, trioAcc).currency, "RUB");
  assert.equal(backtestRowFor(backtests, trioAcc).initial_equity, 1000000);
});

test("kindHonestyLine maps known kinds and hides unknown", () => {
  assert.equal(kindHonestyLine("backtest_full_preregistered"), "Бэктест: правила зафиксированы заранее.");
  assert.equal(
    kindHonestyLine("backtest_in_sample_replay"),
    IN_SAMPLE_ONLY,
  );
  assert.equal(
    kindHonestyLine("backtest_in_sample_replica_model_book"),
    IN_SAMPLE_ONLY,
  );
  assert.equal(
    kindHonestyLine("backtest_in_sample_golden_account"),
    IN_SAMPLE_ONLY,
  );
  assert.equal(
    kindHonestyLine("backtest_is_to_2026-09-08_then_oos"),
    IN_SAMPLE_UNTIL_SEP,
  );
  assert.equal(
    kindHonestyLine("backtest_in_sample_replay_weekly"),
    IN_SAMPLE_ONLY,
  );
  assert.equal(
    kindHonestyLine("backtest_in_sample_lag_corrected"),
    IN_SAMPLE_ONLY,
  );
  assert.equal(
    kindHonestyLine("backtest_in_sample_reimplementation"),
    IN_SAMPLE_ONLY,
  );
  assert.equal(
    kindHonestyLine("backtest_causal_gate_reimplementation"),
    IN_SAMPLE_UNTIL_JUN,
  );
  assert.equal(kindHonestyLine("backtest_in_sample"), IN_SAMPLE_ONLY);
  assert.equal(kindHonestyLine("in_sample"), IN_SAMPLE_ONLY);
  assert.doesNotMatch(kindHonestyLine("backtest_in_sample"), /in-sample/);
  assert.equal(kindHonestyLine("other_kind"), "");
  assert.equal(kindHonestyLine(""), "");
  assert.equal(kindHonestyLine(null), "");
  const oac = backtestHonestyLines(backtestRowFor(backtests, OAC), OAC);
  assert.equal(oac[0], "Бэктест: правила зафиксированы заранее.");
  assert.equal(oac[1], COSTS_RU_BY_KEY[seriesKey(OAC)]);
  const oacRow = backtestRowFor(backtests, OAC);
  assert.equal(backtestSourceDisplay(oacRow, OAC), SOURCE_RU_BY_KEY[seriesKey(OAC)]);
  assert.match(feedSourceLine("2026-10-17T10:45:45Z"), /лента бумажных счетов/);
  const ethAcc = { bot_id: "eth_okx_moex", account_id: "eth_okx_moex" };
  const ethLines = backtestHonestyLines(backtestRowFor(backtests, ethAcc), ethAcc);
  assert.equal(ethLines[0], IN_SAMPLE_ONLY);
  assert.equal(ethLines.includes(extraHonestyLine(ethAcc)), true);
  const v6Lines = backtestHonestyLines(backtestRowFor(backtests, V6B1), V6B1);
  assert.equal(v6Lines[0], IN_SAMPLE_UNTIL_JUN);
  assert.equal(v6Lines[1], COSTS_RU_BY_KEY[seriesKey(V6B1)]);
  assert.equal(
    v6Lines.includes(
      "Бэктест пересчитан честно: вход только после закрытия дневной свечи. Бумажный бот входит и по незакрытой свече и торгует только топ-60 монет по объёму, поэтому результаты могут расходиться.",
    ),
    true,
  );
  const whoLines = backtestHonestyLines(backtestRowFor(backtests, WHO_PERP), WHO_PERP);
  assert.equal(whoLines[0], IN_SAMPLE_ONLY);
  assert.equal(whoLines.includes(EXTRA_HONESTY_BY_KEY[seriesKey(WHO_PERP)]), true);
  assert.match(EXTRA_HONESTY_BY_KEY[seriesKey(WHO_PERP)], /Проверки вне выборки не было\./);
  assert.doesNotMatch(EXTRA_HONESTY_BY_KEY[seriesKey(WHO_PERP)], /Только in-sample/);
  assert.equal(backtestHonestyLines({ kind: "nope" }).length, 0);
});

test("stitch card source and costs are Russian — no tester jargon, paths or sha", () => {
  assert.equal(
    Object.keys(SOURCE_RU_BY_KEY).sort().join("\n"),
    [...SERIES_KEYS, ...RETIRED_STITCH_COPY_KEYS].sort().join("\n"),
  );
  // Маяк: издержек в пакете тестировщика нет — строку не выдумываем.
  assert.equal(
    Object.keys(COSTS_RU_BY_KEY).sort().join("\n"),
    [...SERIES_KEYS.filter((k) => !MAYAK_KEYS.includes(k)), ...RETIRED_STITCH_COPY_KEYS]
      .sort()
      .join("\n"),
  );
  assert.equal(
    SOURCE_RU_BY_KEY[seriesKey(V6B1)],
    "Источник ряда: пересчёт тестировщика 17.10.2026 по коду бота (коммит 95b78e2), дневные свечи OKX с 2020 года. Вход только после закрытия дневной свечи.",
  );
  assert.doesNotMatch(COSTS_RU_BY_KEY[seriesKey(V6B1)], /fee_bps|PaperLedger|\bqty\b|too_tight_stop/i);
  for (const key of SERIES_KEYS) {
    const [bot_id, account_id] = key.split("::");
    const acc = { bot_id, account_id };
    const row = backtestRowFor(backtests, acc);
    const src = backtestSourceDisplay(row, acc);
    const costs = costsHonestyLine(row, acc);
    assert.match(src, /^Источник ряда:/, key);
    assert.equal(src, SOURCE_RU_BY_KEY[key], key);
    assert.equal(cardLineHasTesterJargon(src), false, src);
    assert.equal(cardLineHasTesterJargon(costs), false, costs);
    for (const line of backtestHonestyLines(row, acc)) {
      assert.equal(cardLineHasTesterJargon(line), false, line);
    }
    assert.doesNotMatch(src, /docs\/reports|quant\/|\.csv|\.py|sha256|blob /i);
  }
  const csvSha = createHash("sha256")
    .update(readFileSync(join(root, "docs/backtests/who_pays__paper_crypto_perp.csv")))
    .digest("hex");
  assert.equal(csvSha.slice(0, 8), "10253a3d");
});

test("accounts without a series stay Склейки нет: …", () => {
  const paper = [{ t: "2026-10-15T08:57:31Z", equity: 10000 }];
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

test("who_pays paper_crypto_perp stitch: join 2026-09-19, no jump", () => {
  const st = stitchAccount(WHO_PERP);
  assert.equal(st.ok, true);
  assert.equal(st.joinDay, "2026-09-19");
  assert.equal(st.paperStart, "2026-09-19");
  const gapMs = Date.parse(`${st.paperStart}T00:00:00Z`) - Date.parse(`${st.joinDay}T00:00:00Z`);
  assert.equal(Math.round(gapMs / 86400000), 0);
  const paperRows = st.daily.filter((row) => row.segment === "paper");
  const before = st.daily.filter((row) => row.day < st.paperStart).at(-1);
  assert.ok(before);
  assert.ok(Math.abs(paperRows[0].eq - before.eq) < 1e-4);
  assert.ok(st.daily.every((row) => row.eq < 20000));
  assert.ok(st.daily.every((row) => row.eq > 10000));
});

test("who_pays ru/forts/spot have no tape backtest — one gray line", () => {
  assert.equal(WHO_PAYS_NO_TAPE_KEYS.length, 3);
  assert.ok(!WHO_PAYS_NO_TAPE_KEYS.includes("who_pays::paper_us_eq"));
  const paper = [{ t: "2026-09-19T06:34:49Z", equity: 15000 }];
  for (const key of WHO_PAYS_NO_TAPE_KEYS) {
    const [bot_id, account_id] = key.split("::");
    const acc = { bot_id, account_id };
    const st = stitchEquity(backtestPointsFor(backtests, acc), paper);
    assert.equal(st.ok, false, key);
    assert.equal(st.reason, "no_backtest", key);
    assert.equal(noTapeHonestyLine(acc), NO_TAPE_BACKTEST_LINE, key);
    assert.equal(noTapeHonestyLine(WHO_PERP), "");
  }
});

test("all remaining tester series stitch with history.json within GAP_DAYS", () => {
  const accounts = SERIES_KEYS.map((k) => {
    const [bot_id, account_id] = k.split("::");
    return { bot_id, account_id };
  });
  for (const a of accounts) {
    const key = seriesKey(a);
    let paper = stitchPaperPoints(a, null, history);
    if (!paper.length && MOEX_MULTI_360_KEYS.includes(key)) {
      paper = MOEX_MULTI_360_PAPER_START;
    }
    const st = stitchEquity(backtestPointsFor(backtests, a), paper);
    assert.equal(st.ok, true, key);
    const gapMs = Date.parse(`${st.paperStart}T00:00:00Z`) - Date.parse(`${st.joinDay}T00:00:00Z`);
    assert.ok(Math.round(gapMs / 86400000) <= GAP_DAYS, key);
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
    [RATE_CYCLE_SERIES_KEY, V6B1_SERIES_KEY].sort(),
  );
  assert.equal(DEFAULT_CHART_MODE, "pct");
  assert.equal(DEFAULT_CHART_RANGE, "all");
  assert.equal(CHART_MODE_KEYS[0], "portfolio_krsk.chartMode.v2");
  assert.equal(CHART_RANGE_KEYS[0], "portfolio_krsk.chartRange.v2");
});

test("mayak ×4: honest LQDT series from 2023-10-02, stitched with the gray line", () => {
  const paper = [
    { t: "2026-10-06T05:01:51Z", equity: 300000 },
    { t: "2026-10-16T16:26:35Z", equity: 301113.437381043 },
  ];
  for (const key of MAYAK_KEYS) {
    const [bot_id, account_id] = key.split("::");
    const acc = { bot_id, account_id };
    const pts = backtestPointsFor(backtests, acc);
    assert.equal(pts.length, 776, key);
    assert.equal(pts[0].t, "2023-10-02", key);
    assert.equal(pts.at(-1).t, "2026-10-16", key);
    const row = backtestRowFor(backtests, acc);
    assert.equal(row.file_sha256, "dce09bfb7ed8d9657f600f5b6e1fc3455927e57834ff741713ab15151b38cd26");
    const res = stitchEquity(pts, paper);
    assert.equal(res.ok, true, key);
    assert.equal(res.daily[0].day, "2023-10-02", key);
    const lines = backtestHonestyLines(row, acc);
    assert.deepEqual(lines, [MAYAK_BACKTEST_LINE], key);
    assert.doesNotMatch(lines.join(" "), /seed/i);
  }
  const csvSha = createHash("sha256")
    .update(readFileSync(join(root, "docs/backtests/mayak_imoex_mom10__mayak_imoex_mom10.csv")))
    .digest("hex");
  assert.equal(csvSha, "dce09bfb7ed8d9657f600f5b6e1fc3455927e57834ff741713ab15151b38cd26");
});

test("moex quad/trio official CSVs: sha256, window, stitch on 2026-11-27", () => {
  const expected = [
    {
      key: "moex_quad_360_carry_v1::paper_moex_quad_360_carry_v1",
      file: "moex_quad_360_carry_v1__paper_moex_quad_360_carry_v1.csv",
      sha: "4739a90f6a106a19a99166abb850464f35086c15a63743910824cb552d599ce1",
      n: 856,
      first: ["2023-12-18", 994840.41],
      last: ["2026-11-27", 4899082.62],
    },
    {
      key: "moex_trio_360_clean_v1::paper_moex_trio_360_clean_v1",
      file: "moex_trio_360_clean_v1__paper_moex_trio_360_clean_v1.csv",
      sha: "6bc8217c3036ec21113d56771c3b7ebae0f7202485d687a73f56d3cbdea0cf06",
      n: 1234,
      first: ["2022-06-27", 1007573.84],
      last: ["2026-11-27", 5366328.5],
    },
  ];
  for (const spec of expected) {
    const [bot_id, account_id] = spec.key.split("::");
    const acc = { bot_id, account_id };
    const csvSha = createHash("sha256")
      .update(readFileSync(join(root, "docs/backtests", spec.file)))
      .digest("hex");
    assert.equal(csvSha, spec.sha, spec.key);
    const row = backtestRowFor(backtests, acc);
    assert.equal(row.file_sha256, spec.sha, spec.key);
    assert.equal(row.kind, "backtest_in_sample_replay", spec.key);
    const pts = backtestPointsFor(backtests, acc);
    assert.equal(pts.length, spec.n, spec.key);
    assert.equal(pts[0].t, spec.first[0], spec.key);
    assert.equal(pts[0].equity, spec.first[1], spec.key);
    assert.equal(pts.at(-1).t, spec.last[0], spec.key);
    assert.equal(pts.at(-1).equity, spec.last[1], spec.key);
    const st = stitchEquity(pts, MOEX_MULTI_360_PAPER_START);
    assert.equal(st.ok, true, spec.key);
    assert.equal(st.joinDay, "2026-11-27", spec.key);
    assert.equal(st.paperStart, "2026-11-27", spec.key);
    const src = backtestSourceDisplay(row, acc);
    assert.equal(src, SOURCE_RU_BY_KEY[spec.key], spec.key);
    assert.equal(cardLineHasTesterJargon(src), false, src);
    assert.equal(cardLineHasTesterJargon(costsHonestyLine(row, acc)), false, spec.key);
    assert.equal(kindHonestyLine(row.kind), IN_SAMPLE_ONLY, spec.key);
  }
});

test("stitchPaperPoints: equity_curve wins over stale history.json", () => {
  const stale = {
    series: {
      "oac_paper::oac_paper": {
        points: [
          { t: "2026-09-21T13:10:00Z", equity: 19500 },
          { t: "2026-09-22T13:10:33Z", equity: 18379.91 },
        ],
      },
    },
  };
  const acc = {
    bot_id: "oac_paper",
    account_id: "oac_paper",
    equity_curve: [
      { t: "2026-09-18T16:39:08Z", equity: "10000.0" },
      { t: "2026-09-21T13:10:00Z", equity: "10000.0" },
      { t: "2026-09-22T13:10:33Z", equity: "9900" },
    ],
  };
  const pts = stitchPaperPoints(acc, null, stale);
  assert.equal(pts.length, 3);
  assert.deepEqual(pts[0], { t: "2026-09-18T16:39:08Z", equity: 10000 });
  assert.ok(!pts.some((p) => p.equity === 19500));
  const noCurve = stitchPaperPoints({ bot_id: "oac_paper", account_id: "oac_paper" }, null, stale);
  assert.equal(noCurve[0].equity, 19500);
});

test("stitchPaperPoints on live feed: ETH series is present and not empty", () => {
  const latest = JSON.parse(readFileSync(join(root, "public/data/latest.json"), "utf8"));
  const acc = latest.accounts.find((a) => a.bot_id === "eth_okx_moex");
  assert.ok(acc);
  const pts = stitchPaperPoints(acc, null, history);
  assert.ok(pts.length >= 1);
  assert.equal(
    latest.accounts.some((a) => a.bot_id === "forts_adr_static" || a.bot_id === "pump_radar"),
    false,
  );
});
