import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CYCLE_6040_ACCOUNT_ID,
  CYCLE_6040_BOT_ID,
  CYCLE_6040_TITLE,
  RF_CONSERVATIVE_ACCOUNT_ID,
  RF_CONSERVATIVE_BOT_ID,
  RF_CONSERVATIVE_TITLE,
  RF_BONDS_RATE_CYCLE_ACCOUNT_ID,
  RF_BONDS_RATE_CYCLE_BOT_ID,
  RF_BONDS_RATE_CYCLE_TITLE,
  DESYATKA_EARN_ACCOUNT_ID,
  DESYATKA_EARN_BOT_ID,
  DESYATKA_EARN_TITLE,
  OAC_PAPER_ACCOUNT_ID,
  OAC_PAPER_BOT_ID,
  ROBOT2_ACCOUNT_ID,
  ROBOT2_BOT_ID,
  YOUNG_BOUNCE_ACCOUNT_ID,
  YOUNG_BOUNCE_BOT_ID,
  accountIdBadge,
  accountSubtitle,
  cardSubtitle,
  cardTitle,
  chipLabel,
  displayTitle,
  formatUpdatedLine,
  hasAccountData,
  hasBoxxCash,
  isCycle6040,
  isDesyatkaEarn,
  isRfBondsRateCycle,
  isRfConservative,
  isHiddenPortalAccount,
  isHiddenPortalId,
  isOacPaper,
  mergePortalAccounts,
  portalExcluded,
  showsBrakeBadge,
  showsDefenceBadge,
  showsFreeCash,
  showsPaperBadge,
  underTitleLabel,
} from "./strategyMeta.js";

test("portalExcluded drops outdated live OKX mark for robot 2", () => {
  const excluded = [
    { id: "three_robots_finam_live", reason: "live Finam" },
    { id: ROBOT2_BOT_ID, reason: "live OKX" },
    { id: "three_robots_okx_spcx_btc_4h", reason: "live OKX" },
    { id: DESYATKA_EARN_BOT_ID, reason: "live cluster" },
    { id: CYCLE_6040_BOT_ID, reason: "live cluster" },
    { id: RF_CONSERVATIVE_BOT_ID, reason: "live cluster" },
    { id: RF_BONDS_RATE_CYCLE_BOT_ID, reason: "live cluster" },
    { id: "mayak_imoex_lowvol10", reason: "live cluster" },
    { id: "mayak_imoex_mom10", reason: "live cluster" },
    { id: "mayak_imoex_mom10_lev15", reason: "live cluster" },
    { id: "mayak_imoex_mom10_lev2", reason: "live cluster" },
  ];
  const visible = portalExcluded(excluded);
  assert.deepEqual(
    visible.map((e) => e.id),
    ["three_robots_finam_live", "three_robots_okx_spcx_btc_4h"],
  );
});

test("mergePortalAccounts adds robot 2 shell when absent", () => {
  const merged = mergePortalAccounts([
    { bot_id: "v6b1", account_id: "v6b1", currency: "USDT", equity: "10000" },
  ]);
  const robot2 = merged.find((a) => a.bot_id === ROBOT2_BOT_ID);
  assert.ok(robot2);
  assert.equal(robot2.account_id, ROBOT2_ACCOUNT_ID);
  assert.equal(robot2.no_data, true);
  assert.equal(robot2.currency, "USDT");
});

test("mergePortalAccounts keeps published paper account", () => {
  const published = {
    bot_id: ROBOT2_BOT_ID,
    account_id: ROBOT2_ACCOUNT_ID,
    currency: "USD",
    equity: "10000",
    seed: "10000",
    positions: [],
  };
  const merged = mergePortalAccounts([published]);
  assert.equal(merged.filter((a) => a.bot_id === ROBOT2_BOT_ID).length, 1);
  assert.equal(merged[0].no_data, undefined);
  assert.equal(merged[0].equity, "10000");
});

test("displayTitle maps robot 2 ids to human title", () => {
  assert.equal(displayTitle({ bot_id: ROBOT2_BOT_ID, account_id: ROBOT2_ACCOUNT_ID }), "Робот 2 · MSTR/TSLA/SPCX");
});

