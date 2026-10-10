import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalCurrency } from "./cashCurrency.js";
import { lastEquityValue, resolveEquityPoints, buildSeries } from "./equityChartModel.js";
import {
  RATE_CYCLE_OPENED_LINE,
  fromStartPctLine,
  hasRateCycleAccountLine,
  hasRateCyclePaperBook,
  isRateCyclePaperSymbol,
  rateCycleDescription,
  rateCycleFallbackNote,
  rateCycleHistoryPoints,
  rateCycleOpenedLine,
  visibleRateCyclePositions,
} from "./rateCycleCard.js";
import {
  RF_BONDS_RATE_CYCLE_ACCOUNT_ID,
  RF_BONDS_RATE_CYCLE_BOT_ID,
  RF_BONDS_RATE_CYCLE_CURRENCY,
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

const RUB_BOOK = {
  bot_id: RF_BONDS_RATE_CYCLE_BOT_ID,
  account_id: RF_BONDS_RATE_CYCLE_ACCOUNT_ID,
  currency: "RUB",
  seed: "300000",
  equity: "300000.0",
  updated_utc: "2026-10-10T08:13:19Z",
  as_of: "2026-10-09",
  book: "OBLG_SBRB_CR",
  positions: [
    { symbol: "OBLG", side: "long", qty: "1136", avg_px: "211.1" },
    { symbol: "SBRB", side: "long", qty: "3160", avg_px: "18.987" },
    { symbol: "CRZ6", side: "long", qty: "4", avg_px: "12.914" },
  ],
  history: [{ t: "2026-10-09", equity: "300000.0" }],
  note: "Бумага. «Цикл ставки 80/20», старт 300000 RUB. Паи OBLG и SBRB и фьючерс CR. На биржу ордера не идут.",
};

test("fixture without rate-cycle object: shell shows нет данных, no invented 300000", () => {
  const merged = mergePortalAccounts(FEED_WITHOUT.accounts);
  const row = merged.find((a) => a.bot_id === RF_BONDS_RATE_CYCLE_BOT_ID);
  assert.ok(row);
  assert.equal(row.account_id, RF_BONDS_RATE_CYCLE_ACCOUNT_ID);
  assert.equal(row.no_data, true);
  assert.equal(hasAccountData(row), false);
  assert.equal(hasRateCycleAccountLine(row), false);
  assert.equal(row.equity, undefined);
  assert.equal(row.seed, undefined);
  assert.equal(canonicalCurrency(row), "RUB");
  assert.equal(RF_BONDS_RATE_CYCLE_CURRENCY, "RUB");
  assert.equal(cardTitle(row), RF_BONDS_RATE_CYCLE_TITLE);
  assert.equal(chipLabel(RF_BONDS_RATE_CYCLE_BOT_ID), RF_BONDS_RATE_CYCLE_TITLE);
  assert.equal(showsPaperBadge(row), true);
  assert.equal(accountIdBadge(row), RF_BONDS_RATE_CYCLE_ACCOUNT_ID);
  assert.equal(underTitleLabel(row), null);
  assert.equal(fromStartPctLine(row), "");
  assert.deepEqual(resolveEquityPoints(row, { series: {} }), []);
  assert.doesNotMatch(cardTitle(row), /РФ Консерватив|Цикл 60\/40|50 000/);
  assert.doesNotMatch(cardSubtitle(row), /индекс богатства|старт 1|RUCBTR5YNS|CNYRUB|seed/i);
  assert.equal(isRfBondsRateCycle(row), true);
  assert.equal(isRfConservative(row), false);
});

test("RUB book fixture: 300 000 ₽, three paper legs, 0,00% from start", () => {
  const merged = mergePortalAccounts([...FEED_WITHOUT.accounts, RUB_BOOK]);
  const row = merged.find((a) => a.bot_id === RF_BONDS_RATE_CYCLE_BOT_ID);
  assert.equal(hasAccountData(row), true);
  assert.equal(hasRateCycleAccountLine(row), true);
  assert.equal(canonicalCurrency(row), "RUB");
  assert.equal(Number(row.seed), 300000);
  assert.equal(lastEquityValue(row), 300000);
  assert.equal(fromStartPctLine(row), "+0,00% от старта");
  assert.doesNotMatch(fromStartPctLine(row), /seed|\./i);
  const visible = visibleRateCyclePositions(row).map((p) => `${p.symbol}:${p.qty}`);
  assert.deepEqual(visible, ["OBLG:1136", "SBRB:3160", "CRZ6:4"]);
  assert.equal(hasRateCyclePaperBook(row), true);
  assert.match(rateCycleDescription(row), /Паи OBLG и SBRB и фьючерс CR/);
  assert.doesNotMatch(rateCycleDescription(row), /RUCBTR5YNS|RUCBITR1Y|CNYRUB|индекс богатства/);
  assert.equal(rateCycleOpenedLine(row), RATE_CYCLE_OPENED_LINE);
  const points = resolveEquityPoints(row, {
    series: {
      "rf_bonds_rate_cycle::rf_bonds_rate_cycle": {
        points: [
          { t: "2019-06-28", equity: "1.00" },
          { t: "2026-10-09", equity: "2.4419" },
        ],
      },
    },
  });
  assert.equal(points.length, 1);
  assert.equal(points[0].t, "2026-10-09");
  assert.equal(Number(points[0].equity), 300000);
  const series = buildSeries(points, 300000, "pct");
  assert.ok(series.length >= 2);
  assert.equal(series[series.length - 1].value, 0);
});

test("empty equity is нет данных even if the object exists", () => {
  const published = {
    ...RUB_BOOK,
    equity: null,
    history: [],
    error: "ledger_missing",
  };
  const merged = mergePortalAccounts([...FEED_WITHOUT.accounts, published]);
  const row = merged.find((a) => a.bot_id === RF_BONDS_RATE_CYCLE_BOT_ID);
  assert.equal(hasRateCycleAccountLine(row), false);
  assert.equal(fromStartPctLine(row), "");
  assert.deepEqual(rateCycleHistoryPoints(row), []);
});

test("CNYRUB_TOM is never a visible position; indexes are filtered", () => {
  const mixed = {
    ...RUB_BOOK,
    positions: [
      { symbol: "OBLG", side: "long", qty: "1136", avg_px: "211.1" },
      { symbol: "RUCBTR5YNS", side: "long", qty: "0.8", avg_px: "186.57" },
      { symbol: "CNYRUB_TOM", side: "long", qty: "0.2", avg_px: "12.75" },
    ],
  };
  assert.deepEqual(
    visibleRateCyclePositions(mixed).map((p) => p.symbol),
    ["OBLG"],
  );
  assert.equal(isRateCyclePaperSymbol("CNYRUB_TOM"), false);
  assert.equal(isRateCyclePaperSymbol("RUCBTR5YNS"), false);
  assert.equal(isRateCyclePaperSymbol("RUCBITR1Y"), false);
  assert.equal(isRateCyclePaperSymbol("CRZ6"), true);
  const indexNote = { ...RUB_BOOK, note: "старт 1, RUCBTR5YNS и CNYRUB_TOM" };
  assert.doesNotMatch(rateCycleDescription(indexNote), /RUCBTR5YNS|CNYRUB/);
  assert.match(rateCycleFallbackNote(indexNote), /300\s?000 ₽/);
});

test("empty note uses fallback with seed amount", () => {
  const noNote = { ...RUB_BOOK, note: "" };
  assert.match(rateCycleDescription(noNote), /старт 300\s?000 ₽/);
  assert.match(rateCycleDescription(noNote), /80% в OBLG и 20% в SBRB/);
  assert.match(rateCycleDescription(noNote), /фьючерс CR/);
  assert.doesNotMatch(rateCycleDescription(noNote), /seed|RUCBTR5YNS|CNYRUB/i);
});

test("rf conservative card is unchanged and stays RUB 50 000", () => {
  const merged = mergePortalAccounts(FEED_WITHOUT.accounts);
  const rfc = merged.find((a) => a.bot_id === "rf_conservative_comon");
  assert.equal(canonicalCurrency(rfc), "RUB");
  assert.equal(isRfBondsRateCycle(rfc), false);
  assert.equal(fromStartPctLine(rfc), "");
  assert.match(cardTitle(rfc), /РФ Консерватив/);
});
