/**
 * Retired who_pays::paper_us_eq (KILL S5×US_EQ 2026-11-20):
 * stale feed must not show the card or keep the history series.
 * Other who_pays sleeves stay visible.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dropHiddenFeedRows,
  isDroppedEquitySeries,
  sanitizeCabinetSnapshot,
} from "./historyMerge.js";
import { pickOgWinner } from "./ogWinner.js";
import { getPassport, passportUiStrings } from "./strategyPassport.js";
import {
  HIDDEN_PORTAL_IDS,
  WHO_PAYS_BOT_ID,
  WHO_PAYS_US_EQ_ACCOUNT_ID,
  WHO_PAYS_US_EQ_SERIES_KEY,
  isHiddenPortalAccount,
  isHiddenPortalId,
  mergePortalAccounts,
} from "./strategyMeta.js";

const US = WHO_PAYS_US_EQ_SERIES_KEY;
const RU = "who_pays::paper_ru_eq";

function staleLatest() {
  return {
    generated_at: "2026-11-20T12:00:00Z",
    accounts: [
      {
        bot_id: WHO_PAYS_BOT_ID,
        account_id: WHO_PAYS_US_EQ_ACCOUNT_ID,
        currency: "USD",
        equity: "24197.63",
        seed: "25000",
      },
      {
        bot_id: WHO_PAYS_BOT_ID,
        account_id: "paper_ru_eq",
        currency: "RUB",
        equity: "1798465.51",
        seed: "2000000",
      },
    ],
    manifest: [{ bot_id: WHO_PAYS_BOT_ID, logic: "who_pays" }],
  };
}

function staleHistory() {
  return {
    schema: "equity_history.v1",
    updated_at: "2026-11-20T12:00:00Z",
    series: {
      [US]: {
        bot_id: WHO_PAYS_BOT_ID,
        account_id: WHO_PAYS_US_EQ_ACCOUNT_ID,
        currency: "USD",
        seed: 25000,
        points: [
          { t: "2026-09-19T00:00:00Z", equity: 25000 },
          { t: "2026-11-20T09:27:29Z", equity: 24197.63 },
        ],
      },
      [RU]: {
        bot_id: WHO_PAYS_BOT_ID,
        account_id: "paper_ru_eq",
        currency: "RUB",
        seed: 2000000,
        points: [
          { t: "2026-09-19T00:00:00Z", equity: 2000000 },
          { t: "2026-11-20T09:27:29Z", equity: 1798465.51 },
        ],
      },
    },
  };
}

test("exclusion list names retired paper_us_eq account id only", () => {
  assert.equal(HIDDEN_PORTAL_IDS.has(WHO_PAYS_US_EQ_ACCOUNT_ID), true);
  assert.equal(isHiddenPortalId(WHO_PAYS_US_EQ_ACCOUNT_ID), true);
  assert.equal(isHiddenPortalId(WHO_PAYS_BOT_ID), false);
  assert.equal(
    isHiddenPortalAccount({
      bot_id: WHO_PAYS_BOT_ID,
      account_id: WHO_PAYS_US_EQ_ACCOUNT_ID,
    }),
    true,
  );
  assert.equal(
    isHiddenPortalAccount({ bot_id: WHO_PAYS_BOT_ID, account_id: "paper_ru_eq" }),
    false,
  );
  assert.equal(
    isDroppedEquitySeries(US, staleHistory().series[US]),
    true,
  );
  assert.equal(isDroppedEquitySeries(RU, staleHistory().series[RU]), false);
});

test("stale feed: paper_us_eq dropped; paper_ru_eq stays; OG skips US sleeve", () => {
  const latest = staleLatest();
  const hist = staleHistory();
  sanitizeCabinetSnapshot(latest, hist);
  dropHiddenFeedRows(latest);

  const cards = mergePortalAccounts(latest.accounts);
  assert.equal(
    cards.some((a) => a.account_id === WHO_PAYS_US_EQ_ACCOUNT_ID),
    false,
  );
  assert.equal(
    cards.some((a) => a.account_id === "paper_ru_eq"),
    true,
  );
  assert.equal(hist.series[US], undefined);
  assert.ok(hist.series[RU]);

  const winner = pickOgWinner(cards, hist);
  if (winner?.account) {
    assert.notEqual(winner.account.account_id, WHO_PAYS_US_EQ_ACCOUNT_ID);
  }
});

test("authored who_pays passport: four wallets, no active five-account or US_EQ glossary", () => {
  const who = getPassport(WHO_PAYS_BOT_ID);
  assert.equal(who.accounts.length, 4);
  assert.equal(
    who.accounts.some((a) => a.accountId === WHO_PAYS_US_EQ_ACCOUNT_ID),
    false,
  );
  assert.deepEqual(
    who.accounts.map((a) => a.accountId),
    ["paper_ru_eq", "paper_forts", "paper_crypto_spot", "paper_crypto_perp"],
  );

  const text = passportUiStrings(WHO_PAYS_BOT_ID).join("\n");
  assert.doesNotMatch(text, /Пять счетов/);
  assert.doesNotMatch(text, /пяти счетов/);
  assert.doesNotMatch(text, /US_EQ\s*→\s*USD/);
  assert.doesNotMatch(text, /USD \/ RUB \/ USDT/);
  assert.match(text, /Четыре счёта, валюты не суммируются/);
  assert.match(text, /RUB \/ USDT — по площадке счёта/);
  assert.match(text, /KILL S5×US_EQ/);
});