test("paper badge is on every account card, not only robot 2", () => {
  assert.equal(showsPaperBadge({ bot_id: "forts_adr_adaptive", account_id: "forts_adr_adaptive" }), true);
  assert.equal(showsPaperBadge({ bot_id: "forts_adr_static", account_id: "forts_adr_static" }), true);
  assert.equal(showsPaperBadge({ bot_id: ROBOT2_BOT_ID, account_id: ROBOT2_ACCOUNT_ID }), true);
  assert.equal(showsPaperBadge({ bot_id: YOUNG_BOUNCE_BOT_ID, account_id: YOUNG_BOUNCE_ACCOUNT_ID }), true);
  assert.equal(showsPaperBadge(null), false);
});

test("displayTitle maps young bounce ids to human title", () => {
  assert.equal(
    displayTitle({ bot_id: YOUNG_BOUNCE_BOT_ID, account_id: YOUNG_BOUNCE_ACCOUNT_ID }),
    "Young Bounce Combo",
  );
});

test("mergePortalAccounts adds young bounce shell when absent", () => {
  const merged = mergePortalAccounts([
    { bot_id: "v6b1", account_id: "v6b1", currency: "USDT", equity: "10000" },
  ]);
  const yb = merged.find((a) => a.bot_id === YOUNG_BOUNCE_BOT_ID);
  assert.ok(yb);
  assert.equal(yb.account_id, YOUNG_BOUNCE_ACCOUNT_ID);
  assert.equal(yb.no_data, true);
  assert.equal(yb.currency, "USDT");
  assert.equal(yb.seed, "10000");
  assert.equal(hasAccountData(yb), false);
});

test("mergePortalAccounts keeps published young bounce account", () => {
  const published = {
    bot_id: YOUNG_BOUNCE_BOT_ID,
    account_id: YOUNG_BOUNCE_ACCOUNT_ID,
    currency: "USD",
    equity: "10000",
    seed: "10000",
    positions: [],
  };
  const merged = mergePortalAccounts([published]);
  const rows = merged.filter((a) => a.bot_id === YOUNG_BOUNCE_BOT_ID);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].no_data, undefined);
  assert.equal(rows[0].equity, "10000");
  assert.equal(hasAccountData(rows[0]), true);
});

test("error + empty equity is no data, never treated as zero", () => {
  const emptySeries = {
    bot_id: YOUNG_BOUNCE_BOT_ID,
    account_id: YOUNG_BOUNCE_ACCOUNT_ID,
    currency: "USD",
    seed: "10000",
    error: "mark missing",
    equity: [],
    positions: [],
  };
  assert.equal(hasAccountData(emptySeries), false);
  assert.equal(hasAccountData({ ...emptySeries, equity: null, equity_curve: [] }), false);
  assert.equal(hasAccountData({ ...emptySeries, equity: undefined }), false);
  assert.equal(hasAccountData({ bot_id: YOUNG_BOUNCE_BOT_ID, error: "timeout" }), false);
});

test("error with equity series still has data", () => {
  assert.equal(
    hasAccountData({
      bot_id: YOUNG_BOUNCE_BOT_ID,
      account_id: YOUNG_BOUNCE_ACCOUNT_ID,
      error: "stale mark",
      equity: [{ t: "2026-09-22T00:00:00Z", equity: 10000 }],
    }),
    true,
  );
  assert.equal(
    hasAccountData({
      bot_id: YOUNG_BOUNCE_BOT_ID,
      account_id: YOUNG_BOUNCE_ACCOUNT_ID,
      error: "stale mark",
      equity: "10000",
    }),
    true,
  );
});

test("displayTitle maps oac paper ids to human title", () => {
  assert.equal(
    displayTitle({ bot_id: OAC_PAPER_BOT_ID, account_id: OAC_PAPER_ACCOUNT_ID }),
    "Ядро внимания",
  );
});

test("mergePortalAccounts adds oac paper shell when absent", () => {
  const merged = mergePortalAccounts([
    { bot_id: "v6b1", account_id: "v6b1", currency: "USDT", equity: "10000" },
  ]);
  const oac = merged.find((a) => a.bot_id === OAC_PAPER_BOT_ID);
  assert.ok(oac);
  assert.equal(oac.account_id, OAC_PAPER_ACCOUNT_ID);
  assert.equal(oac.no_data, true);
  assert.equal(oac.currency, "USD");
  assert.equal(oac.seed, "10000");
  assert.equal(hasAccountData(oac), false);
});

