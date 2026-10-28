import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lastEquityValue, resolveEquityPoints } from "./equityChartModel.js";
import { resolveLiveEquityPoints } from "./liveEquity.js";
import {
  coercePortalMode,
  createModeLoadGate,
  emptyFilters,
  emptyModeBucket,
  filtersAfterModeChange,
  isPortalMode,
  portalDocumentTitle,
  selectModeBucket,
  selectModeHistory,
  selectModeSnapshot,
} from "./portalMode.js";

const SAME_KEY = "v6b1::v6b1";
const PAPER_POINT = { t: "2026-10-16T00:00:00Z", equity: 10_000 };
const LIVE_POINT = { t: "2026-01-15T00:00:00Z", equity: 777 };

const paperAccount = {
  bot_id: "v6b1",
  account_id: "v6b1",
  currency: "USDT",
  equity: 10_000,
  seed: "10000",
};
const liveAccount = {
  bot_id: "v6b1",
  account_id: "v6b1",
  title: "Демо LIVE",
  currency: "USDT",
  equity: 777,
  valuation_basis: "broker_mark_to_market",
};

const paperHistory = {
  series: { [SAME_KEY]: { currency: "USDT", points: [PAPER_POINT] } },
};
const liveHistory = {
  series: { [SAME_KEY]: { currency: "USDT", points: [LIVE_POINT] } },
};

test("mode helpers accept only paper and live", () => {
  assert.equal(isPortalMode("paper"), true);
  assert.equal(isPortalMode("live"), true);
  assert.equal(isPortalMode("LIVE"), false);
  assert.equal(isPortalMode(""), false);
  assert.equal(coercePortalMode("nope"), "paper");
});

test("same bot_id::account_id keeps separate paper and live series", () => {
  const paperPts = resolveEquityPoints(paperAccount, paperHistory);
  const livePts = resolveLiveEquityPoints(liveAccount, liveHistory);
  assert.equal(lastEquityValue(paperAccount), 10_000);
  assert.equal(liveAccount.equity, 777);
  assert.ok(paperPts.some((p) => Number(p.equity) === 10_000));
  assert.deepEqual(livePts, [LIVE_POINT]);
  assert.notEqual(paperPts[paperPts.length - 1]?.equity, livePts[0]?.equity);
  const liveWithPaperResolver = resolveEquityPoints(paperAccount, liveHistory);
  assert.equal(liveWithPaperResolver.length, 0);

  const pickedPaper = selectModeHistory("paper", { paper: paperHistory, live: liveHistory });
  const pickedLive = selectModeHistory("live", { paper: paperHistory, live: liveHistory });
  assert.equal(pickedPaper.series[SAME_KEY].points[0].equity, 10_000);
  assert.equal(pickedLive.series[SAME_KEY].points[0].equity, 777);
  assert.notEqual(pickedPaper, pickedLive);
});

test("mode buckets are isolated and never merged", () => {
  const store = {
    paper: { ...emptyModeBucket("paper"), data: { accounts: [paperAccount] }, history: paperHistory },
    live: { ...emptyModeBucket("live"), data: { accounts: [liveAccount] }, history: liveHistory },
  };
  assert.equal(selectModeBucket(store, "paper").history.series[SAME_KEY].points[0].equity, 10_000);
  assert.equal(selectModeBucket(store, "live").history.series[SAME_KEY].points[0].equity, 777);
  assert.equal(selectModeSnapshot("paper", { paper: store.paper.data, live: store.live.data }).accounts[0].equity, 10_000);
  assert.equal(selectModeSnapshot("live", { paper: store.paper.data, live: store.live.data }).accounts[0].equity, 777);
});

test("late PAPER response cannot replace LIVE and vice versa", () => {
  const gate = createModeLoadGate();
  const paperReq = gate.begin("paper");
  const liveReq = gate.begin("live");
  assert.equal(paperReq.accept("paper"), false);
  assert.equal(liveReq.accept("live"), true);
  assert.equal(liveReq.accept("paper"), false);
  assert.equal(paperReq.accept("live"), false);
  assert.equal(liveReq.accept("live", { aborted: true }), false);

  const back = gate.begin("paper");
  assert.equal(liveReq.accept("live"), false);
  assert.equal(back.accept("paper"), true);
});

test("filters reset only when the mode changes", () => {
  const kept = { query: "маяк", currency: "RUB" };
  assert.deepEqual(filtersAfterModeChange("paper", "paper", kept), kept);
  assert.deepEqual(filtersAfterModeChange("paper", "live", kept), emptyFilters());
  assert.deepEqual(filtersAfterModeChange("live", "paper", kept), emptyFilters());
});

test("document title names the mode and optional strategy", () => {
  assert.equal(portalDocumentTitle("paper"), "Боты PAPER | Портфель стратегий");
  assert.equal(portalDocumentTitle("live"), "Боты LIVE | Портфель стратегий");
  assert.equal(
    portalDocumentTitle("paper", "v6b1"),
    "v6b1 · Боты PAPER | Портфель стратегий",
  );
});

test("LIVE helpers do not import PAPER stitch/reset and fixtures stay out of src", () => {
  const root = dirname(fileURLToPath(import.meta.url));
  const liveEquity = readFileSync(join(root, "liveEquity.js"), "utf8");
  const loadLive = readFileSync(join(root, "loadLiveFeed.js"), "utf8");
  const catalog = readFileSync(join(root, "liveCatalog.js"), "utf8");
  const app = readFileSync(join(root, "App.jsx"), "utf8");
  assert.doesNotMatch(liveEquity, /stitchEquity|historyReset|mergePortalAccounts/);
  assert.doesNotMatch(loadLive, /tests\/fixtures|EQUITY_LIVE_DATA_BASE/);
  assert.doesNotMatch(loadLive, /from "\.\/equityLiveData\.js"/);
  assert.doesNotMatch(catalog, /from "\.\/strategyMeta\.js"/);
  assert.doesNotMatch(app, /portfolio_krsk — бумажные боты/);
  assert.doesNotMatch(app, /bots\.map\(\(id\) =>/);
});
