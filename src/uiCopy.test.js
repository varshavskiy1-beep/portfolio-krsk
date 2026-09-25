import { test } from "node:test";
import assert from "node:assert/strict";
import {
  displayNote,
  fromCapitalLine,
  patternLabel,
  positionHasField,
  rewriteAccountCurrencyCopy,
  sideLabel,
} from "./uiCopy.js";

test("delta line is Russian and never says seed", () => {
  const line = fromCapitalLine({
    seed: 1_500_000,
    currency: "RUB",
    delta: 337_992,
    pct: 22.53,
  });
  assert.match(line, /от начального капитала 1\s?500\s?000: \+337\s?992 \(\+22\.53%\)/);
  assert.doesNotMatch(line, /seed/i);
});

test("displayNote replaces seed in feed comments", () => {
  const raw = "equity восстановлен из jsonl fills (seed + Σ qty·entry·pnl_pct).";
  const shown = displayNote(raw);
  assert.match(shown, /начальный капитал/);
  assert.doesNotMatch(shown, /seed/i);
});

test("displayNote rewrites Young Bounce / Robot 2 account currency to USDT", () => {
  const yb = displayNote(
    "Бумага. Young Bounce Combo, Binance spot, старт 10000 USD. На биржу ордера не идут.",
    { bot_id: "young_bounce_combo", account_id: "young_bounce_combo" },
  );
  assert.match(yb, /10000 USDT/);
  assert.doesNotMatch(yb, /\bUSD\b/);
  const robot2 = rewriteAccountCurrencyCopy("банк $10 000 USD", {
    bot_id: "three_robots_okx_nasdaq_1h",
    account_id: "paper_block2",
  });
  assert.equal(robot2, "банк 10 000 USDT");
  const oac = displayNote("Стартовый капитал 10 000 USD", {
    bot_id: "oac_paper",
    account_id: "oac_paper",
  });
  assert.match(oac, /10 000 USD/);
  assert.doesNotMatch(oac, /USDT/);
});

test("young bounce position fields: Russian pattern and side labels", () => {
  assert.equal(patternLabel("crash"), "обвал");
  assert.equal(patternLabel("listing_dump"), "дамп листинга");
  assert.equal(patternLabel("unknown_pattern"), "unknown_pattern");
  assert.equal(patternLabel(null), "—");
  assert.equal(sideLabel("long"), "лонг");
  assert.equal(sideLabel("short"), "шорт");
  const pos = { symbol: "BTCUSDT", side: "long", qty: "0.1", avg_px: "50000", mark: "50100", pattern: "crash" };
  assert.equal(positionHasField(pos, "mark"), true);
  assert.equal(positionHasField(pos, "pattern"), true);
  assert.equal(positionHasField({ symbol: "BTCUSDT" }, "mark"), false);
});
