import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalCurrency } from "./cashCurrency.js";
import { buildSeries, lastEquityValue, resolveEquityPoints } from "./equityChartModel.js";
import {
  formatOfficeSignalsEquity,
  formatOfficeSignalsMark,
  hasOfficeSignalsAccountLine,
  officeSignalsCollateralLine,
  officeSignalsDescription,
  officeSignalsEquityLine,
  officeSignalsFallbackNote,
  officeSignalsFromStartPctLine,
  officeSignalsHistoryPoints,
  officeSignalsOpenedLine,
  officeSignalsRegimeLine,
  visibleOfficeSignalsPositions,
} from "./officeSignalsComonCnyCard.js";
import { parsePortalHash, isBlockedStrategyRoute } from "./portalRoute.js";
import {
  CNY_MOM_H360_BOT_ID,
  CNY_MOM_H360_TITLE,
  ETH_OKX_MOEX_BOT_ID,
  ETH_OKX_MOEX_TITLE,
  FORTS_ADR_ADAPTIVE_BOT_ID,
  FORTS_ADR_STATIC_BOT_ID,
  OFFICE_SIGNALS_COMON_CNY_ACCOUNT_ID,
  OFFICE_SIGNALS_COMON_CNY_BOT_ID,
  OFFICE_SIGNALS_COMON_CNY_CANON_ID,
  OFFICE_SIGNALS_COMON_CNY_CURRENCY,
  OFFICE_SIGNALS_COMON_CNY_TITLE,
  PUMP_RADAR_BOT_ID,
  RF_BONDS_RATE_CYCLE_BOT_ID,
  RF_BONDS_RATE_CYCLE_TITLE,
  V6B1_BOT_ID,
  WHO_PAYS_US_EQ_ACCOUNT_ID,
  accountIdBadge,
  cardSubtitle,
  cardTitle,
  chipLabel,
  hasAccountData,
  isCnyMomH360,
  isEthOkxMoex,
  isHiddenPortalId,
  isHistoryOnlyRubPaper,
  isOfficeSignalsComonCny,
  isRfBondsRateCycle,
  mergePortalAccounts,
  showsFreeCash,
  showsPaperBadge,
  underTitleLabel,
} from "./strategyMeta.js";
import {
  getPassport,
  hasAuthoredPassport,
  passportUiStrings,
  validatePassport,
} from "./strategyPassport.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const latest = JSON.parse(readFileSync(join(root, "public/data/latest.json"), "utf8"));

const FEED_WITHOUT = {
  accounts: [
    { bot_id: "young_bounce_combo", account_id: "young_bounce_combo", currency: "USDT", equity: "10000" },
    { bot_id: RF_BONDS_RATE_CYCLE_BOT_ID, account_id: RF_BONDS_RATE_CYCLE_BOT_ID, currency: "RUB", equity: "300000" },
    { bot_id: CNY_MOM_H360_BOT_ID, account_id: CNY_MOM_H360_BOT_ID, currency: "RUB", equity: "300000" },
    { bot_id: ETH_OKX_MOEX_BOT_ID, account_id: ETH_OKX_MOEX_BOT_ID, currency: "RUB", equity: "300000" },
  ],
};

const PARK_BOOK = {
  bot_id: OFFICE_SIGNALS_COMON_CNY_BOT_ID,
  account_id: OFFICE_SIGNALS_COMON_CNY_ACCOUNT_ID,
  canonical_id: OFFICE_SIGNALS_COMON_CNY_CANON_ID,
  currency: "RUB",
  seed: "1000000",
  equity: "1000000.00",
  cash: "1000000.00",
  regime: "SMA40_PARK",
  as_of: "2026-11-24",
  updated_utc: "2026-11-24T16:30:05Z",
  positions: [{ symbol: "FMMM", side: "long", qty: "520000", avg_px: "1.92" }],
  history: [{ t: "2026-11-24", equity: 1000000.0 }],
  note: "Бумага. «Сигналы Офиса · Comon + Юань 360» (Режим A · CR 1,0×), старт 1 000 000 RUB. На биржу ордера не идут.",
};

