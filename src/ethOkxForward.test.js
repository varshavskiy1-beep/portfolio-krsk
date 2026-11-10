import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildSeries, resolveChartBase, resolveEquityPoints } from "./equityChartModel.js";
import {
  ethOkxFromStartPctLine,
  ethOkxHistoryPoints,
  ethOkxOpenedLine,
  visibleEthOkxPositions,
} from "./ethOkxCard.js";
import {
  ETH_OKX_FORWARD_SERIES_KEY,
  ETH_OKX_FORWARD_SIDECAR,
  ETH_OKX_FORWARD_START_CAPITAL,
  ETH_OKX_FORWARD_STRATEGY_ID,
  allowForwardHourTick,
  applyEthOkxForwardHistoryReplace,
  dropStaleEthOkxForwardGenerationCache,
  ethOkxForwardExportCurve,
  formatForwardHourTick,
  isCancelledOct27Midnight,
  isEthOkxForwardAttempt,
  isEthOkxForwardSidecarUrl,
  isEthOkxReconstructedExport,
  isTestFeedSnapshot,
  isUtcDateTimeStamp,
  isValidEthOkxForwardReset,
  nextUtcHourAfter,
  parseEthOkxForwardReset,
  seriesStrictlyEqual,
  withoutEthOkxForwardBacktest,
} from "./ethOkxForward.js";
import { EQUITY_LIVE_DATA_BASE } from "./equityLiveData.js";
import { HISTORY_RESETS, PAPER_BLOCK2_SERIES_KEY } from "./historyReset.js";
import { mergeLatestIntoHistory } from "./historyMerge.js";
import { fetchCabinetSnapshot } from "./loadFeed.js";
import { stitchEquity, stitchPaperPoints } from "./stitchEquity.js";
import {
  ETH_OKX_MOEX_ACCOUNT_ID,
  ETH_OKX_MOEX_BOT_ID,
  hasAccountData,
  mergePortalAccounts,
  showsPaperBadge,
} from "./strategyMeta.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEST_FIXTURE = JSON.parse(
  readFileSync(join(root, "src/fixtures/TEST_eth_okx_forward_reset.json"), "utf8"),
);

const SEED_AT = "2026-11-10T06:17:42Z";
const KEY = ETH_OKX_FORWARD_SERIES_KEY;
const HOUR = 3;

function fixtureAccount() {
  return structuredClone(TEST_FIXTURE.accounts.find((a) => a.account_id === ETH_OKX_MOEX_ACCOUNT_ID));
}

function liveLikeEth() {
  return {
    bot_id: ETH_OKX_MOEX_BOT_ID,
    account_id: ETH_OKX_MOEX_ACCOUNT_ID,
    currency: "RUB",
    seed: "300000",
    equity: "331126.7447307759",
    cash: "1.2047307759283967",
    updated_utc: "2026-11-10T05:02:26Z",
    as_of: "2026-11-10",
    positions: [
      { symbol: "EHX6", side: "short", qty: "94", avg_px: "2135.6" },
      { symbol: "LQDT", side: "long", qty: "155458", avg_px: "2.13" },
    ],
    history: [
      { t: "2026-10-13", equity: "300000.0" },
      { t: "2026-10-27", equity: "320000.0" },
      { t: "2026-11-10", equity: "331126.7447307759" },
    ],
  };
}

function contaminatedHistory() {
  return {
    schema: "equity_history.v1",
    series: {
      [KEY]: {
        bot_id: ETH_OKX_MOEX_BOT_ID,
        account_id: ETH_OKX_MOEX_ACCOUNT_ID,
        currency: "RUB",
        seed: 300000,
        points: [
          { t: "2026-10-13T05:42:49Z", equity: 299970.19681904 },
          { t: "2026-10-27T00:00:00Z", equity: 331126.7447307759 },
          { t: "2026-11-10T05:02:26Z", equity: 331126.7447307759 },
        ],
      },
      "v6b1::v6b1": {
        bot_id: "v6b1",
        account_id: "v6b1",
        points: [{ t: "2026-10-15T17:27:12Z", equity: 10000 }],
      },
    },
  };
}

