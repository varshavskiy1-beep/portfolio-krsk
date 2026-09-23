import { test } from "node:test";
import assert from "node:assert/strict";
import { displayNote, fromCapitalLine } from "./uiCopy.js";

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
