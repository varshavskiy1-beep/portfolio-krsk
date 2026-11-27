import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalCurrency } from "./cashCurrency.js";
import { buildSeries, lastEquityValue, resolveEquityPoints, seedPriceLineSpec } from "./equityChartModel.js";
import {
  formatMoexMulti360Equity,
  formatMoexMulti360Mark,
  hasMoexMulti360AccountLine,
  moexMulti360BookEquity,
  moexMulti360ChartMoneyLabel,
  moexMulti360CollateralLine,
  moexMulti360Description,
  moexMulti360EquityLine,
  moexMulti360FallbackNote,
  moexMulti360FromStartPctLine,
  moexMulti360HistoryPoints,
  moexMulti360OpenedLine,
  moexMulti360PositionSide,
  visibleMoexMulti360Positions,
} from "./moexMulti360Card.js";
import { parsePortalHash, isBlockedStrategyRoute } from "./portalRoute.js";
import {
  CNY_MOM_H360_BOT_ID,
  CNY_MOM_H360_TITLE,
  ETH_OKX_MOEX_BOT_ID,
  ETH_OKX_MOEX_TITLE,
  FORTS_ADR_ADAPTIVE_BOT_ID,
  FORTS_ADR_STATIC_BOT_ID,
  MOEX_QUAD_360_ACCOUNT_ID,
  MOEX_QUAD_360_BOT_ID,
  MOEX_QUAD_360_CANON_ID,
  MOEX_QUAD_360_CURRENCY,
  MOEX_QUAD_360_TITLE,
  MOEX_TRIO_360_ACCOUNT_ID,
  MOEX_TRIO_360_BOT_ID,
  MOEX_TRIO_360_CANON_ID,
  MOEX_TRIO_360_CURRENCY,
  MOEX_TRIO_360_TITLE,
  OFFICE_SIGNALS_COMON_CNY_BOT_ID,
  PUMP_RADAR_BOT_ID,
  RF_BONDS_RATE_CYCLE_BOT_ID,
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
  isMoexMulti360,
  isMoexQuad360,
  isMoexTrio360,
  isOfficeSignalsComonCny,
  isRfBondsRateCycle,
  mergePortalAccounts,
  showsFreeCash,
  showsPaperBadge,
  underTitleLabel,
  withMoexMulti360Aliases,
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
    { bot_id: OFFICE_SIGNALS_COMON_CNY_BOT_ID, account_id: OFFICE_SIGNALS_COMON_CNY_BOT_ID, currency: "RUB", equity: "1000000" },
  ],
};

const QUAD_BOOK = {
  bot_id: MOEX_QUAD_360_BOT_ID,
  account_id: MOEX_QUAD_360_ACCOUNT_ID,
  canonical_id: MOEX_QUAD_360_CANON_ID,
  display_name: MOEX_QUAD_360_TITLE,
  mode: "paper",
  currency: "RUB",
  seed: "1000000",
  seed_capital: 1000000.0,
  equity: "999705.16",
  cash: "999705.16",
  cash_rub: 999705.16,
  pct_return: -0.0295,
  as_of: "2026-11-27",
  updated_utc: "2026-11-27T16:40:05Z",
  ofz_secid: "SU26232RMFS7",
  ofz_qty: 0,
  ofz_value_rub: 0.0,
  go_used_rub: 162702.61,
  go_pct: 16.28,
  collateral_coverage_x: 6.14,
  positions: [
    {
      symbol: "CRZ6",
      secid: "CRZ6",
      code: "CNY",
      side: "long",
      qty: "51",
      signed_qty: 51,
      avg_px: "12.392",
      mark: "12.392",
      notional_rub: 631992.0,
      go_rub: 53873.85,
      status: "ok",
    },
    {
      symbol: "IMOEXF",
      secid: "IMOEXF",
      code: "IMOEXF",
      side: "short",
      qty: "14",
      signed_qty: -14,
      avg_px: "2368.5",
      mark: "2368.5",
      notional_rub: 331590.0,
      go_rub: 32918.76,
      status: "ok",
    },
    {
      symbol: "GLDRUBF",
      secid: "GLDRUBF",
      code: "GLDRUBF",
      side: "short",
      qty: "20",
      signed_qty: -20,
      avg_px: "8500",
      mark: "8500",
      notional_rub: 170000.0,
      go_rub: 40000,
      status: "ok",
    },
    {
      symbol: "EHZ6",
      secid: "EHZ6",
      code: "ETH",
      side: "short",
      qty: "100",
      signed_qty: -100,
      avg_px: "2500",
      mark: "2500",
      notional_rub: 250000.0,
      go_rub: 35000,
      status: "ok",
    },
    {
      symbol: "IDLE",
      secid: "IDLE",
      code: "IDLE",
      side: "long",
      qty: "0",
      signed_qty: 0,
    },
  ],
  history: [
    { t: "2026-11-27T15:49:18Z", equity: 1000000.0 },
    { t: "2026-11-27T16:00:00Z", equity: 999705.16 },
  ],
  equity_curve: [
    { t: "2026-11-27T15:49:18Z", equity: "1000000.00" },
    { t: "2026-11-27T16:00:00Z", equity: "999705.16" },
  ],
  note: "Бумага. «Кватро-360 Ставка и Крипта» (CR, IMOEXF, GLDRUBF, EH под 100% залог ближних ОФЗ <= 1 г.), старт 1 000 000 RUB. На биржу ордера не идут.",
};

