import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalCurrency } from "./cashCurrency.js";
import { lastEquityValue, resolveEquityPoints } from "./equityChartModel.js";
import {
  calendarDaysSinceAsOf,
  cardUpdatedLine,
  cashOrLoanLine,
  emptyPositionsHint,
  formatRateRu,
  grossLine,
  isAsOfStale,
  isBorrowingLoan,
  mayakDetailLines,
  parseFeedNumber,
  regimeLine,
  stocksLine,
} from "./mayakCard.js";
import {
  MAYAK_ACCOUNTS,
  MAYAK_BOT_IDS,
  accountIdBadge,
  cardBlurb,
  cardSubtitle,
  cardTitle,
  chipLabel,
  hasAccountData,
  leverageBadge,
  mergePortalAccounts,
  underTitleLabel,
} from "./strategyMeta.js";

const FEED_WITHOUT_MAYAK = {
  accounts: [
    { bot_id: "v6b1", account_id: "v6b1", currency: "USDT", equity: "10000" },
    { bot_id: "cycle_6040_paper", account_id: "cycle_6040_paper", currency: "RUB", equity: "1000000" },
    { bot_id: "rf_conservative_comon", account_id: "rf_conservative_comon", currency: "RUB", equity: "50000" },
  ],
};

const HARD_LOWVOL = {
  bot_id: "mayak_imoex_lowvol10",
  account_id: "mayak_imoex_lowvol10",
  canonical_id: "MAYAK_imoex_lowvol10",
  currency: "RUB",
  seed: "250000",
  equity: "250180",
  cash: "250180",
  as_of: "2026-10-06",
  positions: [],
  note: "Бумага. «Маяк Low Vol», акции MOEX (TQBR) и LQDT, старт 250000 RUB. На биржу ордера не идут.",
  stocks: "0",
  gross: "0",
  borrowing: false,
  regime: "hard",
  key_rate_pct: "14",
  cpi_pct: "6.33",
  updated_utc: "2026-10-06T16:20:00Z",
};

const LEV15_BORROW = {
  bot_id: "mayak_imoex_mom10_lev15",
  account_id: "mayak_imoex_mom10_lev15",
  canonical_id: "MAYAK_imoex_mom10_lev15",
  currency: "USD",
  seed: "100000",
  equity: "101500",
  cash: "-50000",
  as_of: "2026-10-06",
  positions: [
    { symbol: "SBER", side: "long", qty: "10" },
    { symbol: "GAZP", side: "long", qty: "25" },
  ],
  note: "Бумага. «Маяк Momentum ×1,5», акции MOEX (TQBR) и LQDT, старт 100000 RUB. На биржу ордера не идут.",
  stocks: "151500",
  gross: "1.5",
  borrowing: true,
  regime: "attack",
  key_rate_pct: "14",
  cpi_pct: "6.33",
  updated_utc: "2026-10-06T16:20:00Z",
};

test("fixture without Mayak objects: four shells show нет данных, no invented equity or start capital", () => {
  const merged = mergePortalAccounts(FEED_WITHOUT_MAYAK.accounts);
  const rows = merged.filter((a) => MAYAK_BOT_IDS.includes(a.bot_id));
  assert.equal(rows.length, 4);
  assert.deepEqual(
    rows.map((a) => a.bot_id),
    MAYAK_BOT_IDS,
  );
  for (const row of rows) {
    assert.equal(row.no_data, true);
    assert.equal(row.currency, "RUB");
    assert.equal(hasAccountData(row), false);
    assert.equal(row.equity, undefined);
    assert.equal(row.seed, undefined);
    assert.notEqual(row.equity, "0");
    assert.notEqual(row.equity, 0);
    assert.deepEqual(resolveEquityPoints(row, { series: {} }), []);
    assert.equal(lastEquityValue(row), null);
  }
});

