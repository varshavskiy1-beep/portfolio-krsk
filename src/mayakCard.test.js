import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalCurrency } from "./cashCurrency.js";
import { lastEquityValue, resolveEquityPoints, buildSeries } from "./equityChartModel.js";
import {
  HARD_EXIT_LINE,
  calendarDaysSinceAsOf,
  cardUpdatedLine,
  cashOrLoanLine,
  emptyPositionsHint,
  formatRateRu,
  formatRuFixed,
  grossLine,
  hardCanonLine,
  isAsOfStale,
  isBorrowingLoan,
  mayakDetailLines,
  mayakFromStartLine,
  parseFeedNumber,
  regimeLine,
  stocksLine,
  unusedLeverageLine,
} from "./mayakCard.js";
import { formatUpdatedLine } from "./strategyMeta.js";
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

const HARD_FEED = {
  bot_id: "mayak_imoex_lowvol10",
  account_id: "mayak_imoex_lowvol10",
  canonical_id: "MAYAK_imoex_lowvol10",
  currency: "RUB",
  seed: "300000",
  equity: "300114.198705748",
  cash: "300114.198705748",
  as_of: "2026-10-06",
  positions: [],
  note: "Бумага. «Маяк Low Vol», акции MOEX (TQBR) и LQDT, старт 300 000 RUB. На биржу ордера не идут.",
  stocks: "0",
  gross: "0",
  borrowing: false,
  regime: "hard",
  key_rate_pct: "14",
  cpi_pct: "6.33",
  updated_utc: "2026-10-07T16:27:00Z",
};

const HARD_LEV = {
  ...HARD_FEED,
  bot_id: "mayak_imoex_mom10_lev15",
  account_id: "mayak_imoex_mom10_lev15",
  canonical_id: "MAYAK_imoex_mom10_lev15",
};

const PROTECT = {
  bot_id: "mayak_imoex_mom10",
  account_id: "mayak_imoex_mom10",
  currency: "RUB",
  seed: "300000",
  equity: "299800",
  cash: "299800",
  as_of: "2026-10-06",
  positions: [],
  stocks: "0",
  gross: "0",
  borrowing: false,
  regime: "protect",
  updated_utc: "2026-10-07T16:27:00Z",
};

const ATTACK = {
  bot_id: "mayak_imoex_mom10",
  account_id: "mayak_imoex_mom10",
  currency: "RUB",
  seed: "300000",
  equity: "312000",
  cash: "12000",
  as_of: "2026-10-06",
  positions: [
    { symbol: "SBER", side: "long", qty: "10" },
    { symbol: "GAZP", side: "long", qty: "25" },
  ],
  stocks: "300000",
  gross: "0.96",
  borrowing: false,
  regime: "attack",
  updated_utc: "2026-10-07T16:27:00Z",
};

const ATTACK_LEV = {
  bot_id: "mayak_imoex_mom10_lev2",
  account_id: "mayak_imoex_mom10_lev2",
  currency: "USD",
  seed: "300000",
  equity: "305000",
  cash: "-150000",
  as_of: "2026-10-06",
  positions: [{ symbol: "SBER", side: "long", qty: "40" }],
  stocks: "455000",
  gross: "1.5",
  borrowing: true,
  regime: "attack",
  updated_utc: "2026-10-07T16:27:00Z",
};

test("fixture without Mayak objects: four shells show нет данных, no invented equity or start capital", () => {
  const merged = mergePortalAccounts(FEED_WITHOUT_MAYAK.accounts);
  const rows = merged.filter((a) => MAYAK_BOT_IDS.includes(a.bot_id));
  assert.equal(rows.length, 4);
  for (const row of rows) {
    assert.equal(row.no_data, true);
    assert.equal(hasAccountData(row), false);
    assert.equal(row.equity, undefined);
    assert.equal(row.seed, undefined);
    assert.deepEqual(resolveEquityPoints(row, { series: {} }), []);
  }
});