test("mergePortalAccounts keeps published oac paper account", () => {
  const published = {
    bot_id: OAC_PAPER_BOT_ID,
    account_id: OAC_PAPER_ACCOUNT_ID,
    currency: "USD",
    equity: "10000.0",
    seed: "10000",
    cash: "10000.0",
    boxx_usd: "0.0",
    positions: [],
    defence: true,
    as_of: "2026-09-24",
  };
  const merged = mergePortalAccounts([published]);
  const rows = merged.filter((a) => a.bot_id === OAC_PAPER_BOT_ID);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].no_data, undefined);
  assert.equal(rows[0].equity, "10000.0");
  assert.equal(hasAccountData(rows[0]), true);
});

test("oac paper error + empty equity is no data", () => {
  assert.equal(
    hasAccountData({
      bot_id: OAC_PAPER_BOT_ID,
      account_id: OAC_PAPER_ACCOUNT_ID,
      error: "ledger_missing",
      equity: [],
      seed: "10000",
    }),
    false,
  );
  assert.equal(
    hasAccountData({
      bot_id: OAC_PAPER_BOT_ID,
      account_id: OAC_PAPER_ACCOUNT_ID,
      error: "no_equity_yet",
      equity: null,
      seed: "10000",
    }),
    false,
  );
});

test("oac paper helpers: subtitle, defence, updated line, boxx", () => {
  const account = {
    bot_id: OAC_PAPER_BOT_ID,
    account_id: OAC_PAPER_ACCOUNT_ID,
    as_of: "2026-09-24",
    updated_utc: "2026-09-25T14:34:39Z",
    defence: true,
    boxx_usd: "125.5",
  };
  assert.match(accountSubtitle(account), /акции США/);
  assert.match(cardSubtitle(account), /акции США/);
  assert.equal(showsDefenceBadge(account), true);
  assert.equal(showsDefenceBadge({ defence: false }), false);
  assert.match(formatUpdatedLine(account), /сессия 2026-09-24/);
  assert.match(formatUpdatedLine(account), /обновлено 2026-09-25T14:34:39Z/);
  assert.equal(hasBoxxCash(account), true);
  assert.equal(isOacPaper(account), true);
});

test("cardTitle never shows raw oac_paper or young_bounce ids", () => {
  assert.equal(cardTitle({ bot_id: OAC_PAPER_BOT_ID, account_id: OAC_PAPER_ACCOUNT_ID }), "Ядро внимания");
  assert.equal(
    cardTitle({ bot_id: YOUNG_BOUNCE_BOT_ID, account_id: YOUNG_BOUNCE_ACCOUNT_ID }),
    "Young Bounce Combo",
  );
  assert.equal(displayTitle({ bot_id: OAC_PAPER_BOT_ID, account_id: OAC_PAPER_ACCOUNT_ID }), "Ядро внимания");
  assert.equal(chipLabel(OAC_PAPER_BOT_ID), "Ядро внимания");
  assert.equal(chipLabel(YOUNG_BOUNCE_BOT_ID), "Young Bounce Combo");
  assert.doesNotMatch(chipLabel("grail_b20_3x"), /Grail B20/);
});

test("displayTitle maps desyatka earn ids to Десятка Earn", () => {
  assert.equal(
    displayTitle({ bot_id: DESYATKA_EARN_BOT_ID, account_id: DESYATKA_EARN_ACCOUNT_ID }),
    DESYATKA_EARN_TITLE,
  );
  assert.equal(cardTitle({ bot_id: DESYATKA_EARN_BOT_ID, account_id: DESYATKA_EARN_ACCOUNT_ID }), DESYATKA_EARN_TITLE);
  assert.equal(chipLabel(DESYATKA_EARN_BOT_ID), DESYATKA_EARN_TITLE);
});