test("fixture with hard Mayak object: seed from feed, empty positions are not a problem", () => {
  const merged = mergePortalAccounts([...FEED_WITHOUT_MAYAK.accounts, HARD_LOWVOL]);
  const rows = merged.filter((a) => a.bot_id === "mayak_imoex_lowvol10");
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.no_data, undefined);
  assert.equal(hasAccountData(row), true);
  assert.equal(Number(row.seed), 250000);
  assert.equal(lastEquityValue(row), 250180);
  assert.deepEqual(row.positions, []);
  assert.match(regimeLine(row), /Жёсткий режим/);
  assert.match(regimeLine(row), /ключевая 14%/);
  assert.match(regimeLine(row), /инфляция 6,33%/);
  assert.equal(stocksLine(row), "акции 0 ₽");
  assert.equal(isBorrowingLoan(row), false);
  assert.match(cashOrLoanLine(row), /кэш/);
  assert.doesNotMatch(cashOrLoanLine(row), /заём/);
  assert.equal(emptyPositionsHint(row), "акций нет — всё в LQDT (деньги). Это ожидаемо, не ошибка.");
  const points = resolveEquityPoints(row, null);
  assert.equal(points.length, 1);
  assert.equal(Number(points[0].equity), 250180);
});

test("fixture leveraged Mayak: negative cash is заём, gross 1.5 is 150%", () => {
  const merged = mergePortalAccounts([...FEED_WITHOUT_MAYAK.accounts, LEV15_BORROW]);
  const row = merged.find((a) => a.bot_id === "mayak_imoex_mom10_lev15");
  assert.ok(row);
  assert.equal(hasAccountData(row), true);
  assert.equal(Number(row.seed), 100000);
  assert.equal(canonicalCurrency(row), "RUB");
  assert.equal(isBorrowingLoan(row), true);
  assert.match(cashOrLoanLine(row), /заём/);
  assert.doesNotMatch(cashOrLoanLine(row), /кэш/);
  assert.equal(grossLine(row), "доля акций 150%");
  assert.match(regimeLine(row), /Атака/);
  assert.equal(leverageBadge(row), "плечо 1,5");
  assert.equal(row.positions.length, 2);
  assert.equal(row.positions[0].qty, "10");
  assert.equal(row.positions[0].avg_px, undefined);
});

test("optional Mayak fields may be absent right after start", () => {
  const early = {
    bot_id: "mayak_imoex_mom10",
    account_id: "mayak_imoex_mom10",
    currency: "RUB",
    seed: "80000",
    equity: "80000",
    cash: "80000",
    as_of: "2026-10-06",
    positions: [],
    updated_utc: "2026-10-06T16:20:00Z",
  };
  assert.equal(hasAccountData(early), true);
  assert.equal(regimeLine(early), "");
  assert.equal(stocksLine(early), "");
  assert.equal(grossLine(early), "");
  assert.equal(isBorrowingLoan(early), false);
  assert.deepEqual(mayakDetailLines(early), [{ kind: "cash", text: cashOrLoanLine(early) }]);
  assert.equal(lastEquityValue(early), 80000);
});

test("numbers from the feed are parsed from strings", () => {
  assert.equal(parseFeedNumber("14"), 14);
  assert.equal(parseFeedNumber("6.33"), 6.33);
  assert.equal(parseFeedNumber("1.5"), 1.5);
  assert.equal(formatRateRu("6.33"), "6,33");
  assert.equal(formatRateRu("14"), "14");
  assert.equal(grossLine({ gross: "2" }), "доля акций 200%");
});