test("hard fixture: canon banner from feed rates, empty book is LQDT, not an error", () => {
  const merged = mergePortalAccounts([...FEED_WITHOUT_MAYAK.accounts, HARD_FEED]);
  const row = merged.find((a) => a.bot_id === "mayak_imoex_lowvol10");
  assert.equal(hasAccountData(row), true);
  assert.equal(Number(row.seed), 300000);
  assert.equal(lastEquityValue(row), 300114.198705748);
  assert.deepEqual(row.positions, []);
  assert.equal(
    regimeLine(row),
    "Режим жёсткий: ключевая 14%, инфляция 6,33% — все деньги в LQDT, акции не покупаем. Это работа канона, не сбой",
  );
  assert.equal(hardCanonLine({ regime: "hard" }), REGIME_COPY_HARD_WITHOUT_RATES());
  assert.equal(emptyPositionsHint(row), "в деньгах (LQDT)");
  assert.doesNotMatch(emptyPositionsHint(row), /нет позиций|ошибк/i);
  const kinds = mayakDetailLines(row).map((l) => l.kind);
  assert.ok(kinds.includes("regime"));
  assert.ok(kinds.includes("exit"));
  assert.equal(mayakDetailLines(row).find((l) => l.kind === "exit").text, HARD_EXIT_LINE);
  assert.ok(!kinds.includes("stocks"));
  assert.ok(!kinds.includes("gross"));
  const start = mayakFromStartLine(row);
  assert.match(start, /\+114,20\s*₽ \(\+0,04%\) от старта/);
  assert.doesNotMatch(start, /\./);
  assert.doesNotMatch(start, /сделк/i);
  const asOf = cardUpdatedLine(row, new Date("2026-10-07T16:50:00Z"));
  assert.match(asOf, /данные на конец торгового дня 2026-10-06/);
  assert.doesNotMatch(asOf, /устарело/);
  assert.doesNotMatch(asOf, /сессия /);
  const series = buildSeries(resolveEquityPoints(row, null), 300000, "money");
  assert.ok(series.length >= 2);
});

function REGIME_COPY_HARD_WITHOUT_RATES() {
  return "Режим жёсткий: все деньги в LQDT, акции не покупаем. Это работа канона, не сбой";
}

test("hard without rate fields: same banner, no invented percents", () => {
  const row = { ...HARD_FEED };
  delete row.key_rate_pct;
  delete row.cpi_pct;
  assert.equal(regimeLine(row), REGIME_COPY_HARD_WITHOUT_RATES());
  assert.doesNotMatch(regimeLine(row), /14|6,33/);
});

test("leveraged hard: плечо не задействовано when borrowing is false and gross is 0", () => {
  assert.equal(unusedLeverageLine(HARD_LEV), "плечо не задействовано");
  assert.equal(leverageBadge(HARD_LEV), "плечо 1,5");
  assert.equal(isBorrowingLoan(HARD_LEV), false);
  assert.ok(mayakDetailLines(HARD_LEV).some((l) => l.text === "плечо не задействовано"));
  assert.equal(unusedLeverageLine(HARD_FEED), "");
});

test("protect fixture: LQDT cash book, no error highlight", () => {
  assert.equal(regimeLine(PROTECT), "Защита: индекс Мосбиржи ниже EMA100, всё в LQDT");
  assert.equal(emptyPositionsHint(PROTECT), "в деньгах (LQDT)");
  assert.equal(unusedLeverageLine(PROTECT), "");
  const kinds = mayakDetailLines(PROTECT).map((l) => l.kind);
  assert.ok(!kinds.includes("stocks"));
  assert.ok(!kinds.includes("exit"));
});

test("attack fixture: show positions, stocks and gross percent", () => {
  assert.equal(regimeLine(ATTACK), "Атака: корзина до 10 акций");
  assert.equal(emptyPositionsHint(ATTACK), "Открытых позиций сейчас нет.");
  assert.match(stocksLine(ATTACK), /акции 300\s?000 ₽/);
  assert.equal(grossLine(ATTACK), "доля акций 96%");
  const kinds = mayakDetailLines(ATTACK).map((l) => l.kind);
  assert.ok(kinds.includes("stocks"));
  assert.ok(kinds.includes("gross"));
  assert.equal(ATTACK.positions.length, 2);
});

