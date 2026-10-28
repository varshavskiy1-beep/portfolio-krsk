import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LIVE_CATALOG } from "./liveCatalog.js";
import { liveEquityDisplay, resolveLiveEquityPoints } from "./liveEquity.js";
import {
  LIVE_STALE_AFTER_MS,
  assembleLivePair,
  formatLiveDateTime,
  formatLiveReportDate,
  isLiveSnapshotInFuture,
  isLiveSnapshotStale,
  isValidDateOnly,
  isValidUtcIsoZ,
  liveKrasnoyarskDay,
  validateLiveHistory,
  validateLiveLatest,
} from "./liveFeedValidate.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "..", "tests", "fixtures");
const catalog = JSON.parse(readFileSync(join(fixtures, "live-catalog.json"), "utf8"));
const latestValid = JSON.parse(readFileSync(join(fixtures, "live-latest.valid.json"), "utf8"));
const historyValid = JSON.parse(readFileSync(join(fixtures, "live-history.valid.json"), "utf8"));
const latestEmpty = JSON.parse(readFileSync(join(fixtures, "live-latest.empty.json"), "utf8"));
const historyEmpty = JSON.parse(readFileSync(join(fixtures, "live-history.empty.json"), "utf8"));
const sameId = JSON.parse(readFileSync(join(fixtures, "live-same-id.json"), "utf8"));
const unknownBasis = JSON.parse(readFileSync(join(fixtures, "live-unknown-basis.json"), "utf8"));

test("empty production catalog accepts only an empty pair", () => {
  assert.equal(assembleLivePair(latestEmpty, historyEmpty, LIVE_CATALOG).ok, true);
  assert.equal(assembleLivePair(latestValid, historyValid, LIVE_CATALOG).ok, false);
  assert.equal(assembleLivePair(latestValid, historyValid, LIVE_CATALOG).reason, "account_not_in_catalog");
});

test("valid fixture pair is accepted against the test catalog", () => {
  const snap = assembleLivePair(latestValid, historyValid, catalog);
  assert.equal(snap.ok, true);
  assert.equal(snap.latest.accounts[0].accountLabel, "счёт Альфа");
  assert.equal(snap.history.series["demo_live_bot::pub_acct_alpha"].points.at(-1).equity, 12500.5);
});

test("same bot_id::account_id live fixture is not a paper yield series", () => {
  const snap = assembleLivePair(sameId.latest, sameId.history, catalog);
  assert.equal(snap.ok, true);
  assert.equal(snap.latest.accounts[0].equity, 777);
  const pts = resolveLiveEquityPoints(snap.latest.accounts[0], snap.history);
  assert.equal(pts[0].equity, 777);
});

test("JSON shapes that are not a live object are rejected", () => {
  assert.equal(validateLiveLatest(null, catalog).ok, false);
  assert.equal(validateLiveLatest([], catalog).ok, false);
  assert.equal(validateLiveLatest({ accounts: {} }, catalog).ok, false);
  const withObjectAccounts = { ...latestValid, accounts: {} };
  assert.equal(validateLiveLatest(withObjectAccounts, catalog).reason, "accounts_not_array");
  assert.equal(validateLiveLatest({ ...latestValid, accounts: [null] }, catalog).ok, false);
  assert.equal(validateLiveHistory({ ...historyValid, series: [] }, catalog).ok, false);
  assert.equal(validateLiveHistory(null, catalog).ok, false);
});

test("unknown private field rejects the new snapshot", () => {
  assert.equal(
    validateLiveLatest({ ...latestValid, broker_account: "ACC-1" }, catalog).reason,
    "latest_unknown_field",
  );
  const leaked = {
    ...latestValid,
    accounts: [{ ...latestValid.accounts[0], positions: [{ symbol: "BTC" }] }],
  };
  assert.equal(validateLiveLatest(leaked, catalog).reason, "account_unknown_field");
});

test("unknown account, duplicate pair and currency conflict are rejected", () => {
  const unknown = {
    ...latestValid,
    accounts: [{ ...latestValid.accounts[0], bot_id: "not_in_catalog", account_id: "x" }],
  };
  assert.equal(validateLiveLatest(unknown, catalog).reason, "account_not_in_catalog");
  const dup = {
    ...latestValid,
    accounts: [latestValid.accounts[0], { ...latestValid.accounts[0] }],
  };
  assert.equal(validateLiveLatest(dup, catalog).reason, "account_duplicate");
  const cur = {
    ...latestValid,
    accounts: [{ ...latestValid.accounts[0], currency: "RUB" }],
  };
  assert.equal(validateLiveLatest(cur, catalog).reason, "account_currency");
});

test("numbers: null kept, zero kept, negative kept, string and Infinity rejected", () => {
  const withNull = {
    ...latestValid,
    accounts: [{ ...latestValid.accounts[0], equity: null }],
  };
  const nullOk = validateLiveLatest(withNull, catalog);
  assert.equal(nullOk.ok, true);
  assert.equal(nullOk.value.accounts[0].equity, null);

  const zero = {
    ...latestValid,
    accounts: [{ ...latestValid.accounts[0], equity: 0 }],
  };
  assert.equal(validateLiveLatest(zero, catalog).value.accounts[0].equity, 0);

  const neg = {
    ...latestValid,
    accounts: [{ ...latestValid.accounts[0], equity: -12.5 }],
  };
  assert.equal(validateLiveLatest(neg, catalog).value.accounts[0].equity, -12.5);

  const asString = {
    ...latestValid,
    accounts: [{ ...latestValid.accounts[0], equity: "12500" }],
  };
  assert.equal(validateLiveLatest(asString, catalog).ok, false);

  const inf = {
    ...latestValid,
    accounts: [{ ...latestValid.accounts[0], equity: Infinity }],
  };
  assert.equal(validateLiveLatest(inf, catalog).ok, false);
});

