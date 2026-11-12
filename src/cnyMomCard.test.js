import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalCurrency } from "./cashCurrency.js";
import {
  CNY_JOURNAL_CAPITAL_GENERATION,
  CNY_JOURNAL_FROM,
  STALE_BUNDLED_CNY_EQUITY,
  STALE_BUNDLED_CNY_UPDATED_UTC,
  cnyMomDescription,
  cnyMomFallbackNote,
  cnyMomFromStartPctLine,
  cnyMomHistoryPoints,
  cnyMomOpenedLine,
  hasCnyMomAccountLine,
  isCnyJournalReplace,
  isCnyJournalReplaceSignal,
  isCnyMomPaperSymbol,
  visibleCnyMomPositions,
} from "./cnyMomCard.js";
import { sanitizeCabinetSnapshot } from "./equitySanitize.js";
import { mergeLatestIntoHistory } from "./historyMerge.js";
import { stitchPaperPoints } from "./stitchEquity.js";
import { buildSeries, lastEquityValue, resolveChartBase, resolveEquityPoints } from "./equityChartModel.js";
import {
  CNY_MOM_H360_ACCOUNT_ID,
  CNY_MOM_H360_BOT_ID,
  CNY_MOM_H360_CANON_ID,
  CNY_MOM_H360_CURRENCY,
  CNY_MOM_H360_SERIES_KEY,
  CNY_MOM_H360_TITLE,
  RF_BONDS_RATE_CYCLE_BOT_ID,
  RF_BONDS_RATE_CYCLE_TITLE,
  accountIdBadge,
  cardSubtitle,
  cardTitle,
  chipLabel,
  hasAccountData,
  isCnyMomH360,
  isRfBondsRateCycle,
  mergePortalAccounts,
  showsPaperBadge,
  underTitleLabel,
} from "./strategyMeta.js";

const FEED_WITHOUT = {
  accounts: [
    { bot_id: "v6b1", account_id: "v6b1", currency: "USDT", equity: "10000" },
    { bot_id: RF_BONDS_RATE_CYCLE_BOT_ID, account_id: RF_BONDS_RATE_CYCLE_BOT_ID, currency: "RUB", equity: "300000" },
  ],
};

const RUB_BOOK = {
  bot_id: CNY_MOM_H360_BOT_ID,
  account_id: CNY_MOM_H360_ACCOUNT_ID,
  currency: "RUB",
  seed: "300000",
  equity: "300000.0",
  updated_utc: "2026-10-12T11:07:00Z",
  as_of: "2026-10-12",
  positions: [{ symbol: "LQDT", side: "long", qty: "142429", avg_px: "2.1063" }],
  history: [{ t: "2026-10-12", equity: "300000.0" }],
  note: "Бумага. «Юань 360», старт 300000 RUB. Паи LQDT и фьючерс юаня CR. Пока нет дисконта пая, фьючерс не открывается. На биржу ордера не идут.",
};

test("fixture without yuan-360 object: shell shows нет данных, no invented 300000", () => {
  const merged = mergePortalAccounts(FEED_WITHOUT.accounts);
  const row = merged.find((a) => a.bot_id === CNY_MOM_H360_BOT_ID);
  assert.ok(row);
  assert.equal(row.account_id, CNY_MOM_H360_ACCOUNT_ID);
  assert.equal(row.no_data, true);
  assert.equal(hasAccountData(row), false);
  assert.equal(hasCnyMomAccountLine(row), false);
  assert.equal(row.equity, undefined);
  assert.equal(row.seed, undefined);
  assert.equal(canonicalCurrency(row), "RUB");
  assert.equal(CNY_MOM_H360_CURRENCY, "RUB");
  assert.equal(cardTitle(row), CNY_MOM_H360_TITLE);
  assert.equal(chipLabel(CNY_MOM_H360_BOT_ID), CNY_MOM_H360_TITLE);
  assert.equal(showsPaperBadge(row), true);
  assert.equal(accountIdBadge(row), CNY_MOM_H360_CANON_ID);
  assert.equal(underTitleLabel(row), null);
  assert.equal(cnyMomFromStartPctLine(row), "");
  assert.deepEqual(resolveEquityPoints(row, { series: {} }), []);
  assert.doesNotMatch(cardTitle(row), /Цикл ставки 80\/20|РФ Консерватив|Цикл 60\/40/);
  assert.doesNotMatch(cardSubtitle(row), /индекс|RUCBTR5YNS|CNYRUB|seed/i);
  assert.equal(isCnyMomH360(row), true);
  assert.equal(isRfBondsRateCycle(row), false);
});