const STOCKS_BOOK = {
  ...PARK_BOOK,
  equity: "1001250.50",
  cash: "81250.50",
  regime: "STOCKS_MXI",
  positions: [
    { symbol: "UGLD", side: "long", qty: "100", avg_px: "12.4" },
    { symbol: "CNRU", side: "long", qty: "80", avg_px: "15.1" },
    { symbol: "CBOM", side: "long", qty: "200", avg_px: "6.2" },
    { symbol: "SNGSP", side: "long", qty: "50", avg_px: "40.0" },
    { symbol: "TRNFP", side: "long", qty: "1", avg_px: "1400" },
    { symbol: "SBERP", side: "long", qty: "30", avg_px: "280" },
    { symbol: "HEAD", side: "long", qty: "10", avg_px: "210" },
    { symbol: "SBER", side: "long", qty: "25", avg_px: "300" },
    { symbol: "MMZ6", side: "long", qty: "36", mark: "2780" },
    { symbol: "FMMM", side: "long", qty: "40000", avg_px: "1.92" },
    { symbol: "IMOEXF", side: "long", qty: "10", mark: "2700" },
    { symbol: "CRZ6", side: "long", qty: "0", mark: "11.2" },
  ],
  history: [
    { t: "2026-11-24", equity: "1000000" },
    { t: "2026-11-25", equity: "1001250.50" },
  ],
};

const CNY_BOOK = {
  ...PARK_BOOK,
  equity: "998750.25",
  cash: "120000",
  regime: "CNY360_PARK",
  positions: [
    { symbol: "FMMM", side: "long", qty: "458000", avg_px: "1.92" },
    { symbol: "CRZ6", side: "long", qty: "88", mark: "11.25" },
    { symbol: "LQDT", side: "long", qty: "0", avg_px: "2.1" },
  ],
  history: [
    { t: "2026-11-24", equity: "1000000" },
    { t: "2026-11-25T13:21:00Z", equity: "998750.25" },
  ],
};

test("fixture without office-signals object: shell shows нет данных, no invented 1000000", () => {
  const merged = mergePortalAccounts(FEED_WITHOUT.accounts);
  const row = merged.find((a) => a.bot_id === OFFICE_SIGNALS_COMON_CNY_BOT_ID);
  assert.ok(row);
  assert.equal(row.account_id, OFFICE_SIGNALS_COMON_CNY_ACCOUNT_ID);
  assert.equal(row.no_data, true);
  assert.equal(hasAccountData(row), false);
  assert.equal(hasOfficeSignalsAccountLine(row), false);
  assert.equal(row.equity, undefined);
  assert.equal(row.seed, undefined);
  assert.equal(canonicalCurrency(row), "RUB");
  assert.equal(OFFICE_SIGNALS_COMON_CNY_CURRENCY, "RUB");
  assert.equal(cardTitle(row), OFFICE_SIGNALS_COMON_CNY_TITLE);
  assert.equal(chipLabel(OFFICE_SIGNALS_COMON_CNY_BOT_ID), OFFICE_SIGNALS_COMON_CNY_TITLE);
  assert.equal(showsPaperBadge(row), true);
  assert.equal(accountIdBadge(row), OFFICE_SIGNALS_COMON_CNY_CANON_ID);
  assert.equal(underTitleLabel(row), null);
  assert.equal(officeSignalsFromStartPctLine(row), "");
  assert.equal(officeSignalsEquityLine(row), "");
  assert.equal(officeSignalsRegimeLine(row), "");
  assert.deepEqual(resolveEquityPoints(row, { series: {} }), []);
  assert.doesNotMatch(cardTitle(row), /Цикл ставки 80\/20|ETH по сигналу OKX|РФ Консерватив|Цикл 60\/40/);
  assert.equal(
    cardSubtitle(row),
    "РФ, акции MOEX + фьючерс MXI, парковка FMMM и юань CR 1,0×, старт 1 000 000 ₽. На биржу ордера не идут.",
  );
  assert.doesNotMatch(cardSubtitle(row), /\bseed\b/i);
  assert.equal(isOfficeSignalsComonCny(row), true);
  assert.equal(isHistoryOnlyRubPaper(row), true);
  assert.equal(isCnyMomH360(row), false);
  assert.equal(isEthOkxMoex(row), false);
  assert.equal(isRfBondsRateCycle(row), false);
});