const TRIO_BOOK = {
  bot_id: MOEX_TRIO_360_BOT_ID,
  account_id: MOEX_TRIO_360_ACCOUNT_ID,
  canonical_id: MOEX_TRIO_360_CANON_ID,
  display_name: MOEX_TRIO_360_TITLE,
  mode: "paper",
  currency: "RUB",
  seed: "1000000",
  seed_capital: 1000000.0,
  equity: "999734.12",
  cash: "999734.12",
  cash_rub: 999734.12,
  as_of: "2026-11-27",
  updated_utc: "2026-11-27T16:40:05Z",
  ofz_secid: "SU26232RMFS7",
  ofz_qty: 0,
  ofz_value_rub: 0.0,
  go_used_rub: 107000,
  go_pct: 10.7,
  collateral_coverage_x: 9.35,
  positions: [
    { symbol: "CRZ6", secid: "CRZ6", code: "CNY", side: "long", qty: "52", signed_qty: 52, mark: "12.392" },
    { symbol: "MMZ6", secid: "MMZ6", code: "MXI", side: "short", qty: "13", signed_qty: -13, mark: "2780" },
    { symbol: "GLDRUBF", secid: "GLDRUBF", code: "GLDRUBF", side: "short", qty: "21", signed_qty: -21, mark: "8500" },
  ],
  history: [
    { t: "2026-11-27T15:49:37Z", equity: 1000000.0 },
    { t: "2026-11-27T16:00:00Z", equity: 999734.12 },
  ],
  equity_curve: [
    { t: "2026-11-27T15:49:37Z", equity: "1000000.00" },
    { t: "2026-11-27T16:00:00Z", equity: "999734.12" },
  ],
  note: "Бумага. «Трио-360 · Всепогодный» (CR, MXI, GLDRUBF под 100% залог ближних ОФЗ <= 1 г.), старт 1 000 000 RUB. На биржу ордера не идут.",
};

const QUAD_OFZ_BOOK = {
  ...QUAD_BOOK,
  ofz_qty: 93,
  ofz_value_rub: 930000,
  positions: [
    {
      symbol: "SU26232RMFS7",
      secid: "SU26232RMFS7",
      code: "OFZ",
      side: "long",
      qty: "93",
      avg_px: "99.8",
      mark: "99.8",
      value_rub: 930000,
    },
    ...QUAD_BOOK.positions,
  ],
};

const QUAD_RAW_SIGNED = {
  bot_id: MOEX_QUAD_360_BOT_ID,
  account_id: MOEX_QUAD_360_BOT_ID,
  currency: "RUB",
  seed_capital: 1000000,
  cash_rub: 999705.16,
  equity: "999705.16",
  updated_at_utc: "2026-11-27T16:40:05Z",
  ofz_secid: "SU26232RMFS7",
  ofz_qty: 93,
  ofz_value_rub: 930000,
  go_pct: 16.28,
  collateral_coverage_x: 6.14,
  go_used_rub: 162702.61,
  positions: [
    { secid: "CRZ6", qty: 51, mark: "12.392" },
    { secid: "IMOEXF", qty: -14, mark: "2368.5" },
    { code: "GLDRUBF", qty: "-20", avg_px: "8500" },
    { symbol: "EHZ6", qty: 0, mark: "2500" },
  ],
  history: [{ t: "2026-11-27T15:49:18Z", equity: 1000000.0 }],
};

