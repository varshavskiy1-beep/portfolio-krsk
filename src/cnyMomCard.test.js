import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalCurrency } from "./cashCurrency.js";
import {
  cnyMomDescription,
  cnyMomFallbackNote,
  cnyMomFromStartPctLine,
  cnyMomHistoryPoints,
  cnyMomOpenedLine,
  hasCnyMomAccountLine,
  isCnyMomPaperSymbol,
  visibleCnyMomPositions,
} from "./cnyMomCard.js";
import { buildSeries, lastEquityValue, resolveEquityPoints } from "./equityChartModel.js";
import {
  CNY_MOM_H360_ACCOUNT_ID,
  CNY_MOM_H360_BOT_ID,
  CNY_MOM_H360_CANON_ID,
  CNY_MOM_H360_CURRENCY,
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
