import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalCurrency } from "./cashCurrency.js";
import { lastEquityValue, resolveEquityPoints, buildSeries } from "./equityChartModel.js";
import {
  INDEX_CURRENCY,
  RATE_CYCLE_BOOK_LINE,
  RATE_CYCLE_COMPOSITION,
  RATE_CYCLE_HISTORY_LABEL,
  RATE_CYCLE_HISTORY_LINES,
  RATE_CYCLE_LOGIC_LINE,
  formatIndexEquity,
  formatIndexRu,
  fromStartPctLine,
  hasRateCyclePaperBook,
  isRateCyclePaperSymbol,
  optionalFeedLines,
  rateCycleNoteVisible,
  visibleRateCyclePositions,
} from "./rateCycleCard.js";
import {
  RF_BONDS_RATE_CYCLE_ACCOUNT_ID,
  RF_BONDS_RATE_CYCLE_BOT_ID,
  RF_BONDS_RATE_CYCLE_TITLE,
  accountIdBadge,
  cardSubtitle,
  cardTitle,
  chipLabel,
  hasAccountData,
  isRfBondsRateCycle,
  isRfConservative,
  mergePortalAccounts,
  showsPaperBadge,
  underTitleLabel,
} from "./strategyMeta.js";

const FEED_WITHOUT = {
  accounts: [
    { bot_id: "v6b1", account_id: "v6b1", currency: "USDT", equity: "10000" },
    { bot_id: "rf_conservative_comon", account_id: "rf_conservative_comon", currency: "RUB", equity: "50000" },
  ],
};

const PUBLISHED = {
  bot_id: RF_BONDS_RATE_CYCLE_BOT_ID,
  account_id: RF_BONDS_RATE_CYCLE_ACCOUNT_ID,
  currency: "RUB",
  seed: "1",
  equity: "2.4419",
  as_of: "2026-10-03",
  positions: [],
  note: "Бумага. Цикл ставки 80/20, старт 1.",
};

test("fixture without rate-cycle object: shell shows нет данных, no invented start", () => {
  const merged = mergePortalAccounts(FEED_WITHOUT.accounts);
  const row = merged.find((a) => a.bot_id === RF_BONDS_RATE_CYCLE_BOT_ID);
  assert.ok(row);
  assert.equal(row.account_id, RF_BONDS_RATE_CYCLE_ACCOUNT_ID);
  assert.equal(row.no_data, true);
  assert.equal(hasAccountData(row), false);
  assert.equal(row.equity, undefined);
  assert.equal(row.seed, undefined);
  assert.equal(canonicalCurrency(row), INDEX_CURRENCY);
  assert.equal(cardTitle(row), RF_BONDS_RATE_CYCLE_TITLE);
  assert.equal(chipLabel(RF_BONDS_RATE_CYCLE_BOT_ID), RF_BONDS_RATE_CYCLE_TITLE);
  assert.equal(cardSubtitle(row), RATE_CYCLE_LOGIC_LINE);
  assert.equal(showsPaperBadge(row), true);
  assert.equal(accountIdBadge(row), RF_BONDS_RATE_CYCLE_ACCOUNT_ID);
  assert.equal(underTitleLabel(row), null);
  assert.equal(fromStartPctLine(row), "");
  assert.deepEqual(resolveEquityPoints(row, { series: {} }), []);
  assert.doesNotMatch(cardTitle(row), /РФ Консерватив|Цикл 60\/40|50 000|300 000|₽|RUB/);
  assert.doesNotMatch(cardSubtitle(row), /OBLG|SBRB|фьючерс CR|seed/i);
  assert.doesNotMatch(RATE_CYCLE_COMPOSITION, /RUCBTR5YNS|RUCBITR1Y|CNYRUB/);
  assert.match(RATE_CYCLE_COMPOSITION, /не позиции счёта/);
  assert.match(RATE_CYCLE_BOOK_LINE, /История канона считалась по индексам/);
  assert.match(RATE_CYCLE_BOOK_LINE, /паи и фьючерс юаня/);
  assert.equal(isRfBondsRateCycle(row), true);
  assert.equal(isRfConservative(row), false);
  assert.equal(hasRateCyclePaperBook(row), false);
});

test("index-only positions: empty table, нет данных, no from-start, no NAV", () => {
  const published = {
    ...PUBLISHED,
    positions: [
      { symbol: "RUCBTR5YNS", side: "long", qty: "0.8", avg_px: "186.57" },
      { symbol: "RUCBITR1Y", side: "long", qty: "0.2", avg_px: "462.72" },
      { symbol: "CNYRUB_TOM", side: "long", qty: "0.2", avg_px: "12.75" },
    ],
  };
  const merged = mergePortalAccounts([...FEED_WITHOUT.accounts, published]);
  const row = merged.find((a) => a.bot_id === RF_BONDS_RATE_CYCLE_BOT_ID);
  assert.equal(hasAccountData(row), true);
  assert.equal(Number(row.seed), 1);
  assert.equal(lastEquityValue(row), 2.4419);
  assert.equal(hasRateCyclePaperBook(row), false);
  assert.deepEqual(visibleRateCyclePositions(row), []);
  assert.equal(formatIndexEquity(row, 2.4419), "");
  assert.equal(fromStartPctLine(row), "");
  assert.deepEqual(resolveEquityPoints(row, null), []);
  assert.deepEqual(buildSeries([], 1, "money"), []);
  assert.equal(rateCycleNoteVisible(row.note, row), false);
});