test("fixture without quatro/trio objects: shells show нет данных, no invented 1000000", () => {
  const merged = mergePortalAccounts(FEED_WITHOUT.accounts);
  const quad = merged.find((a) => a.bot_id === MOEX_QUAD_360_BOT_ID);
  const trio = merged.find((a) => a.bot_id === MOEX_TRIO_360_BOT_ID);
  assert.ok(quad);
  assert.ok(trio);
  assert.equal(quad.account_id, MOEX_QUAD_360_ACCOUNT_ID);
  assert.equal(trio.account_id, MOEX_TRIO_360_ACCOUNT_ID);
  for (const row of [quad, trio]) {
    assert.equal(row.no_data, true);
    assert.equal(hasAccountData(row), false);
    assert.equal(hasMoexMulti360AccountLine(row), false);
    assert.equal(row.equity, undefined);
    assert.equal(row.seed, undefined);
    assert.equal(canonicalCurrency(row), "RUB");
    assert.equal(showsPaperBadge(row), true);
    assert.equal(underTitleLabel(row), null);
    assert.equal(moexMulti360FromStartPctLine(row), "");
    assert.equal(moexMulti360EquityLine(row), "");
    assert.deepEqual(resolveEquityPoints(row, { series: {} }), []);
    assert.equal(isHistoryOnlyRubPaper(row), true);
    assert.equal(isMoexMulti360(row), true);
    assert.equal(isCnyMomH360(row), false);
    assert.equal(isEthOkxMoex(row), false);
    assert.equal(isRfBondsRateCycle(row), false);
    assert.equal(isOfficeSignalsComonCny(row), false);
  }
  assert.equal(MOEX_QUAD_360_CURRENCY, "RUB");
  assert.equal(MOEX_TRIO_360_CURRENCY, "RUB");
  assert.equal(cardTitle(quad), MOEX_QUAD_360_TITLE);
  assert.equal(cardTitle(trio), MOEX_TRIO_360_TITLE);
  assert.equal(chipLabel(MOEX_QUAD_360_BOT_ID), MOEX_QUAD_360_TITLE);
  assert.equal(chipLabel(MOEX_TRIO_360_BOT_ID), MOEX_TRIO_360_TITLE);
  assert.equal(accountIdBadge(quad), MOEX_QUAD_360_CANON_ID);
  assert.equal(accountIdBadge(trio), MOEX_TRIO_360_CANON_ID);
  assert.match(cardSubtitle(quad), /4 фьючерса/);
  assert.match(cardSubtitle(trio), /3 фьючерса/);
  assert.doesNotMatch(cardSubtitle(quad), /\bseed\b|Live|BTC|RGBITR/i);
  assert.doesNotMatch(cardSubtitle(trio), /\bseed\b|Live|BTC|MIX вместо/i);
  assert.equal(isMoexQuad360(trio), false);
  assert.equal(isMoexTrio360(quad), false);
});