test("RUB book fixture: 300 000 ₽, LQDT 142429, 0,00% from start", () => {
  const merged = mergePortalAccounts([...FEED_WITHOUT.accounts, RUB_BOOK]);
  const row = merged.find((a) => a.bot_id === CNY_MOM_H360_BOT_ID);
  assert.equal(hasAccountData(row), true);
  assert.equal(hasCnyMomAccountLine(row), true);
  assert.equal(canonicalCurrency(row), "RUB");
  assert.equal(Number(row.seed), 300000);
  assert.equal(lastEquityValue(row), 300000);
  assert.equal(cnyMomFromStartPctLine(row), "+0,00% от старта");
  assert.doesNotMatch(cnyMomFromStartPctLine(row), /seed|\./i);
  const visible = visibleCnyMomPositions(row).map((p) => `${p.symbol}:${p.qty}`);
  assert.deepEqual(visible, ["LQDT:142429"]);
  assert.match(cnyMomDescription(row), /Паи LQDT и фьючерс юаня CR/);
  assert.doesNotMatch(cnyMomDescription(row), /RUCBTR5YNS|RUCBITR1Y|CNYRUB|индекс богатства/);
  assert.equal(cnyMomOpenedLine(row), "Счёт только открыт, история копится.");
  const points = resolveEquityPoints(row, {
    series: {
      "cny_mom_h360::cny_mom_h360": {
        points: [
          { t: "2025-01-01", equity: "12.75" },
          { t: "2026-10-12", equity: "13.10" },
        ],
      },
    },
  });
  assert.equal(points.length, 1);
  assert.equal(points[0].t, "2026-10-12");
  assert.equal(Number(points[0].equity), 300000);
  const series = buildSeries(points, 300000, "pct");
  assert.equal(series.length, 1);
  assert.equal(series[0].value, 0);
});

test("empty equity is нет данных even if the object exists", () => {
  const published = { ...RUB_BOOK, equity: null, history: [], error: "ledger_missing" };
  const merged = mergePortalAccounts([...FEED_WITHOUT.accounts, published]);
  const row = merged.find((a) => a.bot_id === CNY_MOM_H360_BOT_ID);
  assert.equal(hasCnyMomAccountLine(row), false);
  assert.equal(cnyMomFromStartPctLine(row), "");
  assert.deepEqual(cnyMomHistoryPoints(row), []);
});

test("qty 0 and bond indexes never render; CR with qty shows as its own row", () => {
  const mixed = {
    ...RUB_BOOK,
    positions: [
      { symbol: "LQDT", side: "long", qty: "142429", avg_px: "2.1063" },
      { symbol: "CRZ6", side: "long", qty: "0", avg_px: "12.9" },
      { symbol: "CRZ6", side: "long", qty: "2", avg_px: "12.9" },
      { symbol: "RUCBTR5YNS", side: "long", qty: "10", avg_px: "186" },
      { symbol: "CNYRUB_TOM", side: "long", qty: "1", avg_px: "12.7" },
    ],
  };
  assert.deepEqual(
    visibleCnyMomPositions(mixed).map((p) => `${p.symbol}:${p.qty}`),
    ["LQDT:142429", "CRZ6:2"],
  );
  assert.equal(isCnyMomPaperSymbol("CNYRUB_TOM"), false);
  assert.equal(isCnyMomPaperSymbol("RUCBITR1Y"), false);
  assert.equal(isCnyMomPaperSymbol("LQDT"), true);
  assert.equal(isCnyMomPaperSymbol("CR"), true);
  const indexNote = { ...RUB_BOOK, note: "старт 1, RUCBTR5YNS и CNYRUB_TOM" };
  assert.doesNotMatch(cnyMomDescription(indexNote), /RUCBTR5YNS|CNYRUB/);
  assert.match(cnyMomFallbackNote(indexNote), /300\s?000 ₽/);
});

