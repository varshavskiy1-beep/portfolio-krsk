import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalCurrency } from "./cashCurrency.js";
import {
  collapseHistoryByDay,
  ethOkxCollateralLine,
  ethOkxDescription,
  ethOkxEquityLine,
  ethOkxFallbackNote,
  ethOkxFromStartPctLine,
  ethOkxHistoryPoints,
  ethOkxOpenedLine,
  formatEthOkxEquity,
  formatEthOkxMark,
  hasEthOkxAccountLine,
  visibleEthOkxPositions,
} from "./ethOkxCard.js";
import { buildSeries, lastEquityValue, resolveEquityPoints } from "./equityChartModel.js";
import {
  CNY_MOM_H360_BOT_ID,
  CNY_MOM_H360_TITLE,
  ETH_OKX_MOEX_ACCOUNT_ID,
  ETH_OKX_MOEX_BOT_ID,
  ETH_OKX_MOEX_CANON_ID,
  ETH_OKX_MOEX_CURRENCY,
  ETH_OKX_MOEX_TITLE,
  RF_BONDS_RATE_CYCLE_BOT_ID,
  RF_BONDS_RATE_CYCLE_TITLE,
  accountIdBadge,
  cardSubtitle,
  cardTitle,
  chipLabel,
  hasAccountData,
  isCnyMomH360,
  isEthOkxMoex,
  isHistoryOnlyRubPaper,
  isRfBondsRateCycle,
  mergePortalAccounts,
  showsFreeCash,
  showsPaperBadge,
  underTitleLabel,
} from "./strategyMeta.js";

const FEED_WITHOUT = {
  accounts: [
    { bot_id: "v6b1", account_id: "v6b1", currency: "USDT", equity: "10000" },
    { bot_id: RF_BONDS_RATE_CYCLE_BOT_ID, account_id: RF_BONDS_RATE_CYCLE_BOT_ID, currency: "RUB", equity: "300000" },
    { bot_id: CNY_MOM_H360_BOT_ID, account_id: CNY_MOM_H360_BOT_ID, currency: "RUB", equity: "300000" },
  ],
};

const RUB_BOOK = {
  bot_id: ETH_OKX_MOEX_BOT_ID,
  account_id: ETH_OKX_MOEX_ACCOUNT_ID,
  currency: "RUB",
  seed: "300000",
  equity: "299970.19681904",
  cash: "299970.19681904",
  updated_utc: "2026-10-13T05:45:00Z",
  as_of: "2026-10-13",
  positions: [{ symbol: "EHV6", side: "short", qty: "70", mark: "2536.7" }],
  history: [
    { t: "2026-10-13", equity: "300000" },
    { t: "2026-10-13T05:45:00Z", equity: "299970.19681904" },
  ],
  note: "Бумага. «ETH по сигналу OKX», старт 300000 RUB. Фьючерс ETH на Мосбирже. На биржу ордера не идут.",
};

test("fixture without eth-okx object: shell shows нет данных, no invented 300000", () => {
  const merged = mergePortalAccounts(FEED_WITHOUT.accounts);
  const row = merged.find((a) => a.bot_id === ETH_OKX_MOEX_BOT_ID);
  assert.ok(row);
  assert.equal(row.account_id, ETH_OKX_MOEX_ACCOUNT_ID);
  assert.equal(row.no_data, true);
  assert.equal(hasAccountData(row), false);
  assert.equal(hasEthOkxAccountLine(row), false);
  assert.equal(row.equity, undefined);
  assert.equal(row.seed, undefined);
  assert.equal(canonicalCurrency(row), "RUB");
  assert.equal(ETH_OKX_MOEX_CURRENCY, "RUB");
  assert.equal(cardTitle(row), ETH_OKX_MOEX_TITLE);
  assert.equal(chipLabel(ETH_OKX_MOEX_BOT_ID), ETH_OKX_MOEX_TITLE);
  assert.equal(showsPaperBadge(row), true);
  assert.equal(accountIdBadge(row), ETH_OKX_MOEX_CANON_ID);
  assert.equal(underTitleLabel(row), null);
  assert.equal(ethOkxFromStartPctLine(row), "");
  assert.equal(ethOkxEquityLine(row), "");
  assert.deepEqual(resolveEquityPoints(row, { series: {} }), []);
  assert.doesNotMatch(cardTitle(row), /Цикл ставки 80\/20|Юань 360|РФ Консерватив|Цикл 60\/40/);
  assert.doesNotMatch(cardSubtitle(row), /индекс|RUCBTR5YNS|CNYRUB|seed|2,046839/i);
  assert.equal(isEthOkxMoex(row), true);
  assert.equal(isHistoryOnlyRubPaper(row), true);
  assert.equal(isCnyMomH360(row), false);
  assert.equal(isRfBondsRateCycle(row), false);
});