test("quatro fixture: 999 705,16 ₽, −0,03% from start, 4 futures long/short, no OFZ while qty 0", () => {
  const merged = mergePortalAccounts([...FEED_WITHOUT.accounts, QUAD_BOOK]);
  const row = merged.find((a) => a.bot_id === MOEX_QUAD_360_BOT_ID);
  assert.equal(hasAccountData(row), true);
  assert.equal(hasMoexMulti360AccountLine(row), true);
  assert.equal(canonicalCurrency(row), "RUB");
  assert.equal(Number(row.seed), 1000000);
  assert.equal(lastEquityValue(row), 999705.16);
  assert.equal(moexMulti360BookEquity(row), 999705.16);
  assert.match(formatMoexMulti360Equity(row.equity), /999\s?705,16/);
  assert.match(moexMulti360EquityLine(row), /999\s?705,16 ₽/);
  assert.equal(moexMulti360FromStartPctLine(row), "−0,03% от старта");
  assert.doesNotMatch(moexMulti360FromStartPctLine(row), /seed|\./i);
  assert.equal(showsFreeCash(row), false);
  assert.equal(moexMulti360ChartMoneyLabel(), "₽");
  const visible = visibleMoexMulti360Positions(row);
  assert.deepEqual(
    visible.map((p) => `${p.symbol}:${p.side}:${p.qty}`),
    ["CRZ6:long:51", "IMOEXF:short:14", "GLDRUBF:short:20", "EHZ6:short:100"],
  );
  assert.equal(visible.some((p) => p.symbol === "SU26232RMFS7" || p.code === "OFZ"), false);
  assert.equal(moexMulti360PositionSide(visible.find((p) => p.symbol === "IMOEXF")), "short");
  assert.match(formatMoexMulti360Mark(visible[0]), /12,392|12.392/);
  assert.match(moexMulti360CollateralLine(row), /ОФЗ SU26232RMFS7/);
  assert.match(moexMulti360CollateralLine(row), /ГО 16,28% \(лимит 45%\)/);
  assert.match(moexMulti360CollateralLine(row), /покрытие 6,14×/);
  assert.match(moexMulti360Description(row), /Кватро-360 Ставка и Крипта/);
  assert.doesNotMatch(moexMulti360Description(row), /\bseed\b/i);
  const notionalSum =
    631992 + 331590 + 170000 + 250000;
  assert.notEqual(lastEquityValue(row), 999705.16 + notionalSum);
  const points = resolveEquityPoints(row, { series: {} });
  assert.equal(points.length, 2);
  assert.equal(points[0].t, "2026-11-27T15:49:18Z");
  assert.equal(Number(points[0].equity), 1000000);
  assert.equal(Number(points[1].equity), 999705.16);
  const money = buildSeries(points, 1000000, "money");
  assert.equal(money[0].value, 1000000);
  assert.equal(money[1].value, 999705.16);
  assert.deepEqual(seedPriceLineSpec(1000000, "money"), { price: 1000000, title: "начальный капитал" });
  const pct = buildSeries(points, 1000000, "pct");
  assert.equal(pct[0].value, 0);
  assert.ok(pct[1].value < 0);
});

test("trio fixture: 999 734,12 ₽, CR long / MM and gold short, hourly curve from 15:49:37Z", () => {
  const merged = mergePortalAccounts([...FEED_WITHOUT.accounts, TRIO_BOOK]);
  const row = merged.find((a) => a.bot_id === MOEX_TRIO_360_BOT_ID);
  assert.equal(hasMoexMulti360AccountLine(row), true);
  assert.match(moexMulti360EquityLine(row), /999\s?734,12 ₽/);
  assert.equal(moexMulti360FromStartPctLine(row), "−0,03% от старта");
  const visible = visibleMoexMulti360Positions(row);
  assert.deepEqual(
    visible.map((p) => `${p.symbol}:${p.side}:${p.qty}`),
    ["CRZ6:long:52", "MMZ6:short:13", "GLDRUBF:short:21"],
  );
  assert.equal(visible.some((p) => p.symbol === "IMOEXF" || p.symbol === "EHZ6" || p.symbol === "MIX"), false);
  assert.match(moexMulti360CollateralLine(row), /ГО 10,70% \(лимит 45%\)/);
  assert.match(moexMulti360CollateralLine(row), /покрытие 9,35×/);
  const points = resolveEquityPoints(row, { series: {} });
  assert.equal(points[0].t, "2026-11-27T15:49:37Z");
  assert.equal(Number(points[0].equity), 1000000);
  assert.equal(Number(points[1].equity), 999734.12);
});

test("OFZ collateral row appears when ofz_qty > 0 and is not duplicated", () => {
  const withRow = visibleMoexMulti360Positions(QUAD_OFZ_BOOK);
  assert.equal(withRow[0].symbol, "SU26232RMFS7");
  assert.equal(withRow[0].side, "long");
  assert.equal(withRow[0].qty, "93");
  assert.equal(withRow.filter((p) => p.symbol === "SU26232RMFS7").length, 1);
  const fromFields = visibleMoexMulti360Positions(QUAD_RAW_SIGNED);
  assert.equal(fromFields[0].symbol, "SU26232RMFS7");
  assert.equal(fromFields[0].qty, "93");
  assert.deepEqual(
    fromFields.slice(1).map((p) => `${p.symbol}:${p.side}:${p.qty}`),
    ["CRZ6:long:51", "IMOEXF:short:14", "GLDRUBF:short:20"],
  );
});