test("empty note uses fallback with seed amount", () => {
  const noNote = { ...RUB_BOOK, note: "" };
  assert.match(cnyMomDescription(noNote), /старт 300\s?000 ₽/);
  assert.match(cnyMomDescription(noNote), /360 часовых закрытий/);
  assert.match(cnyMomDescription(noNote), /фьючерс не открывается/);
  assert.doesNotMatch(cnyMomDescription(noNote), /seed|RUCBTR5YNS|CNYRUB/i);
});

test("rate-cycle 80/20 stays a separate RUB card", () => {
  const merged = mergePortalAccounts(FEED_WITHOUT.accounts);
  const rbc = merged.find((a) => a.bot_id === RF_BONDS_RATE_CYCLE_BOT_ID);
  assert.equal(isCnyMomH360(rbc), false);
  assert.equal(cnyMomFromStartPctLine(rbc), "");
  assert.equal(cardTitle(rbc), RF_BONDS_RATE_CYCLE_TITLE);
});

test("Юань 360: линия = history.json + поле history снимка, без «только открыт»", () => {
  const row = {
    ...RUB_BOOK,
    equity: "313593.43",
    history: [{ t: "2026-10-20", equity: "313593.43" }],
  };
  const stored = [
    { t: "2026-10-11T10:00:00Z", equity: 12.9 },
    { t: "2026-10-12T11:07:00Z", equity: 300000 },
    { t: "2026-10-19T09:02:00Z", equity: 305000 },
    { t: "2026-10-20T08:02:04Z", equity: 311423.43 },
    { t: "2026-10-20T09:02:08Z", equity: 313593.43 },
  ];
  const history = { series: { "cny_mom_h360::cny_mom_h360": { points: stored } } };
  const points = resolveEquityPoints(row, history);
  assert.deepEqual(
    points.map((p) => p.t),
    ["2026-10-12T11:07:00Z", "2026-10-19T09:02:00Z", "2026-10-20T08:02:04Z", "2026-10-20T09:02:08Z"],
  );
  assert.equal(buildSeries(points, 300000, "money").length, 4);
  assert.equal(cnyMomOpenedLine(row, points), "");
  // Новый день в снимке, которого ещё нет в history.json, дописывается в конец.
  const next = resolveEquityPoints({ ...row, history: [{ t: "2026-10-21", equity: "314000" }] }, history);
  assert.equal(next.length, 5);
  assert.equal(next[4].t, "2026-10-21");
  // Пустой history.json — одна точка из снимка и подпись «только открыт».
  const alone = resolveEquityPoints(row, { series: {} });
  assert.equal(alone.length, 1);
  assert.equal(cnyMomOpenedLine(row, alone), "Счёт только открыт, история копится.");
});

const CNY_JOURNAL_SYNTH = [
  { t: "2026-10-23T08:00:00", equity: "332497.77" },
  { t: "2026-10-24T05:21:01", equity: "301000" },
  { t: "2026-11-12T06:00:00", equity: "318428.04" },
];

const OLD_CNY_BOOK = [
  { t: "2026-10-12T11:07:00Z", equity: 300000 },
  { t: "2026-10-19T09:02:00Z", equity: 305000 },
  { t: "2026-10-24T05:21:02Z", equity: STALE_BUNDLED_CNY_EQUITY },
  { t: "2026-11-12T04:21:01Z", equity: 318428.04 },
];