test("as_of is stale only after 5 calendar days", () => {
  const now = new Date("2026-10-06T12:00:00Z");
  assert.equal(isAsOfStale("2026-10-06", now), false);
  assert.equal(isAsOfStale("2026-10-02", now), false);
  assert.equal(isAsOfStale("2026-10-01", now), true);
  assert.equal(calendarDaysSinceAsOf("2026-10-01", now), 5);
  const weekendGap = cardUpdatedLine(
    { bot_id: "mayak_imoex_mom10", account_id: "mayak_imoex_mom10", as_of: "2026-10-02" },
    now,
  );
  assert.match(weekendGap, /сессия 2026-10-02/);
  assert.doesNotMatch(weekendGap, /устарело/);
  const stale = cardUpdatedLine(
    { bot_id: "mayak_imoex_mom10", account_id: "mayak_imoex_mom10", as_of: "2026-10-01" },
    now,
  );
  assert.match(stale, /устарело/);
});

test("four Mayak cards stay separate: titles, subtitles, blurbs, badges, RUB only", () => {
  const merged = mergePortalAccounts(FEED_WITHOUT_MAYAK.accounts);
  const rows = MAYAK_ACCOUNTS.map((spec) => merged.find((a) => a.bot_id === spec.bot_id));
  assert.equal(rows.length, 4);
  assert.equal(cardTitle(rows[0]), "Маяк Low Vol");
  assert.equal(cardTitle(rows[1]), "Маяк Momentum");
  assert.equal(cardTitle(rows[2]), "Маяк Momentum ×1,5");
  assert.equal(cardTitle(rows[3]), "Маяк Momentum ×2");
  assert.equal(chipLabel("mayak_imoex_lowvol10"), "Маяк Low Vol");
  assert.equal(cardSubtitle(rows[0]), "РФ, акции MOEX и LQDT, без плеча. На биржу ордера не идут.");
  assert.equal(cardSubtitle(rows[2]), "РФ, акции MOEX и LQDT, плечо 1,5. На биржу ордера не идут.");
  assert.equal(cardBlurb(rows[0]), "10 самых спокойных бумаг, до 10% на бумагу.");
  assert.equal(cardBlurb(rows[1]), "10 самых растущих за 120 дней, до 10% на бумагу.");
  assert.equal(cardBlurb(rows[2]), "до 15% на бумагу, всего до 150%.");
  assert.equal(cardBlurb(rows[3]), "до 20% на бумагу, всего до 200%.");
  assert.equal(leverageBadge(rows[0]), null);
  assert.equal(leverageBadge(rows[2]), "плечо 1,5");
  assert.equal(leverageBadge(rows[3]), "плечо 2");
  for (const row of rows) {
    assert.equal(canonicalCurrency(row), "RUB");
    assert.notEqual(canonicalCurrency(row), "USD");
    assert.notEqual(canonicalCurrency(row), "USDT");
    assert.equal(accountIdBadge(row), row.account_id);
    assert.equal(underTitleLabel(row), null);
    assert.doesNotMatch(cardTitle(row), /Цикл 60\/40|РФ Консерватив|Who-Pays|seed/i);
    assert.doesNotMatch(cardSubtitle(row), /seed/i);
  }
});

test("Mayak equity series uses the same bot_id::account_id history key", () => {
  const account = {
    bot_id: "mayak_imoex_mom10",
    account_id: "mayak_imoex_mom10",
    currency: "RUB",
    seed: "90000",
    equity: "91000",
    updated_utc: "2026-10-06T16:20:00Z",
  };
  const history = {
    series: {
      "mayak_imoex_mom10::mayak_imoex_mom10": {
        bot_id: "mayak_imoex_mom10",
        account_id: "mayak_imoex_mom10",
        currency: "RUB",
        points: [
          { t: "2026-10-05T16:20:00Z", equity: 90000 },
          { t: "2026-10-06T16:20:00Z", equity: 91000 },
        ],
      },
    },
  };
  const fromScalar = resolveEquityPoints({ ...account, equity: "91000" }, null);
  assert.equal(fromScalar.length, 1);
  const fromHistory = resolveEquityPoints({ ...account, equity: "" }, history);
  assert.equal(fromHistory.length, 2);
  assert.equal(fromHistory[1].equity, 91000);
});