test("raw signed qty and field synonyms: seed_capital, cash_rub, updated_at_utc", () => {
  const merged = mergePortalAccounts([...FEED_WITHOUT.accounts, QUAD_RAW_SIGNED]);
  const row = merged.find(isMoexQuad360);
  assert.equal(row.seed, 1000000);
  assert.equal(row.cash, 999705.16);
  assert.equal(row.updated_utc, "2026-11-27T16:40:05Z");
  assert.equal(hasMoexMulti360AccountLine(row), true);
  assert.equal(moexMulti360FromStartPctLine(row), "−0,03% от старта");
  const aliased = withMoexMulti360Aliases(QUAD_RAW_SIGNED);
  assert.equal(aliased.seed, 1000000);
  assert.equal(aliased.cash, 999705.16);
  assert.equal(isMoexQuad360({ bot_id: MOEX_QUAD_360_BOT_ID, account_id: MOEX_QUAD_360_BOT_ID }), true);
  assert.equal(isMoexQuad360({ account_id: MOEX_QUAD_360_ACCOUNT_ID }), true);
});

test("history.series fallback when snapshot curve is empty; equity_curve wins over stale series", () => {
  const noCurve = { ...QUAD_BOOK, equity_curve: [], history: [] };
  const stored = {
    series: {
      "moex_quad_360_carry_v1::paper_moex_quad_360_carry_v1": {
        points: [
          { t: "2026-11-27T15:49:18Z", equity: 1000000 },
          { t: "2026-11-27T16:00:00Z", equity: 999705.16 },
        ],
      },
    },
  };
  const fromStore = moexMulti360HistoryPoints(noCurve, stored);
  assert.equal(fromStore.length, 2);
  assert.equal(Number(fromStore[1].equity), 999705.16);
  const stale = {
    series: {
      "moex_quad_360_carry_v1::paper_moex_quad_360_carry_v1": {
        points: [{ t: "2020-01-01T00:00:00Z", equity: 5000000 }],
      },
    },
  };
  const live = resolveEquityPoints(QUAD_BOOK, stale);
  assert.equal(live.length, 2);
  assert.ok(live.every((p) => Number(p.equity) !== 5000000));
  const shell = {
    bot_id: MOEX_QUAD_360_BOT_ID,
    account_id: MOEX_QUAD_360_ACCOUNT_ID,
    currency: "RUB",
    no_data: true,
  };
  assert.deepEqual(resolveEquityPoints(shell, stored), []);
  assert.equal(moexMulti360OpenedLine(QUAD_BOOK, live), "");
  assert.equal(moexMulti360OpenedLine({ ...QUAD_BOOK, history: [QUAD_BOOK.history[0]], equity_curve: [] }), "Счёт только открыт, история копится.");
});

test("GO 0 line when futures are flat; empty note uses fallback without seed", () => {
  const flat = { ...QUAD_BOOK, go_used_rub: 0, go_pct: 0, positions: [] };
  assert.equal(moexMulti360CollateralLine(flat), "ГО 0,0% · фьючерсы вне позиции");
  const noNote = { ...QUAD_BOOK, note: "" };
  assert.equal(moexMulti360Description(noNote), moexMulti360FallbackNote(noNote));
  assert.match(moexMulti360Description(noNote), /старт 1\s?000\s?000 ₽/);
  assert.match(moexMulti360Description(noNote), /На биржу ордера не идут/);
  assert.doesNotMatch(moexMulti360Description(noNote), /\bseed\b|Live|BTC/i);
});

test("simplified exporter account_id does not duplicate the paper_ shell", () => {
  const published = {
    bot_id: MOEX_QUAD_360_BOT_ID,
    account_id: MOEX_QUAD_360_BOT_ID,
    currency: "RUB",
    equity: "999705.16",
    seed: "1000000",
  };
  const merged = mergePortalAccounts([...FEED_WITHOUT.accounts, published]);
  const rows = merged.filter(isMoexQuad360);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].account_id, MOEX_QUAD_360_BOT_ID);
});