test("paper book OBLG/SBRB/CR: show positions and index line from start", () => {
  const published = {
    ...PUBLISHED,
    positions: [
      { symbol: "OBLG", side: "long", qty: "12", avg_px: "10.5" },
      { symbol: "SBRB", side: "long", qty: "3", avg_px: "20" },
      { symbol: "CRH6", side: "long", qty: "1", avg_px: "12.4" },
      { symbol: "CNYRUB_TOM", side: "long", qty: "0.2", avg_px: "12.75" },
    ],
  };
  const merged = mergePortalAccounts([...FEED_WITHOUT.accounts, published]);
  const row = merged.find((a) => a.bot_id === RF_BONDS_RATE_CYCLE_BOT_ID);
  assert.equal(hasRateCyclePaperBook(row), true);
  const visible = visibleRateCyclePositions(row).map((p) => p.symbol);
  assert.deepEqual(visible, ["OBLG", "SBRB", "CRH6"]);
  assert.equal(visible.includes("CNYRUB_TOM"), false);
  assert.equal(formatIndexEquity(row, 2.4419), "2,4419");
  assert.equal(fromStartPctLine(row), "+144,19% от старта");
  assert.doesNotMatch(fromStartPctLine(row), /₽|RUB|300\s?000|50\s?000|seed/i);
  assert.doesNotMatch(formatIndexEquity(row, 2.4419), /₽|RUB/);
  const series = buildSeries(resolveEquityPoints(row, null), 1, "money");
  assert.ok(series.length >= 2);
  assert.equal(series[series.length - 1].value, 2.4419);
});

test("CNYRUB_TOM is never a visible position", () => {
  const onlySpot = {
    bot_id: RF_BONDS_RATE_CYCLE_BOT_ID,
    account_id: RF_BONDS_RATE_CYCLE_ACCOUNT_ID,
    positions: [
      { symbol: "CNYRUB_TOM", side: "long", qty: "0.2", avg_px: "12.75" },
      { symbol: "cnyrub_tom", side: "long", qty: "1", avg_px: "1" },
    ],
  };
  assert.deepEqual(visibleRateCyclePositions(onlySpot), []);
  assert.equal(hasRateCyclePaperBook(onlySpot), false);
  assert.equal(isRateCyclePaperSymbol("CNYRUB_TOM"), false);
  assert.equal(isRateCyclePaperSymbol("CNYRUB"), false);
  assert.equal(isRateCyclePaperSymbol("OBLG"), true);
  assert.equal(isRateCyclePaperSymbol("SBRB"), true);
  assert.equal(isRateCyclePaperSymbol("CR"), true);
  assert.equal(isRateCyclePaperSymbol("CRH6"), true);
  assert.equal(isRateCyclePaperSymbol("RUCBTR5YNS"), false);
  assert.equal(isRateCyclePaperSymbol("RUCBITR1Y"), false);
  const mixed = {
    ...onlySpot,
    positions: [
      { symbol: "OBLG", side: "long", qty: "1", avg_px: "10" },
      { symbol: "CNYRUB_TOM", side: "long", qty: "0.2", avg_px: "12.75" },
    ],
  };
  assert.deepEqual(
    visibleRateCyclePositions(mixed).map((p) => p.symbol),
    ["OBLG"],
  );
});

test("index format uses Russian comma and does not invent 2,4419 without a number", () => {
  assert.equal(formatIndexRu(2.4419), "2,4419");
  assert.equal(formatIndexRu(1), "1");
  assert.equal(formatIndexRu(null), null);
  assert.equal(fromStartPctLine({ bot_id: "rf_conservative_comon", seed: "1", equity: "2.4419" }), "");
});

test("optional feed fields appear only when paper book is present", () => {
  assert.deepEqual(optionalFeedLines(PUBLISHED), []);
  const indexOnly = {
    ...PUBLISHED,
    positions: [{ symbol: "RUCBTR5YNS", side: "long", qty: "0.8", avg_px: "186.57" }],
    regime: "ease",
    far_pct: "80",
  };
  assert.deepEqual(optionalFeedLines(indexOnly), []);
  const withExtra = {
    ...PUBLISHED,
    positions: [{ symbol: "OBLG", side: "long", qty: "10", avg_px: "100" }],
    regime: "ease",
    far_pct: "80",
    near_pct: "20",
    cny_pct: "20",
    key_rate_pct: "14",
  };
  const lines = optionalFeedLines(withExtra);
  assert.ok(lines.some((l) => l.text === "режим ease"));
  assert.ok(lines.some((l) => /дальняя 80%/.test(l.text)));
  assert.ok(lines.some((l) => l.text === "ключевая 14%"));
});

test("history canon text is static and labeled as not a live account", () => {
  assert.equal(RATE_CYCLE_HISTORY_LABEL, "история, не живой счёт");
  assert.match(RATE_CYCLE_HISTORY_LINES.join(" "), /2019-06-28…2026-10-09/);
  assert.match(RATE_CYCLE_HISTORY_LINES.join(" "), /377 недель/);
  assert.match(RATE_CYCLE_HISTORY_LINES.join(" "), /CAGR 13,1%/);
  assert.match(RATE_CYCLE_HISTORY_LINES.join(" "), /просадка −5,6%/);
  assert.match(RATE_CYCLE_HISTORY_LINES.join(" "), /черновик/);
  assert.doesNotMatch(RATE_CYCLE_HISTORY_LINES.join(" "), /2,4419|seed|\/var\/|sqlite|state\.json/i);
});

test("rf conservative card is unchanged and stays RUB 50 000", () => {
  const merged = mergePortalAccounts(FEED_WITHOUT.accounts);
  const rfc = merged.find((a) => a.bot_id === "rf_conservative_comon");
  assert.equal(canonicalCurrency(rfc), "RUB");
  assert.equal(isRfBondsRateCycle(rfc), false);
  assert.equal(fromStartPctLine(rfc), "");
  assert.match(cardTitle(rfc), /РФ Консерватив/);
});
