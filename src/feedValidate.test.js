import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  LOAD_ERROR_RU,
  ONLY_PAPER_TRADE,
  REFRESH_MS,
  RETRY_LABEL,
  STALE_AFTER_MS,
  STALE_LABEL,
  assembleSnapshot,
  backtestSourceLine,
  feedSourceLine,
  formatFetchedAt,
  isFeedStale,
  validateBacktests,
  validateHistory,
  validateLatest,
} from "./feedValidate.js";
import { GLOSSARY } from "./strategyPassport.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("P01: latest.json must be an object with an accounts array of objects with string ids", () => {
  assert.equal(validateLatest({ accounts: [null] }).ok, false);
  assert.equal(validateLatest({ accounts: {} }).ok, false);
  assert.equal(validateLatest([{ bot_id: "x" }]).ok, false);
  assert.equal(validateLatest({ accounts: [{ bot_id: "v6b1" }] }).ok, false);
  assert.equal(
    validateLatest({
      accounts: [{ bot_id: "v6b1", account_id: "v6b1" }],
    }).ok,
    true,
  );
  assert.equal(assembleSnapshot({ accounts: [null] }, { series: {} }, { series: {} }).ok, false);
  assert.equal(assembleSnapshot({ accounts: {} }, null, null).ok, false);
  assert.equal(
    assembleSnapshot(
      { accounts: [{ bot_id: "v6b1", account_id: "v6b1" }] },
      { series: {} },
      { series: {} },
    ).ok,
    true,
  );
});

test("P01: history and backtests objects with a non-object series are rejected", () => {
  assert.equal(validateHistory([]).ok, false);
  assert.equal(validateHistory({ series: [] }).ok, false);
  assert.equal(validateHistory({ series: {} }).ok, true);
  assert.equal(validateHistory(null).ok, true);
  assert.equal(validateBacktests({ series: [] }).ok, false);
  assert.equal(validateBacktests({ series: {} }).ok, true);
});

test("P06: visible chrome copy is Russian paper trading, not «только paper»", () => {
  assert.equal(ONLY_PAPER_TRADE, "только бумажная торговля");
  assert.equal(RETRY_LABEL, "Повторить");
  assert.equal(LOAD_ERROR_RU, "Не удалось загрузить данные снимка.");
  const app = readFileSync(join(root, "src/App.jsx"), "utf8");
  const page = readFileSync(join(root, "src/StrategyPage.jsx"), "utf8");
  const passport = readFileSync(join(root, "src/StrategyPassport.jsx"), "utf8");
  assert.doesNotMatch(app, /только paper/);
  assert.doesNotMatch(page, /только paper/);
  assert.doesNotMatch(app, /Не на сайте \(live\)/);
  assert.doesNotMatch(app, /Не удалось загрузить данные: \{err\}/);
  assert.doesNotMatch(passport, /paper-счёта/);
  assert.equal(GLOSSARY[0].term, "Бумага");
});

test("P07: stale after 40 minutes; refresh interval is 5 minutes", () => {
  assert.equal(REFRESH_MS, 5 * 60 * 1000);
  assert.equal(STALE_AFTER_MS, 40 * 60 * 1000);
  assert.equal(isFeedStale(1_000, 1_000 + STALE_AFTER_MS), false);
  assert.equal(isFeedStale(1_000, 1_000 + STALE_AFTER_MS + 1), true);
  assert.equal(isFeedStale(null), false);
  assert.equal(STALE_LABEL, "снимок просрочен");
  assert.match(formatFetchedAt(Date.parse("2026-10-17T10:45:00Z")), /17/);
});

test("P08: feed and backtest source lines stay honest about primary quotes", () => {
  const feed = feedSourceLine("2026-10-17T10:45:45Z");
  assert.match(feed, /equity-ro latest\.json/);
  assert.match(feed, /2026-10-17T10:45:45Z/);
  assert.match(feed, /не проверялись/);
  const src = backtestSourceLine("repo@abc docs/reports/nav.csv");
  assert.match(src, /Источник ряда/);
  assert.match(src, /nav\.csv/);
  assert.match(src, /не проверялись/);
  assert.equal(backtestSourceLine(""), "");
});