test("neighbor RUB cards stay separate; retired ids stay hidden", () => {
  const merged = mergePortalAccounts(FEED_WITHOUT.accounts);
  assert.equal(cardTitle(merged.find((a) => a.bot_id === CNY_MOM_H360_BOT_ID)), CNY_MOM_H360_TITLE);
  assert.equal(cardTitle(merged.find((a) => a.bot_id === ETH_OKX_MOEX_BOT_ID)), ETH_OKX_MOEX_TITLE);
  assert.equal(isMoexMulti360(merged.find((a) => a.bot_id === CNY_MOM_H360_BOT_ID)), false);
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
  assert.equal((latest.accounts || []).some((a) => a.bot_id === MOEX_QUAD_360_BOT_ID), false);
  assert.equal((latest.accounts || []).some((a) => a.bot_id === MOEX_TRIO_360_BOT_ID), false);
});

test("direct routes #/s/moex_quad_360_carry_v1 and #/s/moex_trio_360_clean_v1 are not blocked", () => {
  const quad = parsePortalHash("#/s/moex_quad_360_carry_v1");
  const trio = parsePortalHash("#/s/moex_trio_360_clean_v1");
  assert.equal(quad.name, "strategy");
  assert.equal(quad.botId, MOEX_QUAD_360_BOT_ID);
  assert.equal(trio.botId, MOEX_TRIO_360_BOT_ID);
  assert.equal(isBlockedStrategyRoute(quad), false);
  assert.equal(isBlockedStrategyRoute(trio), false);
  assert.equal(isHiddenPortalId(MOEX_QUAD_360_BOT_ID), false);
  assert.equal(isHiddenPortalId(MOEX_TRIO_360_BOT_ID), false);
});

test("authored passports validate with zero errors and no seed in UI", () => {
  for (const [botId, title, canon, facts] of [
    [
      MOEX_QUAD_360_BOT_ID,
      MOEX_QUAD_360_TITLE,
      MOEX_QUAD_360_CANON_ID,
      [/\+71,89%/, /−9,85%/, /MAR 7,30/, /Sharpe 3,33/, /\+67,87%/, /SU26232RMFS7/, /IMOEXF/, /EH\*/, /15%/, /≤ 45%/, /9e3ddff/],
    ],
    [
      MOEX_TRIO_360_BOT_ID,
      MOEX_TRIO_360_TITLE,
      MOEX_TRIO_360_CANON_ID,
      [/\+46,01%/, /−10,51%/, /MAR 4,38/, /Sharpe 2,69/, /\+43,11%/, /5 из 5/, /MM\*/, /мини-контракт/, /13%/, /MIX запрещён/, /9e3ddff/],
    ],
  ]) {
    assert.equal(hasAuthoredPassport(botId), true);
    const p = getPassport(botId);
    assert.equal(p.authored, true);
    assert.equal(p.title, title);
    assert.equal(p.accounts[0].currency, "RUB");
    assert.deepEqual(validatePassport(p), []);
    const text = [
      ...p.essence.paragraphs,
      ...p.decisionSteps,
      ...p.parameters.map((r) => `${r.name} ${r.value} ${r.meaning}`),
      ...p.risk.paragraphs,
      ...p.risk.items,
    ].join("\n");
    assert.match(p.parameters.find((r) => r.name === "Канон (документация)").value, new RegExp(canon));
    for (const re of facts) assert.match(text, re);
    assert.match(text, /ENABLE_EXCHANGE_ORDERS=0/);
    assert.match(text, /ОФЗ-ПД/);
    assert.doesNotMatch(text, /\bseed\b/i);
    assert.doesNotMatch(text, /RGBITR как рукав|live trading|BTC как рукав/i);
    for (const s of passportUiStrings(botId)) {
      assert.doesNotMatch(s, /\bseed\b/i, s);
      assert.doesNotMatch(s, /включить ордера/, s);
    }
    assert.equal(p.parameters.find((r) => r.name === "Начальный капитал").known, false);
    assert.equal(p.parameters.find((r) => r.name === "Начальный капитал").value, "нет данных");
    assert.equal(p.testing.status, "needs_data");
    assert.equal(p.testing.backtest, null);
  }
  const quadText = passportUiStrings(MOEX_QUAD_360_BOT_ID).join("\n");
  const trioText = passportUiStrings(MOEX_TRIO_360_BOT_ID).join("\n");
  assert.doesNotMatch(quadText, /Трио-360 · Всепогодный как основной/);
  assert.doesNotMatch(trioText, /EH\* \(ETH\)/);
  assert.doesNotMatch(trioText, /IMOEXF как рукав индекса/);
});