test("RUB book fixture: 299 970,20 ₽, short EHV6 70, −0,01% from start", () => {
  const merged = mergePortalAccounts([...FEED_WITHOUT.accounts, RUB_BOOK]);
  const row = merged.find((a) => a.bot_id === ETH_OKX_MOEX_BOT_ID);
  assert.equal(hasAccountData(row), true);
  assert.equal(hasEthOkxAccountLine(row), true);
  assert.equal(canonicalCurrency(row), "RUB");
  assert.equal(Number(row.seed), 300000);
  assert.equal(lastEquityValue(row), 299970.19681904);
  assert.match(formatEthOkxEquity(row.equity), /299\s?970,20/);
  assert.match(ethOkxEquityLine(row), /299\s?970,20 ₽/);
  assert.equal(ethOkxFromStartPctLine(row), "−0,01% от старта");
  assert.doesNotMatch(ethOkxFromStartPctLine(row), /seed|\./i);
  const visible = visibleEthOkxPositions(row).map((p) => `${p.symbol}:${p.side}:${p.qty}`);
  assert.deepEqual(visible, ["EHV6:short:70"]);
  assert.match(formatEthOkxMark(row.positions[0]), /2\s?536,7/);
  assert.doesNotMatch(visible.join(" "), /LQDT/);
  assert.equal(showsFreeCash(row), false);
  assert.equal(ethOkxCollateralLine(row), "");
  assert.match(ethOkxDescription(row), /ETH по сигналу OKX/);
  assert.doesNotMatch(ethOkxDescription(row), /2,046839|2\.046839/);
  assert.equal(ethOkxOpenedLine(row), "Счёт только открыт, история копится.");
  const points = resolveEquityPoints(row, {
    series: {
      "eth_okx_moex::eth_okx_moex": {
        points: [
          { t: "2025-01-01", equity: "2.046839" },
          { t: "2026-10-13", equity: "2536.7" },
        ],
      },
    },
  });
  assert.equal(points.length, 1);
  assert.equal(points[0].t, "2026-10-13");
  assert.equal(Number(points[0].equity), 299970.19681904);
  assert.ok(points.every((p) => Number(p.equity) !== 2.046839));
  assert.ok(points.every((p) => Number(p.equity) !== 2536.7));
  const series = buildSeries(points, 300000, "pct");
  assert.equal(series.length, 1);
  const lastPct = series[0].value;
  assert.ok(Math.abs(lastPct + 0.009934393653333) < 1e-9);
});

test("futures notional is not added to equity; cash is not free money", () => {
  const withNotional = {
    ...RUB_BOOK,
    positions: [
      {
        symbol: "EHV6",
        side: "short",
        qty: "70",
        mark: "2536.7",
        value_rub: String(70 * 2536.7),
      },
    ],
  };
  assert.equal(lastEquityValue(withNotional), 299970.19681904);
  assert.notEqual(lastEquityValue(withNotional), 299970.19681904 + 70 * 2536.7);
  assert.equal(showsFreeCash(withNotional), false);
  assert.equal(ethOkxCollateralLine(withNotional), "");
});