test("TEST fixture is marked test and is not a live snapshot", () => {
  assert.equal(TEST_FIXTURE.test_fixture, true);
  assert.equal(isTestFeedSnapshot(TEST_FIXTURE), true);
  assert.equal(isTestFeedSnapshot({ generated_at: "2026-11-10T05:43:58Z" }), false);
  assert.match(TEST_FIXTURE.test_fixture_note, /ТЕСТОВЫЙ СНИМОК/);
  assert.match(TEST_FIXTURE.test_fixture_note, /Не прод/);
});

test("UTC datetime accepts non-round seed and rejects date-only", () => {
  assert.equal(isUtcDateTimeStamp(SEED_AT), true);
  assert.equal(isUtcDateTimeStamp("2026-11-10T06:00:00Z"), true);
  assert.equal(isUtcDateTimeStamp("2026-11-10"), false);
  assert.equal(isUtcDateTimeStamp(""), false);
  assert.equal(isCancelledOct27Midnight("2026-10-27"), true);
  assert.equal(isCancelledOct27Midnight("2026-10-27T00:00:00Z"), true);
  assert.equal(isCancelledOct27Midnight(SEED_AT), false);
});

test("valid replace: exact account_key, strategy_id, reconstructed false, generation from sidecar copy", () => {
  const acc = fixtureAccount();
  const spec = parseEthOkxForwardReset(acc);
  assert.ok(spec);
  assert.equal(spec.accountKey, "eth_okx_moex::eth_okx_moex");
  assert.equal(spec.strategyId, ETH_OKX_FORWARD_STRATEGY_ID);
  assert.equal(spec.historyMode, "replace");
  assert.equal(spec.reconstructed, false);
  assert.equal(spec.generation, ETH_OKX_FORWARD_SIDECAR);
  assert.equal(spec.seedAt, SEED_AT);
  assert.equal(spec.start, SEED_AT);
  assert.equal(spec.startCapital, ETH_OKX_FORWARD_START_CAPITAL);
  assert.equal(isValidEthOkxForwardReset(acc), true);
});

test("start equals seed_at; non-hour 13:17:42 KRAT / 06:17:42Z is the seed", () => {
  const acc = fixtureAccount();
  assert.equal(acc.start, acc.seed_at);
  assert.equal(acc.seed_at, SEED_AT);
  assert.notEqual(SEED_AT.slice(14, 19), "00:00");
  const spec = parseEthOkxForwardReset(acc);
  assert.equal(spec.points[0].t, SEED_AT);
  assert.equal(spec.points[0].equity, 300000);
  const noStart = fixtureAccount();
  delete noStart.start;
  assert.equal(parseEthOkxForwardReset(noStart).seedAt, SEED_AT);
  assert.equal(parseEthOkxForwardReset({ ...acc, start: "2026-11-10T06:00:00Z" }), null);
});

test("history == equity_curve strictly when both present", () => {
  const acc = fixtureAccount();
  assert.equal(seriesStrictlyEqual(acc.history, acc.equity_curve), true);
  assert.equal(acc.history[0].t, acc.seed_at);
  assert.equal(Number(acc.history[0].equity), 300000);
  const mismatch = fixtureAccount();
  mismatch.equity_curve = mismatch.equity_curve.map((p, i) =>
    i === 1 ? { ...p, equity: "300091.0" } : p,
  );
  assert.equal(seriesStrictlyEqual(mismatch.history, mismatch.equity_curve), false);
  assert.equal(parseEthOkxForwardReset(mismatch), null);
  assert.deepEqual(ethOkxForwardExportCurve(mismatch), []);
});

test("live-like export without generation is not a reset — account state unchanged", () => {
  const acc = liveLikeEth();
  assert.equal(parseEthOkxForwardReset(acc), null);
  assert.equal(isEthOkxForwardAttempt(acc), false);
  const points = ethOkxHistoryPoints(acc);
  assert.equal(points.length, 3);
  assert.equal(points[0].t, "2026-10-13");
  assert.equal(Number(points.at(-1).equity), 331126.7447307759);
  assert.notEqual(ethOkxFromStartPctLine(acc), "+0,00% от старта");
  assert.equal(hasAccountData(acc), true);
});

