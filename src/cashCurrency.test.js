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

test("robot 2 paper account maps to USDT", () => {
  assert.equal(
    canonicalCurrency({
      bot_id: "three_robots_okx_nasdaq_1h",
      account_id: "paper_block2",
      currency: "USD",
    }),
    "USDT",
  );
  assert.equal(canonicalCurrency({ bot_id: "three_robots_okx_nasdaq_1h", account_id: "x", currency: "RUB" }), "USDT");
  assert.equal(canonicalCurrency({ bot_id: "other", account_id: "paper_block2", currency: "RUB" }), "USDT");
});

test("currency chips: Robot 2 and Young Bounce under USDT, OAC and Десятка under USD", () => {
  const accounts = [
    { bot_id: "forts_adr_static", account_id: "forts_adr_static", currency: "RUB" },
    { bot_id: "v6b1", account_id: "v6b1", currency: "USDT" },
    { bot_id: "three_robots_okx_nasdaq_1h", account_id: "paper_block2", currency: "USD", equity: "10000" },
    { bot_id: "young_bounce_combo", account_id: "young_bounce_combo", currency: "USD", equity: "10000" },
    { bot_id: "oac_paper", account_id: "oac_paper", currency: "USD", equity: "10000" },
    { bot_id: "desyatka_earn_paper", account_id: "desyatka_earn_paper", currency: "USDT", equity: "10000" },
    { bot_id: "cycle_6040_paper", account_id: "cycle_6040_paper", currency: "USD", equity: "1000000" },
    { bot_id: "rf_conservative_comon", account_id: "rf_conservative_comon", currency: "USD", equity: "50000" },
    { bot_id: "rf_bonds_rate_cycle", account_id: "rf_bonds_rate_cycle", currency: "RUB", equity: "1" },
    { bot_id: "mayak_imoex_lowvol10", account_id: "mayak_imoex_lowvol10", currency: "USD", equity: "1" },
    { bot_id: "mayak_imoex_mom10", account_id: "mayak_imoex_mom10", currency: "USDT", equity: "1" },
    { bot_id: "mayak_imoex_mom10_lev15", account_id: "mayak_imoex_mom10_lev15", currency: "USD", equity: "1" },
    { bot_id: "mayak_imoex_mom10_lev2", account_id: "mayak_imoex_mom10_lev2", currency: "USDT", equity: "1" },
    { bot_id: "who_pays", account_id: "paper_us_eq", venue: "US_EQ", currency: "USD" },
  ];
  const usd = accounts.filter((a) => canonicalCurrency(a) === "USD");
  const usdt = accounts.filter((a) => canonicalCurrency(a) === "USDT");
  const rub = accounts.filter((a) => canonicalCurrency(a) === "RUB");
  assert.deepEqual(
    usd.map((a) => a.account_id),
    ["oac_paper", "desyatka_earn_paper", "paper_us_eq"],
  );
  assert.deepEqual(
    usdt.map((a) => a.account_id),
    ["v6b1", "paper_block2", "young_bounce_combo"],
  );
  assert.deepEqual(
    rub.map((a) => a.account_id),
    [
      "forts_adr_static",
      "cycle_6040_paper",
      "rf_conservative_comon",
      "mayak_imoex_lowvol10",
      "mayak_imoex_mom10",
      "mayak_imoex_mom10_lev15",
      "mayak_imoex_mom10_lev2",
    ],
  );
});

test("young bounce is always USDT and never remapped to USD/RUB", () => {
  assert.equal(
    canonicalCurrency({
      bot_id: "young_bounce_combo",
      account_id: "young_bounce_combo",
      currency: "USD",
    }),
    "USDT",
  );
  assert.equal(
    canonicalCurrency({
      bot_id: "young_bounce_combo",
      account_id: "young_bounce_combo",
      venue: "CRYPTO_SPOT",
      currency: "USD",
    }),
    "USDT",
  );
  assert.equal(
    canonicalCurrency({ bot_id: "young_bounce_combo", account_id: "x", currency: "RUB" }),
    "USDT",
  );
});