test("same calendar day keeps the last point and does not break the daily axis", () => {
  const collapsed = collapseHistoryByDay([
    { t: "2026-10-13", equity: "300000" },
    { t: "2026-10-13T05:45:00Z", equity: "299970.19681904" },
  ]);
  assert.equal(collapsed.length, 1);
  assert.equal(collapsed[0].t, "2026-10-13");
  assert.equal(Number(collapsed[0].equity), 299970.19681904);
  const twoDays = collapseHistoryByDay([
    { t: "2026-10-13", equity: "300000" },
    { t: "2026-10-14", equity: "299900" },
  ]);
  assert.equal(twoDays.length, 2);
  assert.equal(ethOkxOpenedLine({ ...RUB_BOOK, history: twoDays }), "");
});

test("empty equity is нет данных even if the object exists", () => {
  const published = { ...RUB_BOOK, equity: null, history: [], error: "ledger_missing" };
  const merged = mergePortalAccounts([...FEED_WITHOUT.accounts, published]);
  const row = merged.find((a) => a.bot_id === ETH_OKX_MOEX_BOT_ID);
  assert.equal(hasEthOkxAccountLine(row), false);
  assert.equal(ethOkxFromStartPctLine(row), "");
  assert.deepEqual(ethOkxHistoryPoints(row), []);
});

test("qty 0 rows are hidden; LQDT is not invented", () => {
  const mixed = {
    ...RUB_BOOK,
    positions: [
      { symbol: "EHV6", side: "short", qty: "70", mark: "2536.7" },
      { symbol: "EHV6", side: "short", qty: "0", mark: "2536.7" },
      { symbol: "LQDT", side: "long", qty: "0", avg_px: "2.1" },
    ],
  };
  assert.deepEqual(
    visibleEthOkxPositions(mixed).map((p) => `${p.symbol}:${p.qty}`),
    ["EHV6:70"],
  );
  const onlyFut = { ...RUB_BOOK, positions: [{ symbol: "EHV6", side: "short", qty: "70", avg_px: "2536.7" }] };
  assert.equal(visibleEthOkxPositions(onlyFut).some((p) => p.symbol === "LQDT"), false);
  assert.match(formatEthOkxMark(onlyFut.positions[0]), /2\s?536,7/);
});

test("empty note uses fallback copy", () => {
  const noNote = { ...RUB_BOOK, note: "" };
  assert.equal(ethOkxDescription(noNote), ethOkxFallbackNote(noNote));
  assert.match(ethOkxDescription(noNote), /старт 300\s?000 ₽/);
  assert.match(ethOkxDescription(noNote), /720 закрытых часов ETH-USDT-SWAP/);
  assert.match(ethOkxDescription(noNote), /номинал — половина рублей/);
  assert.match(ethOkxDescription(noNote), /На Автоследование не выводится/);
  assert.doesNotMatch(ethOkxDescription(noNote), /seed|2,046839|\/var\/lib|sqlite/i);
});

test("yuan 360 and rate-cycle stay separate RUB cards", () => {
  const merged = mergePortalAccounts(FEED_WITHOUT.accounts);
  const cny = merged.find((a) => a.bot_id === CNY_MOM_H360_BOT_ID);
  const rbc = merged.find((a) => a.bot_id === RF_BONDS_RATE_CYCLE_BOT_ID);
  assert.equal(isEthOkxMoex(cny), false);
  assert.equal(isEthOkxMoex(rbc), false);
  assert.equal(ethOkxFromStartPctLine(cny), "");
  assert.equal(cardTitle(cny), CNY_MOM_H360_TITLE);
  assert.equal(cardTitle(rbc), RF_BONDS_RATE_CYCLE_TITLE);
});