test("invalid contract fragments fail closed and do not invent 300000/0%", () => {
  const base = fixtureAccount();
  assert.equal(parseEthOkxForwardReset({ ...base, history_mode: "splice" }), null);
  assert.equal(parseEthOkxForwardReset({ ...base, history_mode: "union" }), null);
  assert.equal(parseEthOkxForwardReset({ ...base, reconstructed: true }), null);
  assert.equal(parseEthOkxForwardReset({ ...base, reconstructed: "false" }), null);
  const noRec = { ...base };
  delete noRec.reconstructed;
  assert.equal(parseEthOkxForwardReset(noRec), null);
  assert.equal(parseEthOkxForwardReset({ ...base, strategy_id: "ETH_OKX_OTHER" }), null);
  const noGen = { ...base };
  delete noGen.generation;
  assert.equal(parseEthOkxForwardReset(noGen), null);
  assert.equal(parseEthOkxForwardReset({ ...base, seed_at: "2026-11-10" }), null);
  assert.equal(parseEthOkxForwardReset({ ...base, seed_at: "2026-10-27T00:00:00Z" }), null);
  assert.equal(parseEthOkxForwardReset({ ...base, seed: "299999" }), null);
  const empty = { ...base, history: [], equity_curve: [] };
  assert.equal(parseEthOkxForwardReset(empty), null);
  assert.deepEqual(ethOkxHistoryPoints(empty), []);
  assert.equal(ethOkxHistoryPoints(empty).some((p) => p.equity === 300000), false);
});

test("TEST fixture curve starts at actual seed 300000 / 0%, hours after seed kept", () => {
  const acc = fixtureAccount();
  const points = ethOkxHistoryPoints(acc);
  assert.deepEqual(
    points.map((p) => [p.t, p.equity]),
    [
      [SEED_AT, 300000],
      ["2026-11-10T07:00:00Z", 300090],
      ["2026-11-10T08:00:00Z", 300180],
    ],
  );
  assert.equal(points[0].t.includes("06:17:42"), true);
  assert.equal(
    points.some((p) => String(p.t).startsWith("2026-10-13") || String(p.t).startsWith("2026-10-27")),
    false,
  );
  const pct = buildSeries(points, 300000, "pct");
  assert.equal(pct[0].value, 0);
  assert.ok(Math.abs(pct[2].value - 0.06) < 1e-9);
  assert.equal(ethOkxFromStartPctLine(acc), "+0,06% от старта");
  assert.equal(resolveChartBase(acc, points, { series: {} }).base, 300000);
  assert.equal(ethOkxOpenedLine(acc), "");
  assert.equal(Number(acc.equity), 300180);
});

test("hour labels are strictly after seed — seed is not rounded to HH:00", () => {
  const seedMs = Date.parse(SEED_AT);
  assert.equal(nextUtcHourAfter(seedMs), Date.parse("2026-11-10T07:00:00Z"));
  assert.equal(allowForwardHourTick(Date.parse("2026-11-10T06:00:00Z") / 1000, seedMs), false);
  assert.equal(allowForwardHourTick(Date.parse(SEED_AT) / 1000, seedMs), false);
  assert.equal(allowForwardHourTick(Date.parse("2026-11-10T07:00:00Z") / 1000, seedMs), true);
  assert.equal(formatForwardHourTick(Date.parse("2026-11-10T06:00:00Z") / 1000, HOUR, seedMs), "");
  assert.equal(formatForwardHourTick(Date.parse("2026-11-10T07:00:00Z") / 1000, HOUR, seedMs), "07:00");
});

test("seed-only export is the seed row; curve export does not substitute equity", () => {
  const seedOnly = fixtureAccount();
  seedOnly.equity = "300000";
  seedOnly.history = [{ t: SEED_AT, equity: "300000.0" }];
  seedOnly.equity_curve = [{ t: SEED_AT, equity: "300000.0" }];
  const pts = ethOkxHistoryPoints(seedOnly);
  assert.deepEqual(pts, [{ t: SEED_AT, equity: 300000 }]);
  assert.equal(ethOkxFromStartPctLine(seedOnly), "+0,00% от старта");
  const curve = fixtureAccount();
  assert.equal(Number(curve.equity), 300180);
  assert.notEqual(Number(curve.equity), 300000);
});