test("SMA40_PARK fixture: 1 000 000,00 ₽, FMMM only, 0,00% from start", () => {
  const merged = mergePortalAccounts([...FEED_WITHOUT.accounts, PARK_BOOK]);
  const row = merged.find((a) => a.bot_id === OFFICE_SIGNALS_COMON_CNY_BOT_ID);
  assert.equal(hasAccountData(row), true);
  assert.equal(hasOfficeSignalsAccountLine(row), true);
  assert.equal(canonicalCurrency(row), "RUB");
  assert.equal(Number(row.seed), 1000000);
  assert.equal(lastEquityValue(row), 1000000);
  assert.match(formatOfficeSignalsEquity(row.equity), /1\s?000\s?000,00/);
  assert.match(officeSignalsEquityLine(row), /1\s?000\s?000,00 ₽/);
  assert.equal(officeSignalsFromStartPctLine(row), "+0,00% от старта");
  assert.doesNotMatch(officeSignalsFromStartPctLine(row), /seed|\./i);
  assert.match(officeSignalsRegimeLine(row), /SMA40_PARK/);
  assert.match(officeSignalsRegimeLine(row), /FMMM/);
  assert.doesNotMatch(officeSignalsRegimeLine(row), /CR 1,0×/);
  const visible = visibleOfficeSignalsPositions(row).map((p) => `${p.symbol}:${p.side}:${p.qty}`);
  assert.deepEqual(visible, ["FMMM:long:520000"]);
  assert.match(formatOfficeSignalsMark(row.positions[0]), /1,92/);
  assert.equal(showsFreeCash(row), false);
  assert.equal(officeSignalsCollateralLine(row), "");
  assert.match(officeSignalsDescription(row), /Сигналы Офиса · Comon \+ Юань 360/);
  assert.doesNotMatch(officeSignalsDescription(row), /\bseed\b/i);
  assert.equal(officeSignalsOpenedLine(row), "Счёт только открыт, история копится.");
  const points = resolveEquityPoints(row, {
    series: {
      "office_signals_comon_cny::office_signals_comon_cny": {
        points: [
          { t: "2019-07-31", equity: "19100000" },
          { t: "2026-10-30", equity: "8171644" },
        ],
      },
    },
  });
  assert.equal(points.length, 1);
  assert.equal(points[0].t, "2026-11-24");
  assert.equal(Number(points[0].equity), 1000000);
  assert.ok(points.every((p) => Number(p.equity) !== 19100000));
  assert.ok(points.every((p) => Number(p.equity) !== 8171644));
  const series = buildSeries(points, 1000000, "pct");
  assert.equal(series.length, 1);
  assert.equal(series[0].value, 0);
});

test("STOCKS_MXI fixture: eight stocks + MMZ6, IMOEXF hidden, CR qty 0 hidden", () => {
  const visible = visibleOfficeSignalsPositions(STOCKS_BOOK).map((p) => p.symbol);
  assert.deepEqual(visible, [
    "UGLD",
    "CNRU",
    "CBOM",
    "SNGSP",
    "TRNFP",
    "SBERP",
    "HEAD",
    "SBER",
    "MMZ6",
    "FMMM",
  ]);
  assert.equal(visible.includes("IMOEXF"), false);
  assert.equal(visible.includes("CRZ6"), false);
  assert.match(officeSignalsRegimeLine(STOCKS_BOOK), /STOCKS_MXI/);
  assert.match(officeSignalsEquityLine(STOCKS_BOOK), /1\s?001\s?250,50 ₽/);
  assert.equal(officeSignalsFromStartPctLine(STOCKS_BOOK), "+0,13% от старта");
  assert.equal(officeSignalsOpenedLine(STOCKS_BOOK), "");
  const points = officeSignalsHistoryPoints(STOCKS_BOOK);
  assert.equal(points.length, 2);
});

