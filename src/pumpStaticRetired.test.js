/**
 * Retired pump_radar and forts_adr_static: stale feed/cache and a direct hash
 * must not show the card, equity, %PnL, OG or passport. Other books stay intact
 * (ETH included). Ids remain only in exclusion lists and these tests.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { EQUITY_LIVE_DATA_BASE } from "./equityLiveData.js";
import { fetchCabinetSnapshot } from "./loadFeed.js";
import {
  dropHiddenFeedRows,
  isDroppedEquitySeries,
  mergeLatestIntoHistory,
  sanitizeCabinetSnapshot,
} from "./historyMerge.js";
import { ogDescription, pickOgWinner } from "./ogWinner.js";
import { isBlockedStrategyRoute, parsePortalHash } from "./portalRoute.js";
import {
  displayedBotIds,
  getPassport,
  hasAuthoredPassport,
} from "./strategyPassport.js";
import {
  FORTS_ADR_STATIC_ACCOUNT_ID,
  FORTS_ADR_STATIC_BOT_ID,
  FORTS_ADR_STATIC_SERIES_KEY,
  HIDDEN_PORTAL_IDS,
  PUMP_RADAR_ACCOUNT_ID,
  PUMP_RADAR_BOT_ID,
  PUMP_RADAR_SERIES_KEY,
  isHiddenPortalAccount,
  isHiddenPortalId,
  mergePortalAccounts,
} from "./strategyMeta.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const V6 = "v6b1::v6b1";
const ETH = "eth_okx_moex::eth_okx_moex";
const TARGETS = [PUMP_RADAR_BOT_ID, FORTS_ADR_STATIC_BOT_ID];

function jsonResponse(body, ok = true) {
  return {
    ok,
    json: async () => body,
  };
}

function staleLatest() {
  return {
    generated_at: "2026-11-11T00:00:00Z",
    accounts: [
      {
        bot_id: "v6b1",
        account_id: "v6b1",
        currency: "USDT",
        equity: "14515.61",
        seed: "10000",
      },
      {
        bot_id: PUMP_RADAR_BOT_ID,
        account_id: PUMP_RADAR_ACCOUNT_ID,
        currency: "USDT",
        equity: "10508.47",
        seed: "10000",
      },
      {
        bot_id: FORTS_ADR_STATIC_BOT_ID,
        account_id: FORTS_ADR_STATIC_ACCOUNT_ID,
        currency: "RUB",
        equity: "2249000",
        seed: "1500000",
        equity_curve: [
          { t: "2026-09-19T03:56:37Z", equity: "1500000" },
          { t: "2026-11-11T00:00:00Z", equity: "2249000" },
        ],
      },
      {
        bot_id: "eth_okx_moex",
        account_id: "eth_okx_moex",
        currency: "RUB",
        equity: "308800.21",
        seed: "300000",
      },
    ],
    manifest: [
      { bot_id: "v6b1", logic: "ok" },
      { bot_id: PUMP_RADAR_BOT_ID, logic: "retired" },
      { bot_id: FORTS_ADR_STATIC_BOT_ID, logic: "retired" },
      { bot_id: "eth_okx_moex", logic: "ok" },
    ],
  };
}

function staleHistory() {
  return {
    schema: "equity_history.v1",
    updated_at: "2026-11-11T00:00:00Z",
    series: {
      [V6]: {
        bot_id: "v6b1",
        account_id: "v6b1",
        currency: "USDT",
        seed: 10000,
        points: [{ t: "2026-10-15T17:27:12Z", equity: 14515.61 }],
      },
      [PUMP_RADAR_SERIES_KEY]: {
        bot_id: PUMP_RADAR_BOT_ID,
        account_id: PUMP_RADAR_ACCOUNT_ID,
        currency: "USDT",
        seed: 10000,
        points: [
          { t: "2026-09-18T00:00:00Z", equity: 10000 },
          { t: "2026-11-11T00:00:00Z", equity: 10508.47 },
        ],
      },
      [FORTS_ADR_STATIC_SERIES_KEY]: {
        bot_id: FORTS_ADR_STATIC_BOT_ID,
        account_id: FORTS_ADR_STATIC_ACCOUNT_ID,
        currency: "RUB",
        seed: 1500000,
        points: [
          { t: "2026-09-19T03:56:37Z", equity: 1500000 },
          { t: "2026-11-10T13:20:37Z", equity: 1535646.46 },
        ],
      },
      [ETH]: {
        bot_id: "eth_okx_moex",
        account_id: "eth_okx_moex",
        currency: "RUB",
        seed: 300000,
        points: [
          { t: "2026-10-13T00:00:00Z", equity: 300000 },
          { t: "2026-11-11T08:00:00Z", equity: 308800.21 },
        ],
      },
    },
  };
}

test("exclusion list names retired pump and static ids", () => {
  for (const id of TARGETS) {
    assert.equal(HIDDEN_PORTAL_IDS.has(id), true, id);
    assert.equal(isHiddenPortalId(id), true, id);
    assert.equal(isHiddenPortalAccount({ bot_id: id, account_id: id }), true, id);
  }
  assert.equal(isDroppedEquitySeries(PUMP_RADAR_SERIES_KEY, staleHistory().series[PUMP_RADAR_SERIES_KEY]), true);
  assert.equal(isDroppedEquitySeries(FORTS_ADR_STATIC_SERIES_KEY, staleHistory().series[FORTS_ADR_STATIC_SERIES_KEY]), true);
  assert.equal(isDroppedEquitySeries(ETH, staleHistory().series[ETH]), false);
});

test("stale feed + history: neither target surfaces; v6b1 and ETH stay; OG skips both", () => {
  const latest = staleLatest();
  const hist = staleHistory();
  const v6First = hist.series[V6].points[0].equity;
  const ethFirst = hist.series[ETH].points[0].equity;

  const cards = mergePortalAccounts(latest.accounts);
  for (const id of TARGETS) {
    assert.equal(cards.some((a) => a.bot_id === id || a.account_id === id), false, id);
    assert.equal(displayedBotIds(latest.accounts).includes(id), false, id);
    assert.equal(hasAuthoredPassport(id), false, id);
    const passport = getPassport(id);
    assert.equal(passport.hidden, true, id);
    assert.equal(passport.title, "");
  }
  assert.ok(cards.some((a) => a.bot_id === "v6b1"));
  assert.ok(cards.some((a) => a.bot_id === "eth_okx_moex"));

  const winner = pickOgWinner(latest, hist);
  assert.ok(winner);
  assert.doesNotMatch(winner.key, /pump_radar/);
  assert.doesNotMatch(winner.key, /forts_adr_static/);
  assert.equal(ogDescription(winner).includes("pump_radar"), false);
  assert.equal(ogDescription(winner).includes("+13,27"), false);
  assert.equal(ogDescription(winner).includes("forts_adr_static"), false);

  mergeLatestIntoHistory(hist, latest);
  assert.equal(hist.series[PUMP_RADAR_SERIES_KEY], undefined);
  assert.equal(hist.series[FORTS_ADR_STATIC_SERIES_KEY], undefined);
  assert.equal(hist.series[V6].points[0].equity, v6First);
  assert.equal(hist.series[ETH].points[0].equity, ethFirst);
});

test("direct hashes #/s/pump_radar and #/s/forts_adr_static are blocked", () => {
  for (const id of TARGETS) {
    assert.equal(isBlockedStrategyRoute(parsePortalHash(`#/s/${id}`)), true, id);
    assert.equal(isBlockedStrategyRoute(parsePortalHash(`#/s/${id.toUpperCase()}`)), true, id);
    assert.equal(isBlockedStrategyRoute(parsePortalHash(`#/s/${id}/`)), true, id);
  }
  assert.equal(isBlockedStrategyRoute(parsePortalHash("#/s/v6b1")), false);
  assert.equal(isBlockedStrategyRoute(parsePortalHash("#/s/eth_okx_moex")), false);
});

test("reintroduced bot_id on a later sync cannot recreate either series", () => {
  const hist = { series: {} };
  mergeLatestIntoHistory(hist, staleLatest());
  assert.equal(hist.series[PUMP_RADAR_SERIES_KEY], undefined);
  assert.equal(hist.series[FORTS_ADR_STATIC_SERIES_KEY], undefined);
  assert.ok(hist.series[V6]);
  assert.ok(hist.series[ETH]);
});

test("publisher sanitize drops both series even if accounts were already removed", () => {
  const latest = {
    generated_at: "2026-11-11T00:00:00Z",
    accounts: [
      { bot_id: "v6b1", account_id: "v6b1", equity: "10000" },
      { bot_id: "eth_okx_moex", account_id: "eth_okx_moex", equity: "308800" },
    ],
    manifest: [{ bot_id: "v6b1" }, { bot_id: "eth_okx_moex" }],
  };
  const hist = staleHistory();
  const v6Before = JSON.stringify(hist.series[V6]);
  const ethBefore = JSON.stringify(hist.series[ETH]);
  sanitizeCabinetSnapshot(latest, hist);
  assert.equal(hist.series[PUMP_RADAR_SERIES_KEY], undefined);
  assert.equal(hist.series[FORTS_ADR_STATIC_SERIES_KEY], undefined);
  assert.equal(JSON.stringify(hist.series[V6]), v6Before);
  assert.equal(JSON.stringify(hist.series[ETH]), ethBefore);
  assert.deepEqual(
    latest.accounts.map((a) => a.bot_id),
    ["v6b1", "eth_okx_moex"],
  );
});

test("sanitize of leftover accounts is byte-identical for neighbors", () => {
  const latest = staleLatest();
  const hist = staleHistory();
  const v6Acc = JSON.stringify(latest.accounts.find((a) => a.bot_id === "v6b1"));
  const ethAcc = JSON.stringify(latest.accounts.find((a) => a.bot_id === "eth_okx_moex"));
  const v6Ser = JSON.stringify(hist.series[V6]);
  const ethSer = JSON.stringify(hist.series[ETH]);
  sanitizeCabinetSnapshot(latest, hist);
  assert.equal(latest.accounts.some((a) => TARGETS.includes(a.bot_id)), false);
  assert.equal(JSON.stringify(latest.accounts.find((a) => a.bot_id === "v6b1")), v6Acc);
  assert.equal(JSON.stringify(latest.accounts.find((a) => a.bot_id === "eth_okx_moex")), ethAcc);
  assert.equal(JSON.stringify(hist.series[V6]), v6Ser);
  assert.equal(JSON.stringify(hist.series[ETH]), ethSer);
});

test("stale live JSON cache: fetchCabinetSnapshot never returns pump or static", async () => {
  const prev = globalThis.fetch;
  const live = EQUITY_LIVE_DATA_BASE;
  const latest = staleLatest();
  const hist = staleHistory();
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("latest.json")) return jsonResponse(latest);
    if (u.includes("history.json")) return jsonResponse(hist);
    if (u.includes("backtests.json")) return jsonResponse({ series: {} });
    return { ok: false, json: async () => null };
  };
  try {
    const snap = await fetchCabinetSnapshot("/", { liveBase: live });
    assert.equal(snap.ok, true);
    for (const id of TARGETS) {
      assert.equal(
        snap.latest.accounts.some((a) => a.bot_id === id || a.account_id === id),
        false,
        id,
      );
    }
    assert.equal(snap.history.series[PUMP_RADAR_SERIES_KEY], undefined);
    assert.equal(snap.history.series[FORTS_ADR_STATIC_SERIES_KEY], undefined);
    assert.ok(snap.latest.accounts.some((a) => a.bot_id === "v6b1"));
    assert.ok(snap.latest.accounts.some((a) => a.bot_id === "eth_okx_moex"));
    assert.ok(snap.history.series[V6]);
    assert.ok(snap.history.series[ETH]);
  } finally {
    globalThis.fetch = prev;
  }
});

test("tracked latest.json / history.json have no pump or static; ETH and v6b1 remain", () => {
  const latestText = readFileSync(join(root, "public/data/latest.json"), "utf8");
  const historyText = readFileSync(join(root, "public/data/history.json"), "utf8");
  for (const id of TARGETS) {
    assert.equal(latestText.includes(id), false, id);
    assert.equal(historyText.includes(id), false, id);
  }
  const latest = JSON.parse(latestText);
  const history = JSON.parse(historyText);
  assert.ok(latest.accounts.some((a) => a.bot_id === "v6b1"));
  assert.ok(latest.accounts.some((a) => a.bot_id === "eth_okx_moex"));
  assert.ok(history.series[V6]);
  assert.ok(history.series[ETH]);
  assert.equal(history.series[ETH].points.length > 0, true);
  assert.equal(history.series[PUMP_RADAR_SERIES_KEY], undefined);
  assert.equal(history.series[FORTS_ADR_STATIC_SERIES_KEY], undefined);
  dropHiddenFeedRows(latest);
  assert.equal(latest.accounts.some((a) => TARGETS.includes(a.bot_id)), false);
});

test("non-test UI modules do not render retired pump/static passport titles", () => {
  const srcDir = join(root, "src");
  const files = readdirSync(srcDir).filter((f) => /\.(js|jsx)$/.test(f) && !f.endsWith(".test.js"));
  for (const f of files) {
    const text = readFileSync(join(srcDir, f), "utf8");
    assert.doesNotMatch(text, /FORTS: фиксированный коридор/, f);
    assert.doesNotMatch(text, /Радар резких движений: лимитки ниже рынка/, f);
  }
  const index = readFileSync(join(root, "index.html"), "utf8");
  const share = readFileSync(join(root, "public/share.html"), "utf8");
  assert.doesNotMatch(index, /pump_radar/);
  assert.doesNotMatch(index, /forts_adr_static/);
  assert.doesNotMatch(share, /pump_radar/);
  assert.doesNotMatch(share, /forts_adr_static/);
});