test("extra metadata is compatible; LQDT/qty after seed does not invalidate generation", () => {
  const acc = fixtureAccount();
  acc.venue = "FORTS";
  acc.foo = "bar";
  acc.positions = [
    { symbol: "EHX6", side: "short", qty: "94", avg_px: "2135.6" },
    { symbol: "LQDT", side: "long", qty: "155458", avg_px: "2.13" },
  ];
  assert.ok(parseEthOkxForwardReset(acc));
  assert.deepEqual(
    visibleEthOkxPositions(acc).map((p) => p.symbol),
    ["EHX6", "LQDT"],
  );
  assert.equal(showsPaperBadge(acc), true);
});

test("sidecar is not the equity feed; portal does not fetch it", async () => {
  assert.equal(isEthOkxForwardSidecarUrl(`https://example/data/${ETH_OKX_FORWARD_SIDECAR}`), true);
  const src = readFileSync(join(root, "src/loadFeed.js"), "utf8");
  assert.match(src, /data\/latest\.json/);
  assert.doesNotMatch(src, /data\/eth_okx_moex\.forward\.json/);
  const prev = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url, init) => {
    urls.push(String(url));
    assert.equal(init?.cache, "no-store");
    const u = String(url);
    if (u.includes("latest.json")) {
      return { ok: true, json: async () => ({ accounts: [liveLikeEth()] }) };
    }
    if (u.includes("history.json") || u.includes("backtests.json")) {
      return { ok: true, json: async () => ({ series: {} }) };
    }
    return { ok: false, status: 404, json: async () => null };
  };
  try {
    const snap = await fetchCabinetSnapshot("/", { liveBase: EQUITY_LIVE_DATA_BASE });
    assert.equal(snap.ok, true);
    assert.equal(urls.some((u) => isEthOkxForwardSidecarUrl(u)), false);
  } finally {
    globalThis.fetch = prev;
  }
});

test("merge replace: whole series swapped, no union with old history cache", () => {
  const hist = contaminatedHistory();
  mergeLatestIntoHistory(hist, TEST_FIXTURE);
  const pts = hist.series[KEY].points;
  assert.deepEqual(
    pts.map((p) => [p.t, p.equity]),
    [
      [SEED_AT, 300000],
      ["2026-11-10T07:00:00Z", 300090],
      ["2026-11-10T08:00:00Z", 300180],
    ],
  );
  assert.equal(hist.series[KEY].generation, ETH_OKX_FORWARD_SIDECAR);
  assert.equal(hist.series[KEY].seed_at, SEED_AT);
  assert.equal(pts.some((p) => p.t.startsWith("2026-10-13") || p.t.startsWith("2026-10-27")), false);
  assert.equal(hist.series["v6b1::v6b1"].points[0].equity, 10000);
});

test("wrong contract does not union stale cache or restore a chart", () => {
  const hist = contaminatedHistory();
  const before = JSON.parse(JSON.stringify(hist.series[KEY].points));
  const bad = fixtureAccount();
  bad.equity_curve = [{ t: SEED_AT, equity: "300000.0" }];
  mergeLatestIntoHistory(hist, { generated_at: "2026-11-10T08:00:00Z", accounts: [bad] });
  assert.deepEqual(hist.series[KEY].points, before);
  assert.deepEqual(ethOkxHistoryPoints(bad), []);
  assert.equal(isEthOkxForwardAttempt(bad), true);
});