test("mergePortalAccounts adds desyatka earn shell when absent", () => {
  const merged = mergePortalAccounts([
    { bot_id: "v6b1", account_id: "v6b1", currency: "USDT", equity: "10000" },
  ]);
  const row = merged.find((a) => a.bot_id === DESYATKA_EARN_BOT_ID);
  assert.ok(row);
  assert.equal(row.account_id, DESYATKA_EARN_ACCOUNT_ID);
  assert.equal(row.no_data, true);
  assert.equal(row.currency, "USD");
  assert.equal(row.seed, "10000");
  assert.equal(hasAccountData(row), false);
  assert.equal(isDesyatkaEarn(row), true);
  assert.equal(cardSubtitle(row), "акции США, старт 10 000 USD. На биржу ордера не идут.");
  assert.doesNotMatch(cardSubtitle(row), /\$100|100 000|100000|\$10 000/);
  assert.equal(accountIdBadge(row), DESYATKA_EARN_ACCOUNT_ID);
  assert.equal(underTitleLabel(row), null);
  assert.equal(showsFreeCash(row), false);
});

test("published desyatka cash book is live, not нет данных", () => {
  const published = {
    bot_id: DESYATKA_EARN_BOT_ID,
    account_id: DESYATKA_EARN_ACCOUNT_ID,
    currency: "USD",
    equity: "10000.0",
    seed: "10000",
    cash: "10000.0",
    positions: [],
    as_of: "2026-09-29",
    next_rebalance: "2026-10-06",
    updated_utc: "2026-09-30T04:00:00Z",
  };
  const merged = mergePortalAccounts([published]);
  const rows = merged.filter((a) => a.bot_id === DESYATKA_EARN_BOT_ID);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].no_data, undefined);
  assert.equal(rows[0].equity, "10000.0");
  assert.equal(hasAccountData(rows[0]), true);
  assert.equal(showsFreeCash(rows[0]), true);
  assert.match(formatUpdatedLine(rows[0]), /сессия 2026-09-29/);
  assert.match(formatUpdatedLine(rows[0]), /обновлено 2026-09-30T04:00:00Z/);
  assert.match(formatUpdatedLine(rows[0]), /ребаланс 2026-10-06/);
});

test("desyatka earn error + empty equity is no data, never zero", () => {
  assert.equal(
    hasAccountData({
      bot_id: DESYATKA_EARN_BOT_ID,
      account_id: DESYATKA_EARN_ACCOUNT_ID,
      error: "ledger_missing",
      equity: [],
      seed: "10000",
    }),
    false,
  );
  assert.equal(
    hasAccountData({
      bot_id: DESYATKA_EARN_BOT_ID,
      account_id: DESYATKA_EARN_ACCOUNT_ID,
      error: "no_equity_yet",
      equity: null,
      seed: "10000",
    }),
    false,
  );
});

test("formatUpdatedLine skips missing next_rebalance", () => {
  assert.equal(formatUpdatedLine({ updated_utc: "2026-09-30T00:00:00Z" }), "обновлено 2026-09-30T00:00:00Z");
  assert.doesNotMatch(formatUpdatedLine({ as_of: "2026-09-29" }), /ребаланс/);
});

test("desyatka helpers: subtitle, cash, badge", () => {
  const account = {
    bot_id: DESYATKA_EARN_BOT_ID,
    account_id: DESYATKA_EARN_ACCOUNT_ID,
    cash: "0",
  };
  assert.match(accountSubtitle(account), /акции США/);
  assert.equal(showsPaperBadge(account), true);
  assert.equal(showsFreeCash(account), true);
  assert.equal(showsFreeCash({ bot_id: OAC_PAPER_BOT_ID, cash: "10" }), false);
  assert.equal(isDesyatkaEarn(account), true);
});