function cnyJournalAccount(extra = {}) {
  return {
    bot_id: CNY_MOM_H360_BOT_ID,
    account_id: CNY_MOM_H360_ACCOUNT_ID,
    currency: "RUB",
    seed: "300000",
    equity: "318428.04",
    updated_utc: "2026-11-12T04:21:01Z",
    as_of: "2026-11-12",
    history_mode: "replace",
    generation: CNY_JOURNAL_CAPITAL_GENERATION,
    history: CNY_JOURNAL_SYNTH,
    ...extra,
  };
}

test("journal replace: client takes history wholly, no 12 Oct / 335539 stitch", () => {
  const row = cnyJournalAccount();
  assert.equal(isCnyJournalReplace(row), true);
  assert.equal(Number(row.equity), 318428.04);
  assert.equal(Number(row.seed), 300000);
  assert.equal(cnyMomFromStartPctLine(row), "+6,14% от старта");
  const oldHist = { series: { [CNY_MOM_H360_SERIES_KEY]: { points: OLD_CNY_BOOK } } };
  const points = resolveEquityPoints(row, oldHist);
  assert.deepEqual(
    points.map((p) => p.t),
    CNY_JOURNAL_SYNTH.map((p) => p.t),
  );
  assert.equal(points.length, 3);
  assert.equal(points[0].t, CNY_JOURNAL_FROM);
  assert.ok(!String(points[0].t).endsWith("Z"));
  assert.equal(Number(points[0].equity), 332497.77);
  assert.notEqual(Number(points[0].equity), 300000);
  assert.equal(Number(points.at(-1).equity), 318428.04);
  assert.ok(points.every((p) => Number(p.equity) !== STALE_BUNDLED_CNY_EQUITY));
  assert.ok(points.every((p) => !String(p.t).startsWith("2026-10-12")));
  assert.equal(cnyMomOpenedLine(row, points), "");
  const stitched = stitchPaperPoints(row, [{ t: "2026-10-12T11:07:00Z", equity: 300000 }], oldHist);
  assert.deepEqual(
    stitched.map((p) => p.t),
    CNY_JOURNAL_SYNTH.map((p) => p.t),
  );
});

test("journal generation already in history.json: do not merge date-only feed onto it", () => {
  const row = {
    bot_id: CNY_MOM_H360_BOT_ID,
    account_id: CNY_MOM_H360_ACCOUNT_ID,
    currency: "RUB",
    seed: "300000",
    equity: "318428.04",
    updated_utc: "2026-11-12T04:21:01Z",
    history: [{ t: "2026-11-12", equity: "318428.04" }],
  };
  const history = {
    series: {
      [CNY_MOM_H360_SERIES_KEY]: {
        bot_id: CNY_MOM_H360_BOT_ID,
        account_id: CNY_MOM_H360_ACCOUNT_ID,
        generation: CNY_JOURNAL_CAPITAL_GENERATION,
        points: CNY_JOURNAL_SYNTH.map((p) => ({ t: p.t, equity: Number(p.equity) })),
      },
    },
  };
  const points = resolveEquityPoints(row, history);
  assert.equal(points.length, 3);
  assert.equal(points[0].t, "2026-10-23T08:00:00");
  assert.ok(points.every((p) => !String(p.t).endsWith("Z")));
});

test("without replace, live CNY still merges stored book + snapshot history", () => {
  const row = {
    ...RUB_BOOK,
    equity: "318428.04",
    updated_utc: "2026-11-12T04:21:01Z",
    as_of: "2026-11-12",
    history: [{ t: "2026-11-12", equity: "318428.04" }],
  };
  const points = resolveEquityPoints(row, { series: { [CNY_MOM_H360_SERIES_KEY]: { points: OLD_CNY_BOOK } } });
  assert.equal(points[0].t, "2026-10-12T11:07:00Z");
  assert.equal(points.length, OLD_CNY_BOOK.length);
});

test("replace signal with empty history does not fall back to the Oct 12 book", () => {
  const row = cnyJournalAccount({ history: [] });
  const points = resolveEquityPoints(row, { series: { [CNY_MOM_H360_SERIES_KEY]: { points: OLD_CNY_BOOK } } });
  assert.deepEqual(points, []);
});

