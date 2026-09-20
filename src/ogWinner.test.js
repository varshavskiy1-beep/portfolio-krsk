import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pickOgWinner,
  resolveSeed,
  scoreAccount,
  formatSignedMoney,
  formatPct,
  ogCacheBust,
  ogDescription,
} from "./ogWinner.js";

function acc(partial) {
  return { bot_id: "bot", account_id: "acc", currency: "USDT", ...partial };
}

test("seed falls back to series seed then first history equity", () => {
  assert.equal(resolveSeed({ seed: "10000" }, { seed: 1, points: [{ equity: 2 }] }), 10000);
  assert.equal(resolveSeed({}, { seed: 777, points: [{ equity: 2 }] }), 777);
  assert.equal(resolveSeed({ seed: null }, { seed: null, points: [{ equity: 15000 }] }), 15000);
  assert.equal(resolveSeed({}, { points: [{ equity: null }, { equity: 42 }] }), 42);
  assert.equal(resolveSeed({}, { points: [] }), null);
});

test("skips accounts without numeric equity or positive seed", () => {
  assert.equal(scoreAccount(acc({ equity: null, seed: 100 }), { points: [] }), null);
  assert.equal(scoreAccount(acc({ equity: 100, seed: 0 }), { points: [] }), null);
  assert.equal(scoreAccount(acc({ equity: 100, seed: -1 }), { points: [] }), null);
});

test("picks max pnl in own units without FX conversion", () => {
  const latest = {
    accounts: [
      acc({ bot_id: "rub_big", account_id: "rub_big", currency: "RUB", equity: 1510000, seed: 1500000 }),
      acc({ bot_id: "usdt_lead", account_id: "usdt_lead", currency: "USDT", equity: 14515, seed: 10000 }),
      acc({ bot_id: "usdt_small", account_id: "usdt_small", currency: "USDT", equity: 10508, seed: 10000 }),
    ],
  };
  const winner = pickOgWinner(latest, { series: {} });
  assert.equal(winner.key, "rub_big::rub_big");
  assert.equal(winner.pnl, 10000);
  assert.equal(winner.currency, "RUB");
});

test("current-style data: v6b1 beats grail and zero RUB", () => {
  const latest = {
    accounts: [
      acc({ bot_id: "v6b1", account_id: "v6b1", currency: "USDT", equity: 14515.61, seed: 10000 }),
      acc({ bot_id: "grail_b20_3x", account_id: "grail_b20_3x", currency: "USDT", equity: 10508.47, seed: 10000 }),
      acc({ bot_id: "forts_adr_static", account_id: "forts_adr_static", currency: "RUB", equity: 1500000, seed: 1500000 }),
      acc({
        bot_id: "who_pays",
        account_id: "paper_crypto_spot",
        currency: "USDT",
        equity: 15027.05,
        seed: null,
      }),
    ],
  };
  const history = {
    series: {
      "who_pays::paper_crypto_spot": { seed: null, points: [{ equity: 15000 }, { equity: 15027.05 }] },
    },
  };
  const winner = pickOgWinner(latest, history);
  assert.equal(winner.key, "v6b1::v6b1");
  assert.ok(winner.pnl > 4500);
  assert.equal(winner.currency, "USDT");
});

test("who_pays without seed uses first history point", () => {
  const latest = {
    accounts: [acc({ bot_id: "who_pays", account_id: "paper_us_eq", currency: "USD", equity: 25000, seed: null })],
  };
  const history = {
    series: {
      "who_pays::paper_us_eq": { seed: null, points: [{ t: "a", equity: 25000 }, { t: "b", equity: 25000 }] },
    },
  };
  const winner = pickOgWinner(latest, history);
  assert.equal(winner.seed, 25000);
  assert.equal(winner.pnl, 0);
});

test("same-currency pnl tie uses higher percent", () => {
  const latest = {
    accounts: [
      acc({ bot_id: "a", account_id: "a", currency: "USDT", equity: 11000, seed: 10000 }),
      acc({ bot_id: "b", account_id: "b", currency: "USDT", equity: 2100, seed: 1100 }),
    ],
  };
  const winner = pickOgWinner(latest, { series: {} });
  assert.equal(winner.key, "b::b");
  assert.equal(winner.pnl, 1000);
});

test("formats money and description with regular spaces and ASCII digits", () => {
  assert.equal(formatSignedMoney(4515.61, "USDT"), "+4 516");
  assert.equal(formatPct(0.451561), "+45,16");
  const desc = ogDescription({
    account: { bot_id: "v6b1", account_id: "v6b1" },
    pnl: 4515.61,
    pct: 0.451561,
    currency: "USDT",
    key: "v6b1::v6b1",
  });
  assert.equal(
    desc,
    "v6b1: +4 516 USDT (+45,16%) с запуска. Бумажный кабинет, валюты не складываются.",
  );
  assert.equal(/[\u00a0\u202f\u2007\u2009]/.test(desc), false);
});

test("og cache-bust is YYYYMMDDHHMM UTC without colons", () => {
  assert.equal(ogCacheBust("2026-09-20T08:45:43Z"), "202609200845");
  assert.match(ogCacheBust("not-a-date"), /^\d{12}$/);
});