test("portal bots: id in badge, not under title", () => {
  const oac = { bot_id: OAC_PAPER_BOT_ID, account_id: OAC_PAPER_ACCOUNT_ID };
  assert.equal(accountIdBadge(oac), OAC_PAPER_ACCOUNT_ID);
  assert.equal(underTitleLabel(oac), null);
  const yb = { bot_id: YOUNG_BOUNCE_BOT_ID, account_id: YOUNG_BOUNCE_ACCOUNT_ID };
  assert.equal(accountIdBadge(yb), YOUNG_BOUNCE_ACCOUNT_ID);
  assert.equal(underTitleLabel(yb), null);
  const cyc = { bot_id: CYCLE_6040_BOT_ID, account_id: CYCLE_6040_ACCOUNT_ID };
  assert.equal(accountIdBadge(cyc), CYCLE_6040_ACCOUNT_ID);
  assert.equal(underTitleLabel(cyc), null);
  const rfc = { bot_id: RF_CONSERVATIVE_BOT_ID, account_id: RF_CONSERVATIVE_ACCOUNT_ID };
  assert.equal(accountIdBadge(rfc), RF_CONSERVATIVE_ACCOUNT_ID);
  assert.equal(underTitleLabel(rfc), null);
  const mayak = { bot_id: "mayak_imoex_mom10", account_id: "mayak_imoex_mom10" };
  assert.equal(accountIdBadge(mayak), "mayak_imoex_mom10");
  assert.equal(underTitleLabel(mayak), null);
});

test("decommissioned grail_b20_3x is hidden from portal accounts", () => {
  assert.equal(isHiddenPortalId("grail_b20_3x"), true);
  assert.equal(isHiddenPortalId("GRAIL_B20_3X"), true);
  assert.equal(isHiddenPortalAccount({ bot_id: "grail_b20_3x", account_id: "grail_b20_3x" }), true);
  const merged = mergePortalAccounts([
    { bot_id: "v6b1", account_id: "v6b1", currency: "USDT", equity: "10000" },
    { bot_id: "grail_b20_3x", account_id: "grail_b20_3x", currency: "USDT", equity: "24440" },
  ]);
  assert.equal(merged.some((a) => a.bot_id === "grail_b20_3x"), false);
  assert.equal(merged.some((a) => a.account_id === "grail_b20_3x"), false);
  assert.ok(merged.some((a) => a.bot_id === "v6b1"));
  assert.doesNotMatch(cardTitle({ bot_id: "grail_b20_3x", account_id: "grail_b20_3x" }), /Grail B20/);
  assert.equal(cardSubtitle({ bot_id: "grail_b20_3x", account_id: "grail_b20_3x" }), "");
});

test("non-portal bot still shows account id under title when title differs", () => {
  assert.equal(underTitleLabel({ bot_id: "v6b1", account_id: "v6b1" }), null);
  assert.equal(
    underTitleLabel({ bot_id: "x", account_id: ROBOT2_ACCOUNT_ID }),
    ROBOT2_ACCOUNT_ID,
  );
});

test("displayTitle maps cycle 60/40 ids to Цикл 60/40", () => {
  assert.equal(
    displayTitle({ bot_id: CYCLE_6040_BOT_ID, account_id: CYCLE_6040_ACCOUNT_ID }),
    CYCLE_6040_TITLE,
  );
  assert.equal(cardTitle({ bot_id: CYCLE_6040_BOT_ID, account_id: CYCLE_6040_ACCOUNT_ID }), CYCLE_6040_TITLE);
  assert.equal(chipLabel(CYCLE_6040_BOT_ID), CYCLE_6040_TITLE);
  assert.doesNotMatch(cardTitle({ bot_id: CYCLE_6040_BOT_ID, account_id: CYCLE_6040_ACCOUNT_ID }), /cycle_6040/);
});

test("mergePortalAccounts adds cycle 60/40 shell when absent — нет данных, not invented seed", () => {
  const merged = mergePortalAccounts([
    { bot_id: "v6b1", account_id: "v6b1", currency: "USDT", equity: "10000" },
  ]);
  const row = merged.find((a) => a.bot_id === CYCLE_6040_BOT_ID);
  assert.ok(row);
  assert.equal(row.account_id, CYCLE_6040_ACCOUNT_ID);
  assert.equal(row.no_data, true);
  assert.equal(row.currency, "RUB");
  assert.equal(hasAccountData(row), false);
  assert.equal(isCycle6040(row), true);
  assert.equal(cardSubtitle(row), "РФ, DIVD/SBLB/LQDT, старт 1 000 000 ₽. На биржу ордера не идут.");
  assert.equal(accountIdBadge(row), CYCLE_6040_ACCOUNT_ID);
  assert.equal(underTitleLabel(row), null);
  assert.equal(showsBrakeBadge(row), false);
  assert.equal(showsPaperBadge(row), true);
});