test("CNY360_PARK fixture: FMMM + CRZ6, zero LQDT hidden", () => {
  const visible = visibleOfficeSignalsPositions(CNY_BOOK).map((p) => `${p.symbol}:${p.qty}`);
  assert.deepEqual(visible, ["FMMM:458000", "CRZ6:88"]);
  assert.equal(visible.some((s) => s.startsWith("LQDT")), false);
  assert.match(officeSignalsRegimeLine(CNY_BOOK), /CNY360_PARK/);
  assert.match(officeSignalsRegimeLine(CNY_BOOK), /CR строго 1,0×/);
  assert.equal(officeSignalsFromStartPctLine(CNY_BOOK), "−0,12% от старта");
  assert.match(officeSignalsEquityLine(CNY_BOOK), /998\s?750,25 ₽/);
});

test("futures notional is not added to equity; cash is not free money", () => {
  const withNotional = {
    ...STOCKS_BOOK,
    positions: [
      {
        symbol: "MMZ6",
        side: "long",
        qty: "36",
        mark: "2780",
        value_rub: String(36 * 2780 * 10),
      },
      {
        symbol: "CRZ6",
        side: "long",
        qty: "88",
        mark: "11.25",
        value_rub: String(88 * 11.25 * 1000),
      },
    ],
  };
  assert.equal(lastEquityValue(withNotional), 1001250.5);
  assert.notEqual(lastEquityValue(withNotional), 1001250.5 + 36 * 2780 * 10);
  assert.notEqual(lastEquityValue(withNotional), 1001250.5 + 88 * 11.25 * 1000);
  assert.equal(showsFreeCash(withNotional), false);
  assert.equal(officeSignalsCollateralLine(withNotional), "");
});

test("empty equity is нет данных even if the object exists", () => {
  const published = { ...PARK_BOOK, equity: null, history: [], error: "ledger_missing" };
  const merged = mergePortalAccounts([...FEED_WITHOUT.accounts, published]);
  const row = merged.find((a) => a.bot_id === OFFICE_SIGNALS_COMON_CNY_BOT_ID);
  assert.equal(hasOfficeSignalsAccountLine(row), false);
  assert.equal(officeSignalsFromStartPctLine(row), "");
  assert.deepEqual(officeSignalsHistoryPoints(row), []);
});

test("empty note uses fallback copy without seed", () => {
  const noNote = { ...PARK_BOOK, note: "" };
  assert.equal(officeSignalsDescription(noNote), officeSignalsFallbackNote(noNote));
  assert.match(officeSignalsDescription(noNote), /старт 1\s?000\s?000 ₽/);
  assert.match(officeSignalsDescription(noNote), /Режим A · CR 1,0×/);
  assert.match(officeSignalsDescription(noNote), /На биржу ордера не идут/);
  assert.doesNotMatch(officeSignalsDescription(noNote), /\bseed\b|\/var\/lib|sqlite/i);
});

test("yuan 360, ETH and rate-cycle stay separate RUB cards", () => {
  const merged = mergePortalAccounts(FEED_WITHOUT.accounts);
  const cny = merged.find((a) => a.bot_id === CNY_MOM_H360_BOT_ID);
  const eth = merged.find((a) => a.bot_id === ETH_OKX_MOEX_BOT_ID);
  const rbc = merged.find((a) => a.bot_id === RF_BONDS_RATE_CYCLE_BOT_ID);
  assert.equal(isOfficeSignalsComonCny(cny), false);
  assert.equal(isOfficeSignalsComonCny(eth), false);
  assert.equal(isOfficeSignalsComonCny(rbc), false);
  assert.equal(officeSignalsFromStartPctLine(cny), "");
  assert.equal(cardTitle(cny), CNY_MOM_H360_TITLE);
  assert.equal(cardTitle(eth), ETH_OKX_MOEX_TITLE);
  assert.equal(cardTitle(rbc), RF_BONDS_RATE_CYCLE_TITLE);
});

test("direct route #/s/office_signals_comon_cny is not blocked", () => {
  const route = parsePortalHash("#/s/office_signals_comon_cny");
  assert.equal(route.name, "strategy");
  assert.equal(route.botId, OFFICE_SIGNALS_COMON_CNY_BOT_ID);
  assert.equal(isBlockedStrategyRoute(route), false);
  assert.equal(isHiddenPortalId(OFFICE_SIGNALS_COMON_CNY_BOT_ID), false);
});