test("stale bundled 335539 CNY becomes нет данных; other accounts stay", () => {
  const latest = {
    generated_at: "2026-10-24T06:13:05Z",
    accounts: [
      { bot_id: "v6b1", account_id: "v6b1", currency: "USDT", seed: "10000", equity: "10100" },
      {
        bot_id: CNY_MOM_H360_BOT_ID,
        account_id: CNY_MOM_H360_ACCOUNT_ID,
        currency: "RUB",
        seed: "300000",
        equity: String(STALE_BUNDLED_CNY_EQUITY),
        updated_utc: STALE_BUNDLED_CNY_UPDATED_UTC,
        as_of: "2026-10-24",
        history: [{ t: "2026-10-24", equity: String(STALE_BUNDLED_CNY_EQUITY) }],
      },
      { bot_id: RF_BONDS_RATE_CYCLE_BOT_ID, account_id: RF_BONDS_RATE_CYCLE_BOT_ID, currency: "RUB", equity: "300932.048" },
    ],
  };
  const hist = {
    series: {
      "v6b1::v6b1": { bot_id: "v6b1", account_id: "v6b1", points: [{ t: "2026-10-15T17:27:12Z", equity: 10000 }] },
      [CNY_MOM_H360_SERIES_KEY]: {
        bot_id: CNY_MOM_H360_BOT_ID,
        account_id: CNY_MOM_H360_ACCOUNT_ID,
        points: OLD_CNY_BOOK.slice(0, 3),
      },
      "rf_bonds_rate_cycle::rf_bonds_rate_cycle": {
        bot_id: RF_BONDS_RATE_CYCLE_BOT_ID,
        account_id: RF_BONDS_RATE_CYCLE_BOT_ID,
        points: [{ t: "2026-10-10T08:13:19Z", equity: 300000 }],
      },
    },
  };
  const v6Before = JSON.stringify(hist.series["v6b1::v6b1"]);
  const rateBefore = JSON.stringify(hist.series["rf_bonds_rate_cycle::rf_bonds_rate_cycle"]);
  sanitizeCabinetSnapshot(latest, hist);
  const cny = latest.accounts.find((a) => a.bot_id === CNY_MOM_H360_BOT_ID);
  assert.equal(cny.no_data, true);
  assert.equal(cny.equity, null);
  assert.equal(cny.error, "stale_bundled_cny");
  assert.equal(hasCnyMomAccountLine(cny), false);
  assert.equal(cnyMomFromStartPctLine(cny), "");
  assert.deepEqual(resolveEquityPoints(cny, hist), []);
  assert.equal(hist.series[CNY_MOM_H360_SERIES_KEY], undefined);
  assert.equal(JSON.stringify(hist.series["v6b1::v6b1"]), v6Before);
  assert.equal(JSON.stringify(hist.series["rf_bonds_rate_cycle::rf_bonds_rate_cycle"]), rateBefore);
  assert.equal(
    latest.accounts.find((a) => a.bot_id === "v6b1").equity,
    "10100",
  );
  assert.equal(
    latest.accounts.find((a) => a.bot_id === RF_BONDS_RATE_CYCLE_BOT_ID).equity,
    "300932.048",
  );
});