test("leveraged attack: negative cash is нейтральный заём, not unused leverage", () => {
  const merged = mergePortalAccounts([...FEED_WITHOUT_MAYAK.accounts, ATTACK_LEV]);
  const row = merged.find((a) => a.bot_id === "mayak_imoex_mom10_lev2");
  assert.equal(canonicalCurrency(row), "RUB");
  assert.equal(isBorrowingLoan(row), true);
  assert.match(cashOrLoanLine(row), /заём/);
  assert.doesNotMatch(cashOrLoanLine(row), /кэш/);
  assert.equal(grossLine(row), "доля акций 150%");
  assert.equal(unusedLeverageLine(row), "");
  assert.equal(regimeLine(row), "Атака: корзина до 10 акций");
  assert.equal(row.positions[0].qty, "40");
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
  assert.equal(unusedLeverageLine(early), "");
  assert.equal(isBorrowingLoan(early), false);
  assert.equal(mayakFromStartLine(early), "+0,00 ₽ (+0,00%) от старта");
});

test("numbers from the feed are parsed from strings", () => {
  assert.equal(parseFeedNumber("14"), 14);
  assert.equal(parseFeedNumber("6.33"), 6.33);
  assert.equal(formatRateRu("6.33"), "6,33");
  assert.equal(formatRuFixed(114.198705748, 2), "114,20");
  assert.equal(formatRuFixed(0.038066235, 2), "0,04");
});

test("as_of is stale only after 5 calendar days; Mayak uses торговый день wording", () => {
  const now = new Date("2026-10-07T16:50:00Z");
  assert.equal(isAsOfStale("2026-10-06", now), false);
  assert.equal(isAsOfStale("2026-10-03", now), false);
  assert.equal(isAsOfStale("2026-10-02", now), true);
  assert.equal(calendarDaysSinceAsOf("2026-10-02", now), 5);
  const fresh = cardUpdatedLine(
    { bot_id: "mayak_imoex_mom10", account_id: "mayak_imoex_mom10", as_of: "2026-10-06" },
    now,
  );
  assert.match(fresh, /данные на конец торгового дня 2026-10-06/);
  assert.doesNotMatch(fresh, /устарело/);
  const stale = cardUpdatedLine(
    { bot_id: "mayak_imoex_mom10", account_id: "mayak_imoex_mom10", as_of: "2026-10-02" },
    now,
  );
  assert.match(stale, /устарело/);
});

test("other cards keep сессия wording and do not get Mayak-only fields", () => {
  const cycle = {
    bot_id: "cycle_6040_paper",
    account_id: "cycle_6040_paper",
    as_of: "2026-10-06",
    updated_utc: "2026-10-07T00:00:00Z",
  };
  assert.match(formatUpdatedLine(cycle), /сессия 2026-10-06/);
  assert.equal(cardUpdatedLine(cycle), formatUpdatedLine(cycle));
  assert.equal(regimeLine(cycle), "");
  assert.equal(mayakFromStartLine(cycle), "");
  assert.equal(unusedLeverageLine(cycle), "");
  assert.deepEqual(mayakDetailLines(cycle), []);
  assert.equal(emptyPositionsHint(cycle), "Открытых позиций сейчас нет.");
});

test("four Mayak cards stay separate: titles, subtitles, blurbs, badges, RUB only", () => {
  const merged = mergePortalAccounts(FEED_WITHOUT_MAYAK.accounts);
  const rows = MAYAK_ACCOUNTS.map((spec) => merged.find((a) => a.bot_id === spec.bot_id));
  assert.equal(cardTitle(rows[0]), "Маяк Low Vol");
  assert.equal(cardTitle(rows[2]), "Маяк Momentum ×1,5");
  assert.equal(chipLabel("mayak_imoex_lowvol10"), "Маяк Low Vol");
  assert.equal(cardSubtitle(rows[0]), "РФ, акции MOEX и LQDT, без плеча. На биржу ордера не идут.");
  assert.equal(cardBlurb(rows[0]), "10 самых спокойных бумаг, до 10% на бумагу.");
  assert.equal(leverageBadge(rows[2]), "плечо 1,5");
  assert.equal(leverageBadge(rows[3]), "плечо 2");
  for (const row of rows) {
    assert.equal(canonicalCurrency(row), "RUB");
    assert.equal(accountIdBadge(row), row.account_id);
    assert.equal(underTitleLabel(row), null);
    assert.doesNotMatch(cardTitle(row), /Цикл 60\/40|seed/i);
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
  const fromHistory = resolveEquityPoints({ ...account, equity: "" }, history);
  assert.equal(fromHistory.length, 2);
  assert.equal(fromHistory[1].equity, 91000);
});