test("published cycle 60/40 cash book is live, not нет данных", () => {
  const published = {
    bot_id: CYCLE_6040_BOT_ID,
    account_id: CYCLE_6040_ACCOUNT_ID,
    currency: "RUB",
    equity: "1000000",
    seed: "1000000",
    cash: "1000000",
    positions: [],
    as_of: "2026-10-01",
    planned_fill: "2026-10-02",
    braked: false,
    updated_utc: "2026-10-01T04:00:00Z",
  };
  const merged = mergePortalAccounts([published]);
  const rows = merged.filter((a) => a.bot_id === CYCLE_6040_BOT_ID);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].no_data, undefined);
  assert.equal(rows[0].equity, "1000000");
  assert.equal(hasAccountData(rows[0]), true);
  assert.match(formatUpdatedLine(rows[0]), /сессия 2026-10-01/);
  assert.match(formatUpdatedLine(rows[0]), /обновлено 2026-10-01T04:00:00Z/);
  assert.match(formatUpdatedLine(rows[0]), /план 2026-10-02/);
  assert.equal(showsBrakeBadge(rows[0]), false);
});

test("cycle 60/40 error + empty equity is no data, never zero", () => {
  assert.equal(
    hasAccountData({
      bot_id: CYCLE_6040_BOT_ID,
      account_id: CYCLE_6040_ACCOUNT_ID,
      error: "ledger_missing",
      equity: [],
      seed: "1000000",
    }),
    false,
  );
  assert.equal(
    hasAccountData({
      bot_id: CYCLE_6040_BOT_ID,
      account_id: CYCLE_6040_ACCOUNT_ID,
      error: "no_equity_yet",
      equity: null,
      seed: "1000000",
    }),
    false,
  );
});

test("cycle 60/40 helpers: subtitle, planned_fill, braked badge", () => {
  const account = {
    bot_id: CYCLE_6040_BOT_ID,
    account_id: CYCLE_6040_ACCOUNT_ID,
    as_of: "2026-10-01",
    updated_utc: "2026-10-01T12:00:00Z",
    planned_fill: "2026-10-02",
    braked: true,
  };
  assert.match(accountSubtitle(account), /DIVD\/SBLB\/LQDT/);
  assert.equal(showsPaperBadge(account), true);
  assert.equal(showsBrakeBadge(account), true);
  assert.equal(showsBrakeBadge({ braked: false }), false);
  assert.equal(showsBrakeBadge({}), false);
  assert.equal(isCycle6040(account), true);
  assert.match(formatUpdatedLine(account), /план 2026-10-02/);
  assert.doesNotMatch(formatUpdatedLine({ as_of: "2026-10-01" }), /план/);
});

test("displayTitle maps rf conservative ids to full card title", () => {
  assert.equal(
    displayTitle({ bot_id: RF_CONSERVATIVE_BOT_ID, account_id: RF_CONSERVATIVE_ACCOUNT_ID }),
    RF_CONSERVATIVE_TITLE,
  );
  assert.equal(
    cardTitle({ bot_id: RF_CONSERVATIVE_BOT_ID, account_id: RF_CONSERVATIVE_ACCOUNT_ID }),
    RF_CONSERVATIVE_TITLE,
  );
  assert.equal(chipLabel(RF_CONSERVATIVE_BOT_ID), RF_CONSERVATIVE_TITLE);
  assert.doesNotMatch(
    cardTitle({ bot_id: RF_CONSERVATIVE_BOT_ID, account_id: RF_CONSERVATIVE_ACCOUNT_ID }),
    /rf_conservative/,
  );
  assert.doesNotMatch(RF_CONSERVATIVE_TITLE, /Цикл 60\/40|DIVD|SBLB|1 000 000/);
});