test("publisher replace writes journal generation and leaves neighbor series untouched", () => {
  const hist = {
    schema: "equity_history.v1",
    series: {
      [CNY_MOM_H360_SERIES_KEY]: {
        bot_id: CNY_MOM_H360_BOT_ID,
        account_id: CNY_MOM_H360_ACCOUNT_ID,
        currency: "RUB",
        seed: 300000,
        points: OLD_CNY_BOOK,
      },
      "v6b1::v6b1": { bot_id: "v6b1", account_id: "v6b1", points: [{ t: "2026-10-15T17:27:12Z", equity: 10000 }] },
      "eth_okx_moex::eth_okx_moex": {
        bot_id: "eth_okx_moex",
        account_id: "eth_okx_moex",
        points: [{ t: "2026-10-13T00:00:00Z", equity: 300000 }],
      },
    },
  };
  const v6Before = JSON.stringify(hist.series["v6b1::v6b1"]);
  const ethBefore = JSON.stringify(hist.series["eth_okx_moex::eth_okx_moex"]);
  mergeLatestIntoHistory(hist, {
    generated_at: "2026-11-12T04:30:00Z",
    accounts: [
      { bot_id: "v6b1", account_id: "v6b1", equity: "10100", updated_utc: "2026-11-12T04:30:00Z" },
      cnyJournalAccount(),
      { bot_id: "eth_okx_moex", account_id: "eth_okx_moex", equity: "300000", updated_utc: "2026-10-13T00:00:00Z" },
    ],
  });
  const ser = hist.series[CNY_MOM_H360_SERIES_KEY];
  assert.equal(ser.generation, CNY_JOURNAL_CAPITAL_GENERATION);
  assert.equal(ser.history_mode, "replace");
  assert.deepEqual(
    ser.points.map((p) => p.t),
    CNY_JOURNAL_SYNTH.map((p) => p.t),
  );
  assert.equal(ser.points.at(-1).equity, 318428.04);
  assert.ok(ser.points.every((p) => p.equity !== STALE_BUNDLED_CNY_EQUITY));
  assert.ok(!ser.points.some((p) => String(p.t).startsWith("2026-10-12")));
  assert.deepEqual(hist.series["eth_okx_moex::eth_okx_moex"].points, JSON.parse(ethBefore).points);
  assert.equal(hist.series["eth_okx_moex::eth_okx_moex"].generation, undefined);
  assert.equal(hist.series["v6b1::v6b1"].points.at(-1).equity, 10100);
  assert.equal(JSON.parse(v6Before).points[0].equity, 10000);
});

test("ETH history_mode=replace is not the CNY journal path", () => {
  const eth = {
    bot_id: "eth_okx_moex",
    account_id: "eth_okx_moex",
    history_mode: "replace",
    equity: "308800",
    updated_utc: "2026-10-13T00:00:00Z",
  };
  assert.equal(isCnyJournalReplaceSignal(eth), false);
  const hist = {
    series: {
      "eth_okx_moex::eth_okx_moex": {
        bot_id: "eth_okx_moex",
        account_id: "eth_okx_moex",
        points: [{ t: "2026-10-13T00:00:00Z", equity: 308800 }],
      },
      [CNY_MOM_H360_SERIES_KEY]: {
        bot_id: CNY_MOM_H360_BOT_ID,
        account_id: CNY_MOM_H360_ACCOUNT_ID,
        points: OLD_CNY_BOOK,
      },
    },
  };
  const ethPtsBefore = JSON.stringify(hist.series["eth_okx_moex::eth_okx_moex"].points);
  mergeLatestIntoHistory(hist, {
    generated_at: "2026-11-12T04:51:33Z",
    accounts: [eth, cnyJournalAccount()],
  });
  assert.equal(JSON.stringify(hist.series["eth_okx_moex::eth_okx_moex"].points), ethPtsBefore);
  assert.equal(hist.series["eth_okx_moex::eth_okx_moex"].generation, undefined);
  assert.equal(hist.series[CNY_MOM_H360_SERIES_KEY].generation, CNY_JOURNAL_CAPITAL_GENERATION);
});