test("generation change replaces again; stale generation cache rolls back", () => {
  const hist = contaminatedHistory();
  mergeLatestIntoHistory(hist, TEST_FIXTURE);
  const nextSeed = "2026-11-10T09:03:11Z";
  const g2acc = {
    ...fixtureAccount(),
    generation: "eth_okx_moex.forward.json#2",
    start: nextSeed,
    seed_at: nextSeed,
    equity: "300000",
    history: [{ t: nextSeed, equity: "300000.0" }],
    equity_curve: [{ t: nextSeed, equity: "300000.0" }],
  };
  mergeLatestIntoHistory(hist, { generated_at: nextSeed, accounts: [g2acc] });
  assert.equal(hist.series[KEY].generation, "eth_okx_moex.forward.json#2");
  assert.deepEqual(hist.series[KEY].points, [{ t: nextSeed, equity: 300000 }]);

  mergeLatestIntoHistory(hist, { generated_at: "2026-11-10T10:00:00Z", accounts: [liveLikeEth()] });
  assert.equal(hist.series[KEY].generation, undefined);
  assert.equal(hist.series[KEY].points.some((p) => p.t === nextSeed), false);
});

test("reconstructed true is not a forward reset and does not splice into cache", () => {
  const acc = { ...fixtureAccount(), reconstructed: true };
  assert.equal(isEthOkxReconstructedExport(acc), true);
  assert.equal(parseEthOkxForwardReset(acc), null);
  const hist = contaminatedHistory();
  const before = JSON.parse(JSON.stringify(hist.series[KEY].points));
  mergeLatestIntoHistory(hist, { generated_at: "2026-11-10T08:00:00Z", accounts: [acc] });
  assert.deepEqual(hist.series[KEY].points, before);
  assert.deepEqual(ethOkxHistoryPoints(acc), []);
});

test("other accounts stay intact; paper_block2 is not reseeded; no ORDERS table", () => {
  const hist = contaminatedHistory();
  hist.series[PAPER_BLOCK2_SERIES_KEY] = {
    bot_id: "three_robots_okx_nasdaq_1h",
    account_id: "paper_block2",
    points: [{ t: "2026-10-15T08:57:31Z", equity: 10000 }],
  };
  mergeLatestIntoHistory(hist, TEST_FIXTURE);
  assert.equal(hist.series[PAPER_BLOCK2_SERIES_KEY], undefined);
  assert.equal(HISTORY_RESETS[KEY], undefined);
  const merged = mergePortalAccounts(TEST_FIXTURE.accounts);
  assert.equal(merged.some((a) => a.account_id === "paper_block2"), false);
  const eth = merged.find((a) => a.account_id === ETH_OKX_MOEX_ACCOUNT_ID);
  assert.equal(showsPaperBadge(eth), true);
  assert.equal(Array.isArray(eth.orders), false);
  const srcApp = readFileSync(join(root, "src/App.jsx"), "utf8");
  assert.doesNotMatch(srcApp, /\bLive\b/);
  assert.equal(Number(merged.find((a) => a.bot_id === "v6b1").equity), 10125.5);
});

test("working chart does not union replace generation with history.json or backtests", () => {
  const acc = fixtureAccount();
  const oldHist = contaminatedHistory();
  const card = resolveEquityPoints(acc, oldHist);
  assert.deepEqual(
    card.map((p) => p.t),
    [SEED_AT, "2026-11-10T07:00:00Z", "2026-11-10T08:00:00Z"],
  );
  const paper = stitchPaperPoints(acc, card, oldHist);
  assert.deepEqual(paper.map((p) => p.t), card.map((p) => p.t));
  const backtests = {
    series: {
      [KEY]: {
        points: [
          { t: "2025-11-18", equity: 300000 },
          { t: "2026-10-10", equity: 280000 },
        ],
      },
    },
  };
  const stripped = withoutEthOkxForwardBacktest(backtests, acc);
  assert.equal(stripped.series[KEY], undefined);
  const st = stitchEquity(stripped.series?.[KEY]?.points || [], paper);
  assert.equal(st.ok, false);
  assert.equal(st.reason, "no_backtest");
});

test("applyEthOkxForwardHistoryReplace is a no-op without a valid generation", () => {
  const hist = contaminatedHistory();
  assert.equal(applyEthOkxForwardHistoryReplace(hist, liveLikeEth()), false);
  assert.equal(hist.series[KEY].points.length, 3);
  assert.equal(dropStaleEthOkxForwardGenerationCache(hist, liveLikeEth()), false);
});