test("mergePortalAccounts adds rf conservative shell when absent — нет данных, not invented seed", () => {
  const merged = mergePortalAccounts([
    { bot_id: "v6b1", account_id: "v6b1", currency: "USDT", equity: "10000" },
  ]);
  const row = merged.find((a) => a.bot_id === RF_CONSERVATIVE_BOT_ID);
  assert.ok(row);
  assert.equal(row.account_id, RF_CONSERVATIVE_ACCOUNT_ID);
  assert.equal(row.no_data, true);
  assert.equal(row.currency, "RUB");
  assert.equal(hasAccountData(row), false);
  assert.equal(isRfConservative(row), true);
  assert.equal(isCycle6040(row), false);
  assert.equal(cardSubtitle(row), "РФ, SBMX/SBRB/LQDT, старт 50 000 ₽. На биржу ордера не идут.");
  assert.doesNotMatch(cardSubtitle(row), /DIVD|SBLB|1 000 000/);
  assert.equal(accountIdBadge(row), RF_CONSERVATIVE_ACCOUNT_ID);
  assert.equal(underTitleLabel(row), null);
  assert.equal(showsPaperBadge(row), true);
  assert.notEqual(row.equity, "50000");
  assert.notEqual(row.equity, 50000);
  assert.notEqual(row.equity, "0");
});

test("published rf conservative cash book is live, not нет данных", () => {
  const published = {
    bot_id: RF_CONSERVATIVE_BOT_ID,
    account_id: RF_CONSERVATIVE_ACCOUNT_ID,
    currency: "RUB",
    equity: "50000",
    seed: "50000",
    cash: "50000",
    positions: [],
    as_of: "2026-10-01",
    updated_utc: "2026-10-01T04:00:00Z",
    note: "Бумага. «РФ Консерватив» Comon, SBMX/SBRB/LQDT, старт 50000 RUB. На биржу ордера не идут.",
  };
  const merged = mergePortalAccounts([published]);
  const rows = merged.filter((a) => a.bot_id === RF_CONSERVATIVE_BOT_ID);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].no_data, undefined);
  assert.equal(rows[0].equity, "50000");
  assert.equal(hasAccountData(rows[0]), true);
  assert.match(formatUpdatedLine(rows[0]), /сессия 2026-10-01/);
  assert.match(formatUpdatedLine(rows[0]), /обновлено 2026-10-01T04:00:00Z/);
});

test("rf conservative error + empty equity is no data, never zero", () => {
  assert.equal(
    hasAccountData({
      bot_id: RF_CONSERVATIVE_BOT_ID,
      account_id: RF_CONSERVATIVE_ACCOUNT_ID,
      error: "ledger_missing",
      equity: [],
      seed: "50000",
    }),
    false,
  );
  assert.equal(
    hasAccountData({
      bot_id: RF_CONSERVATIVE_BOT_ID,
      account_id: RF_CONSERVATIVE_ACCOUNT_ID,
      error: "no_equity_yet",
      equity: null,
      seed: "50000",
    }),
    false,
  );
});

test("rf conservative helpers: subtitle, paper badge, not cycle 60/40", () => {
  const account = {
    bot_id: RF_CONSERVATIVE_BOT_ID,
    account_id: RF_CONSERVATIVE_ACCOUNT_ID,
    as_of: "2026-10-01",
    updated_utc: "2026-10-01T12:00:00Z",
  };
  assert.match(accountSubtitle(account), /SBMX\/SBRB\/LQDT/);
  assert.doesNotMatch(accountSubtitle(account), /DIVD|SBLB/);
  assert.equal(showsPaperBadge(account), true);
  assert.equal(isRfConservative(account), true);
  assert.equal(isCycle6040(account), false);
});

test("mergePortalAccounts adds four separate Mayak shells when absent — нет данных, seed not hardcoded", () => {
  const merged = mergePortalAccounts([
    { bot_id: "v6b1", account_id: "v6b1", currency: "USDT", equity: "10000" },
  ]);
  const ids = [
    "mayak_imoex_lowvol10",
    "mayak_imoex_mom10",
    "mayak_imoex_mom10_lev15",
    "mayak_imoex_mom10_lev2",
  ];
  const rows = ids.map((id) => merged.find((a) => a.bot_id === id));
  assert.equal(rows.filter(Boolean).length, 4);
  for (const row of rows) {
    assert.equal(row.no_data, true);
    assert.equal(row.currency, "RUB");
    assert.equal(hasAccountData(row), false);
    assert.equal(row.seed, undefined);
    assert.equal(row.equity, undefined);
    assert.equal(accountIdBadge(row), row.account_id);
    assert.equal(underTitleLabel(row), null);
  }
  assert.equal(cardTitle(rows[0]), "Маяк Low Vol");
  assert.equal(cardTitle(rows[1]), "Маяк Momentum");
  assert.equal(cardTitle(rows[2]), "Маяк Momentum ×1,5");
  assert.equal(cardTitle(rows[3]), "Маяк Momentum ×2");
});