test("host extract: replace writes exact 479 naive points; pct is from seed not first equity", () => {
  const extract = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures/cny_mom_h360_host_account_extract.json"), "utf8"),
  );
  const row = { ...extract.account, history: extract.history, equity_curve: extract.equity_curve };
  assert.equal(extract.history.length, 479);
  assert.equal(extract.equity_curve.length, 0);
  assert.equal(row.history_mode, "replace");
  assert.equal(row.generation, CNY_JOURNAL_CAPITAL_GENERATION);
  assert.equal(row.start, CNY_JOURNAL_FROM);
  assert.equal(cnyMomFromStartPctLine(row), "+6,14% от старта");
  assert.notEqual(Number(extract.history[0].equity), Number(row.seed));

  const oldHist = {
    schema: "equity_history.v1",
    series: {
      [CNY_MOM_H360_SERIES_KEY]: {
        bot_id: CNY_MOM_H360_BOT_ID,
        account_id: CNY_MOM_H360_ACCOUNT_ID,
        currency: "RUB",
        seed: 300000,
        points: [
          ...OLD_CNY_BOOK,
          ...Array.from({ length: 565 }, (_, i) => ({
            t: `2026-10-12T${String(11 + (i % 10)).padStart(2, "0")}:07:00Z`,
            equity: 300000 + i,
          })),
        ],
      },
      "v6b1::v6b1": { bot_id: "v6b1", account_id: "v6b1", points: [{ t: "2026-10-15T17:27:12Z", equity: 10112.256057314 }] },
      "eth_okx_moex::eth_okx_moex": {
        bot_id: "eth_okx_moex",
        account_id: "eth_okx_moex",
        points: [{ t: "2026-10-13T00:00:00Z", equity: 308800 }],
      },
    },
  };
  const oldN = oldHist.series[CNY_MOM_H360_SERIES_KEY].points.length;
  assert.ok(oldN > 479);
  const v6Pts = JSON.stringify(oldHist.series["v6b1::v6b1"].points);
  const ethPts = JSON.stringify(oldHist.series["eth_okx_moex::eth_okx_moex"].points);

  const clientPts = resolveEquityPoints(row, oldHist);
  assert.equal(clientPts.length, 479);
  assert.equal(clientPts[0].t, "2026-10-23T08:00:00");
  assert.equal(Number(clientPts[0].equity), 332497.77);
  assert.equal(clientPts.at(-1).t, "2026-11-12T06:00:00");
  assert.equal(Number(clientPts.at(-1).equity), 318428.04);
  assert.ok(clientPts.every((p) => !String(p.t).endsWith("Z")));
  assert.ok(clientPts.every((p) => !String(p.t).startsWith("2026-10-12")));
  assert.ok(clientPts.every((p) => Number(p.equity) !== STALE_BUNDLED_CNY_EQUITY));

  const chartBase = resolveChartBase(row, clientPts, null);
  assert.equal(chartBase.base, 300000);
  assert.equal(chartBase.caption, null);
  const pct = buildSeries(clientPts, chartBase.base, "pct");
  assert.equal(pct.length, 479);
  const firstPct = ((332497.77 - 300000) / 300000) * 100;
  const lastPct = ((318428.04 - 300000) / 300000) * 100;
  assert.ok(Math.abs(pct[0].value - firstPct) < 1e-9);
  assert.ok(Math.abs(pct.at(-1).value - lastPct) < 1e-9);
  assert.ok(Math.abs(lastPct - 6.14268) < 1e-5);
  assert.ok(pct[0].value > 10);
  assert.ok(Math.abs(pct.at(-1).value - ((318428.04 - 332497.77) / 332497.77) * 100) > 1);

  mergeLatestIntoHistory(oldHist, {
    generated_at: extract.generated_at,
    accounts: [
      { bot_id: "v6b1", account_id: "v6b1", equity: "10112.256057314", updated_utc: "2026-10-15T17:27:12Z" },
      row,
      {
        bot_id: "eth_okx_moex",
        account_id: "eth_okx_moex",
        history_mode: "replace",
        equity: "308800",
        updated_utc: "2026-10-13T00:00:00Z",
      },
    ],
  });
  const ser = oldHist.series[CNY_MOM_H360_SERIES_KEY];
  assert.equal(ser.points.length, 479);
  assert.notEqual(ser.points.length, oldN);
  assert.notEqual(ser.points.length, oldN + 479);
  assert.equal(ser.generation, CNY_JOURNAL_CAPITAL_GENERATION);
  assert.equal(ser.history_mode, "replace");
  assert.equal(ser.points[0].t, "2026-10-23T08:00:00");
  assert.equal(ser.points[0].equity, 332497.77);
  assert.equal(ser.points.at(-1).t, "2026-11-12T06:00:00");
  assert.equal(ser.points.at(-1).equity, 318428.04);
  assert.ok(ser.points.every((p) => !String(p.t).endsWith("Z")));
  assert.equal(JSON.stringify(oldHist.series["v6b1::v6b1"].points), v6Pts);
  assert.equal(JSON.stringify(oldHist.series["eth_okx_moex::eth_okx_moex"].points), ethPts);
  assert.equal(oldHist.series["eth_okx_moex::eth_okx_moex"].generation, undefined);
});