test("oac paper is always USD and never remapped to USDT/RUB", () => {
  assert.equal(
    canonicalCurrency({
      bot_id: "oac_paper",
      account_id: "oac_paper",
      currency: "USD",
    }),
    "USD",
  );
  assert.equal(
    canonicalCurrency({
      bot_id: "oac_paper",
      account_id: "oac_paper",
      venue: "US_EQ",
      currency: "RUB",
    }),
    "USD",
  );
  assert.equal(
    canonicalCurrency({ bot_id: "oac_paper", account_id: "x", currency: "USDT" }),
    "USD",
  );
});

test("desyatka earn is always USD and never remapped to USDT/RUB", () => {
  assert.equal(
    canonicalCurrency({
      bot_id: "desyatka_earn_paper",
      account_id: "desyatka_earn_paper",
      currency: "USD",
    }),
    "USD",
  );
  assert.equal(
    canonicalCurrency({
      bot_id: "desyatka_earn_paper",
      account_id: "desyatka_earn_paper",
      venue: "US_EQ",
      currency: "RUB",
    }),
    "USD",
  );
  assert.equal(
    canonicalCurrency({ bot_id: "desyatka_earn_paper", account_id: "x", currency: "USDT" }),
    "USD",
  );
});

test("cycle 60/40 is always RUB and never remapped to USD/USDT", () => {
  assert.equal(
    canonicalCurrency({
      bot_id: "cycle_6040_paper",
      account_id: "cycle_6040_paper",
      currency: "USD",
    }),
    "RUB",
  );
  assert.equal(
    canonicalCurrency({
      bot_id: "cycle_6040_paper",
      account_id: "cycle_6040_paper",
      venue: "US_EQ",
      currency: "USDT",
    }),
    "RUB",
  );
  assert.equal(
    canonicalCurrency({ bot_id: "cycle_6040_paper", account_id: "x", currency: "USDT" }),
    "RUB",
  );
});

test("mayak paper accounts are always RUB and never remapped to USD/USDT", () => {
  for (const id of [
    "mayak_imoex_lowvol10",
    "mayak_imoex_mom10",
    "mayak_imoex_mom10_lev15",
    "mayak_imoex_mom10_lev2",
  ]) {
    assert.equal(canonicalCurrency({ bot_id: id, account_id: id, currency: "USD" }), "RUB");
    assert.equal(
      canonicalCurrency({ bot_id: id, account_id: id, venue: "US_EQ", currency: "USDT" }),
      "RUB",
    );
    assert.equal(canonicalCurrency({ bot_id: id, account_id: "x", currency: "USDT" }), "RUB");
  }
});

test("rate-cycle 80/20 is always индекс and never remapped to RUB/USD/USDT", () => {
  assert.equal(
    canonicalCurrency({
      bot_id: "rf_bonds_rate_cycle",
      account_id: "rf_bonds_rate_cycle",
      currency: "RUB",
    }),
    "индекс",
  );
  assert.equal(
    canonicalCurrency({
      bot_id: "rf_bonds_rate_cycle",
      account_id: "rf_bonds_rate_cycle",
      venue: "RU_EQ",
      currency: "RUB",
    }),
    "индекс",
  );
  assert.equal(
    canonicalCurrency({ bot_id: "rf_bonds_rate_cycle", account_id: "x", currency: "USD" }),
    "индекс",
  );
});

test("rf conservative is always RUB and never remapped to USD/USDT", () => {
  assert.equal(
    canonicalCurrency({
      bot_id: "rf_conservative_comon",
      account_id: "rf_conservative_comon",
      currency: "USD",
    }),
    "RUB",
  );
  assert.equal(
    canonicalCurrency({
      bot_id: "rf_conservative_comon",
      account_id: "rf_conservative_comon",
      venue: "US_EQ",
      currency: "USDT",
    }),
    "RUB",
  );
  assert.equal(
    canonicalCurrency({ bot_id: "rf_conservative_comon", account_id: "x", currency: "USDT" }),
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