test("published Mayak object replaces the shell and keeps seed from the feed", () => {
  const published = {
    bot_id: "mayak_imoex_lowvol10",
    account_id: "mayak_imoex_lowvol10",
    currency: "RUB",
    equity: "120000",
    seed: "110000",
    positions: [],
    regime: "hard",
  };
  const merged = mergePortalAccounts([published]);
  const rows = merged.filter((a) => a.bot_id === "mayak_imoex_lowvol10");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].no_data, undefined);
  assert.equal(hasAccountData(rows[0]), true);
  assert.equal(rows[0].seed, "110000");
  assert.equal(rows[0].equity, "120000");
});

test("displayTitle maps rate-cycle ids to full card title", () => {
  assert.equal(
    displayTitle({ bot_id: RF_BONDS_RATE_CYCLE_BOT_ID, account_id: RF_BONDS_RATE_CYCLE_ACCOUNT_ID }),
    RF_BONDS_RATE_CYCLE_TITLE,
  );
  assert.equal(
    cardTitle({ bot_id: RF_BONDS_RATE_CYCLE_BOT_ID, account_id: RF_BONDS_RATE_CYCLE_ACCOUNT_ID }),
    RF_BONDS_RATE_CYCLE_TITLE,
  );
  assert.equal(chipLabel(RF_BONDS_RATE_CYCLE_BOT_ID), RF_BONDS_RATE_CYCLE_TITLE);
  assert.doesNotMatch(RF_BONDS_RATE_CYCLE_TITLE, /РФ Консерватив|Цикл 60\/40|50 000|₽/);
});

test("mergePortalAccounts adds rate-cycle shell when absent — нет данных, seed not hardcoded", () => {
  const merged = mergePortalAccounts([
    { bot_id: "v6b1", account_id: "v6b1", currency: "USDT", equity: "10000" },
  ]);
  const row = merged.find((a) => a.bot_id === RF_BONDS_RATE_CYCLE_BOT_ID);
  assert.ok(row);
  assert.equal(row.account_id, RF_BONDS_RATE_CYCLE_ACCOUNT_ID);
  assert.equal(row.no_data, true);
  assert.equal(row.currency, "RUB");
  assert.equal(row.seed, undefined);
  assert.equal(hasAccountData(row), false);
  assert.equal(isRfBondsRateCycle(row), true);
  assert.equal(isRfConservative(row), false);
  assert.equal(accountIdBadge(row), RF_BONDS_RATE_CYCLE_ACCOUNT_ID);
  assert.equal(underTitleLabel(row), null);
  assert.equal(showsPaperBadge(row), true);
  assert.notEqual(row.equity, "1");
  assert.notEqual(row.equity, 1);
  assert.notEqual(row.equity, "2.4419");
});

test("published rate-cycle book replaces the shell and keeps seed from the feed", () => {
  const published = {
    bot_id: RF_BONDS_RATE_CYCLE_BOT_ID,
    account_id: RF_BONDS_RATE_CYCLE_ACCOUNT_ID,
    currency: "RUB",
    equity: "300000.0",
    seed: "300000",
    positions: [{ symbol: "OBLG", side: "long", qty: "1136", avg_px: "211.1" }],
  };
  const merged = mergePortalAccounts([published]);
  const rows = merged.filter((a) => a.bot_id === RF_BONDS_RATE_CYCLE_BOT_ID);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].no_data, undefined);
  assert.equal(hasAccountData(rows[0]), true);
  assert.equal(rows[0].seed, "300000");
  assert.equal(rows[0].equity, "300000.0");
});