test("publisher does not append onto an existing journal generation", () => {
  const hist = {
    series: {
      [CNY_MOM_H360_SERIES_KEY]: {
        bot_id: CNY_MOM_H360_BOT_ID,
        account_id: CNY_MOM_H360_ACCOUNT_ID,
        generation: CNY_JOURNAL_CAPITAL_GENERATION,
        history_mode: "replace",
        points: CNY_JOURNAL_SYNTH.map((p) => ({ t: p.t, equity: Number(p.equity) })),
      },
    },
  };
  const before = JSON.stringify(hist.series[CNY_MOM_H360_SERIES_KEY].points);
  mergeLatestIntoHistory(hist, {
    generated_at: "2026-11-12T05:00:00Z",
    accounts: [
      {
        bot_id: CNY_MOM_H360_BOT_ID,
        account_id: CNY_MOM_H360_ACCOUNT_ID,
        equity: "318428.04",
        updated_utc: "2026-11-12T05:00:00Z",
        history: [{ t: "2026-11-12", equity: "318428.04" }],
      },
    ],
  });
  assert.equal(JSON.stringify(hist.series[CNY_MOM_H360_SERIES_KEY].points), before);
});

test("publisher skips stale bundled CNY so 335539 is not appended", () => {
  const hist = {
    series: {
      [CNY_MOM_H360_SERIES_KEY]: {
        bot_id: CNY_MOM_H360_BOT_ID,
        account_id: CNY_MOM_H360_ACCOUNT_ID,
        points: [{ t: "2026-10-12T11:07:00Z", equity: 300000 }],
      },
    },
  };
  const before = JSON.stringify(hist.series[CNY_MOM_H360_SERIES_KEY].points);
  mergeLatestIntoHistory(hist, {
    generated_at: "2026-10-24T06:13:05Z",
    accounts: [
      {
        bot_id: CNY_MOM_H360_BOT_ID,
        account_id: CNY_MOM_H360_ACCOUNT_ID,
        equity: String(STALE_BUNDLED_CNY_EQUITY),
        updated_utc: STALE_BUNDLED_CNY_UPDATED_UTC,
        as_of: "2026-10-24",
        history: [{ t: "2026-10-24", equity: String(STALE_BUNDLED_CNY_EQUITY) }],
      },
    ],
  });
  assert.equal(JSON.stringify(hist.series[CNY_MOM_H360_SERIES_KEY].points), before);
});

test("bundled public/data CNY 335539 cannot silently paint after sanitize", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const latest = JSON.parse(readFileSync(join(root, "public/data/latest.json"), "utf8"));
  const history = JSON.parse(readFileSync(join(root, "public/data/history.json"), "utf8"));
  const cnyRaw = (latest.accounts || []).find((a) => a.bot_id === CNY_MOM_H360_BOT_ID);
  if (!cnyRaw || isCnyJournalReplace(cnyRaw)) return;
  const v6Before = JSON.stringify(history.series["v6b1::v6b1"]);
  sanitizeCabinetSnapshot(latest, history);
  const cny = latest.accounts.find((a) => a.bot_id === CNY_MOM_H360_BOT_ID);
  assert.notEqual(Number(cny.equity), STALE_BUNDLED_CNY_EQUITY);
  assert.equal(cnyMomFromStartPctLine(cny), "");
  assert.deepEqual(resolveEquityPoints(cny, history), []);
  assert.equal(JSON.stringify(history.series["v6b1::v6b1"]), v6Before);
});
