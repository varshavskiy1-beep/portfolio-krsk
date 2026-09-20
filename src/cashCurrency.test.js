import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalCurrency, applyCanonicalCurrencies } from "./cashCurrency.js";

test("venue wins over bot_id and feed", () => {
  assert.equal(
    canonicalCurrency({ bot_id: "who_pays", account_id: "paper_us_eq", venue: "US_EQ", currency: "RUB" }),
    "USD",
  );
  assert.equal(
    canonicalCurrency({
      bot_id: "who_pays",
      account_id: "paper_crypto_spot",
      venue: "CRYPTO_SPOT",
      currency: "USD",
    }),
    "USDT",
  );
  assert.equal(
    canonicalCurrency({ bot_id: "who_pays", account_id: "paper_ru_eq", venue: "RU_EQ", currency: "USD" }),
    "RUB",
  );
  assert.equal(
    canonicalCurrency({ bot_id: "who_pays", account_id: "paper_forts", venue: "FORTS", currency: "USD" }),
    "RUB",
  );
});

test("bot_id maps crypto and FORTS when venue is missing", () => {
  assert.equal(canonicalCurrency({ bot_id: "v6b1", account_id: "v6b1", currency: "USD" }), "USDT");
  assert.equal(canonicalCurrency({ bot_id: "grail_b20_3x", account_id: "grail_b20_3x", currency: "USD" }), "USDT");
  assert.equal(canonicalCurrency({ bot_id: "pump_radar", account_id: "pump_radar", currency: "USD" }), "USDT");
  assert.equal(
    canonicalCurrency({ bot_id: "forts_adr_adaptive", account_id: "forts_adr_adaptive", currency: "USD" }),
    "RUB",
  );
  assert.equal(
    canonicalCurrency({ bot_id: "forts_adr_static", account_id: "forts_adr_static", currency: "USDT" }),
    "RUB",
  );
});

test("unknown bot keeps feed currency", () => {
  assert.equal(canonicalCurrency({ bot_id: "new_bot", account_id: "x", currency: "EUR" }), "EUR");
});

test("applyCanonicalCurrencies rewrites accounts in place", () => {
  const latest = {
    accounts: [
      { bot_id: "v6b1", account_id: "v6b1", currency: "USD" },
      { bot_id: "who_pays", account_id: "paper_us_eq", venue: "US_EQ", currency: "USD" },
    ],
  };
  applyCanonicalCurrencies(latest);
  assert.equal(latest.accounts[0].currency, "USDT");
  assert.equal(latest.accounts[1].currency, "USD");
});