test("authored passport validates with zero errors and no seed in UI", () => {
  assert.equal(hasAuthoredPassport(OFFICE_SIGNALS_COMON_CNY_BOT_ID), true);
  const p = getPassport(OFFICE_SIGNALS_COMON_CNY_BOT_ID);
  assert.equal(p.authored, true);
  assert.equal(p.title, OFFICE_SIGNALS_COMON_CNY_TITLE);
  assert.equal(p.accounts[0].currency, "RUB");
  assert.deepEqual(validatePassport(p), []);
  const text = [
    ...p.essence.paragraphs,
    ...p.decisionSteps,
    ...p.parameters.map((r) => `${r.name} ${r.value} ${r.meaning}`),
    ...p.risk.paragraphs,
    ...p.risk.items,
  ].join("\n");
  assert.match(text, /STOCKS_MXI/);
  assert.match(text, /SMA40_PARK/);
  assert.match(text, /CNY360_PARK/);
  assert.match(text, /Режим A/);
  assert.match(text, /1,0×/);
  assert.match(text, /keep-alive/);
  assert.match(text, /60 календарных/);
  assert.match(text, /cny-tick Пн–Сб 10\.\.23:21/);
  assert.match(text, /cny-close-before-stocks Пн–Пт 18:00, 18:05/);
  assert.match(text, /daily-tick Пн–Пт 18:25, 18:30/);
  assert.match(text, /eod-shadow Пн–Пт 19:30, 20:00/);
  assert.match(text, /исторический replay/);
  assert.match(text, /CAGR \+65,95%/);
  assert.match(text, /MaxDD −9,46%/);
  assert.match(text, /LongDD 77 дн/);
  assert.match(text, /MAR 6,97/);
  assert.match(text, /ИТА 0,405/);
  assert.match(text, /CAGR \+50,29%/);
  assert.match(text, /MaxDD −17,71%/);
  assert.match(text, /LongDD 151 дн/);
  assert.match(text, /MAR 2,84/);
  assert.match(text, /ИТА 0,538/);
  assert.match(text, /не живая доходность|не live/i);
  assert.match(text, /08d3ca6/);
  assert.match(text, /Режим B \(юань в паузе SMA40\) запрещён|Режим B, плечо CR выше 1,0×/);
  assert.match(text, /IMOEXF запрещён/);
  assert.doesNotMatch(text, /\bseed\b/i);
  for (const s of passportUiStrings(OFFICE_SIGNALS_COMON_CNY_BOT_ID)) {
    assert.doesNotMatch(s, /\bseed\b/i, s);
    assert.doesNotMatch(s, /включить ордера/, s);
    assert.doesNotMatch(s, /\/var\/lib|sqlite/, s);
  }
  assert.equal(p.parameters.find((r) => r.name === "Начальный капитал").known, false);
  assert.equal(p.parameters.find((r) => r.name === "Начальный капитал").value, "нет данных");
  assert.equal(p.testing.status, "needs_data");
  assert.equal(p.testing.backtest, null);
});

test("retired cards stay retired; CNY book from 12 Oct stays in history.json", () => {
  for (const id of [
    V6B1_BOT_ID,
    WHO_PAYS_US_EQ_ACCOUNT_ID,
    PUMP_RADAR_BOT_ID,
    FORTS_ADR_ADAPTIVE_BOT_ID,
    FORTS_ADR_STATIC_BOT_ID,
    "paper_block2",
  ]) {
    assert.equal(isHiddenPortalId(id), true, id);
  }
  const cny = (latest.accounts || []).find((a) => a.bot_id === CNY_MOM_H360_BOT_ID);
  assert.ok(cny, "cny_mom_h360 must remain in latest.json");
  const history = JSON.parse(readFileSync(join(root, "public/data/history.json"), "utf8"));
  const cnyPts = history?.series?.["cny_mom_h360::cny_mom_h360"]?.points || [];
  assert.ok(cnyPts.length, "cny_mom_h360 stored history must stay published");
  assert.equal(String(cnyPts[0]?.t || "").startsWith("2026-10-12"), true);
  assert.equal((latest.accounts || []).some((a) => a.bot_id === OFFICE_SIGNALS_COMON_CNY_BOT_ID), false);
});