test("point times: impossible date rejected; date-only and UTC kept; last duplicate wins", () => {
  assert.equal(isValidDateOnly("2026-02-30"), false);
  assert.equal(isValidUtcIsoZ("2026-02-30T00:00:00Z"), false);
  assert.equal(isValidUtcIsoZ("2026-10-28T04:00:00Z"), true);
  const badDate = {
    ...historyValid,
    series: {
      "demo_live_bot::pub_acct_alpha": {
        currency: "USDT",
        points: [{ t: "2026-02-30", equity: 1 }],
      },
    },
  };
  assert.equal(validateLiveHistory(badDate, catalog, latestValid.accounts).ok, false);

  const dupTime = {
    ...historyValid,
    series: {
      "demo_live_bot::pub_acct_alpha": {
        currency: "USDT",
        points: [
          { t: "2026-10-27T12:00:00Z", equity: 1 },
          { t: "2026-10-27T12:00:00Z", equity: 9 },
          { t: "2026-10-26", equity: 0 },
        ],
      },
    },
  };
  const hist = validateLiveHistory(dupTime, catalog, latestValid.accounts);
  assert.equal(hist.ok, true);
  const pts = hist.value.series["demo_live_bot::pub_acct_alpha"].points;
  assert.equal(pts[0].equity, 0);
  assert.equal(pts.at(-1).equity, 9);
});

test("point after snapshot is rejected; date-only compares the UTC calendar day", () => {
  const lateIso = {
    ...historyValid,
    series: {
      "demo_live_bot::pub_acct_alpha": {
        currency: "USDT",
        points: [{ t: "2026-10-28T04:06:00Z", equity: 1 }],
      },
    },
  };
  assert.equal(validateLiveHistory(lateIso, catalog, latestValid.accounts).reason, "point_after_snapshot");

  const nextDay = {
    ...historyValid,
    series: {
      "demo_live_bot::pub_acct_alpha": {
        currency: "USDT",
        points: [{ t: "2026-10-29", equity: 1 }],
      },
    },
  };
  assert.equal(validateLiveHistory(nextDay, catalog, latestValid.accounts).reason, "point_after_snapshot");
});

test("foreign series and extra series fields are rejected", () => {
  const foreign = {
    ...historyValid,
    series: {
      ...historyValid.series,
      "other::other": { currency: "USDT", points: [] },
    },
  };
  assert.equal(validateLiveHistory(foreign, catalog, latestValid.accounts).reason, "series_foreign_key");
});

test("mismatched snapshot ids cannot be merged", () => {
  const otherHist = { ...historyValid, snapshot_id: "other" };
  assert.equal(assembleLivePair(latestValid, otherHist, catalog).reason, "snapshot_mismatch");
});

test("time helpers: report day is not shifted; stale uses generated_at", () => {
  assert.equal(formatLiveReportDate("2026-10-28"), "28.10.2026");
  assert.match(formatLiveDateTime("2026-10-28T04:00:00Z"), /Красноярск, UTC\+7/);
  const utcEvening = "2026-10-27T20:00:00Z";
  assert.equal(liveKrasnoyarskDay(utcEvening), "2026-10-28");
  const gen = "2026-10-28T04:00:00Z";
  const genMs = Date.parse(gen);
  assert.equal(isLiveSnapshotStale(gen, genMs + LIVE_STALE_AFTER_MS), false);
  assert.equal(isLiveSnapshotStale(gen, genMs + LIVE_STALE_AFTER_MS + 1), true);
  assert.equal(isLiveSnapshotInFuture(gen, genMs - 6 * 60 * 1000), true);
  assert.equal(isLiveSnapshotInFuture(gen, genMs - 2 * 60 * 1000), false);
});

test("valuation_basis unknown hides the money number and chart", () => {
  const snap = validateLiveLatest(unknownBasis, catalog);
  assert.equal(snap.ok, true);
  const acc = snap.value.accounts[0];
  assert.equal(liveEquityDisplay(acc).kind, "unknown_basis");
  assert.deepEqual(resolveLiveEquityPoints(acc, historyValid), []);
});

test("deposit-like equity growth is not treated as return percent", () => {
  const acc = {
    bot_id: "demo_live_bot",
    account_id: "pub_acct_alpha",
    equity: 20_000,
    valuation_basis: "broker_mark_to_market",
  };
  const history = {
    series: {
      "demo_live_bot::pub_acct_alpha": {
        currency: "USDT",
        points: [
          { t: "2026-10-01", equity: 10_000 },
          { t: "2026-10-02", equity: 20_000 },
        ],
      },
    },
  };
  const pts = resolveLiveEquityPoints(acc, history);
  assert.equal(pts[0].equity, 10_000);
  assert.equal(pts[1].equity, 20_000);
  const seedPct = ((20_000 - 10_000) / 10_000) * 100;
  assert.equal(seedPct, 100);
  const display = liveEquityDisplay(acc);
  assert.equal(display.kind, "value");
  assert.equal(display.value, 20_000);
});
