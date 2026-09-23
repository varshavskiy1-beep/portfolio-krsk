import { test } from "node:test";
import assert from "node:assert/strict";
import { displayNote, fromCapitalLine, patternLabel, positionHasField, sideLabel } from "./uiCopy.js";

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
