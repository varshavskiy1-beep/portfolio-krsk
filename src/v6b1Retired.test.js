/**
 * Retired v6b1 (KILL paper-log honest retest 2026-11-23):
 * stale feed/cache and a direct hash must not show the card, equity, %PnL,
 * OG or passport. Other books stay intact. Ids remain only in exclusion lists
 * and these tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
import { pickOgWinner } from "./ogWinner.js";
import { isBlockedStrategyRoute, parsePortalHash } from "./portalRoute.js";
import {
  displayedBotIds,
  getPassport,
  hasAuthoredPassport,
} from "./strategyPassport.js";
import {
  HIDDEN_PORTAL_IDS,
  V6B1_ACCOUNT_ID,
  V6B1_BOT_ID,
  isHiddenPortalAccount,
  isHiddenPortalId,
  mergePortalAccounts,
} from "./strategyMeta.js";
import { V6B1_SERIES_KEY } from "./historyReset.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ETH = "eth_okx_moex::eth_okx_moex";
const TARGET = V6B1_BOT_ID;

function jsonResponse(body, ok = true) {
  return {
    ok,
    json: async () => body,
  };
}

function staleLatest() {
  return {
    generated_at: "2026-11-23T08:00:00Z",
    accounts: [
      {
        bot_id: V6B1_BOT_ID,
        account_id: V6B1_ACCOUNT_ID,
        currency: "USDT",
        equity: "10112.25605731400",
        seed: "10000",
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
      { bot_id: V6B1_BOT_ID, logic: "retired" },
      { bot_id: "eth_okx_moex", logic: "ok" },
    ],
  };
}

function staleHistory() {
  return {
    schema: "equity_history.v1",
    updated_at: "2026-11-23T08:00:00Z",
    series: {
      [V6B1_SERIES_KEY]: {
        bot_id: V6B1_BOT_ID,
        account_id: V6B1_ACCOUNT_ID,
        currency: "USDT",
        seed: 10000,
        points: [
          { t: "2026-10-15T17:27:12Z", equity: 10000 },
          { t: "2026-11-23T07:03:08Z", equity: 10112.256057314 },
        ],
      },
      [ETH]: {
        bot_id: "eth_okx_moex",
        account_id: "eth_okx_moex",
        currency: "RUB",
        seed: 300000,
        points: [{ t: "2026-10-13T00:00:00Z", equity: 308800.21 }],
      },
    },
  };
}

test("exclusion list names retired v6b1 bot and account id", () => {
  assert.equal(HIDDEN_PORTAL_IDS.has(V6B1_BOT_ID), true);
  assert.equal(HIDDEN_PORTAL_IDS.has(V6B1_ACCOUNT_ID), true);
  assert.equal(isHiddenPortalId(V6B1_BOT_ID), true);
  assert.equal(isHiddenPortalId("V6B1"), true);
  assert.equal(
    isHiddenPortalAccount({ bot_id: V6B1_BOT_ID, account_id: V6B1_ACCOUNT_ID }),
    true,
  );
  assert.equal(
    isDroppedEquitySeries(V6B1_SERIES_KEY, staleHistory().series[V6B1_SERIES_KEY]),
    true,
  );
  assert.equal(isDroppedEquitySeries(ETH, staleHistory().series[ETH]), false);
});

test("stale feed + history: v6b1 card/OG/passport gone; ETH stays", () => {
  const latest = staleLatest();
  const hist = staleHistory();
  const ethFirst = hist.series[ETH].points[0].equity;

  sanitizeCabinetSnapshot(latest, hist);
  dropHiddenFeedRows(latest);

  const cards = mergePortalAccounts(latest.accounts);
  assert.equal(cards.some((a) => a.bot_id === TARGET || a.account_id === TARGET), false);
  assert.equal(displayedBotIds(latest.accounts).includes(TARGET), false);
  assert.ok(cards.some((a) => a.bot_id === "eth_okx_moex"));
  assert.equal(hist.series[V6B1_SERIES_KEY], undefined);
  assert.equal(hist.series[ETH].points[0].equity, ethFirst);

  const winner = pickOgWinner(cards, hist);
  if (winner?.account) {
    assert.notEqual(winner.account.bot_id, TARGET);
  }

  assert.equal(hasAuthoredPassport(TARGET), false);
  const stub = getPassport(TARGET);
  assert.equal(stub.hidden, true);
  assert.equal(stub.authored, false);
});

test("direct hash #/s/v6b1 is blocked", () => {
  assert.equal(isBlockedStrategyRoute(parsePortalHash("#/s/v6b1")), true);
  assert.equal(isBlockedStrategyRoute(parsePortalHash("#/s/V6B1")), true);
  assert.equal(isBlockedStrategyRoute(parsePortalHash("#/s/v6b1/")), true);
  assert.equal(isBlockedStrategyRoute(parsePortalHash("#/s/eth_okx_moex")), false);
});

test("incoming bot_id on a later sync still cannot recreate the series", () => {
  const hist = { schema: "equity_history.v1", series: {} };
  mergeLatestIntoHistory(hist, staleLatest());
  assert.equal(hist.series[V6B1_SERIES_KEY], undefined);
  assert.ok(hist.series[ETH]);
});

test("publisher sanitize drops v6b1 from gh-pages payloads and keeps ETH", () => {
  const latest = staleLatest();
  const hist = staleHistory();
  const ethAcc = JSON.stringify(latest.accounts.find((a) => a.bot_id === "eth_okx_moex"));
  sanitizeCabinetSnapshot(latest, hist);
  assert.equal(latest.accounts.some((a) => a.bot_id === TARGET), false);
  assert.equal(latest.manifest.some((m) => m.bot_id === TARGET), false);
  assert.equal(hist.series[V6B1_SERIES_KEY], undefined);
  assert.equal(JSON.stringify(latest.accounts.find((a) => a.bot_id === "eth_okx_moex")), ethAcc);
});

test("stale live JSON cache: fetchCabinetSnapshot never returns v6b1", async () => {
  const prev = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes("latest.json") || u.startsWith(EQUITY_LIVE_DATA_BASE)) {
        if (u.includes("history")) return jsonResponse(staleHistory());
        return jsonResponse(staleLatest());
      }
      if (u.includes("history.json")) return jsonResponse(staleHistory());
      return jsonResponse({}, false);
    };
    const snap = await fetchCabinetSnapshot();
    assert.equal(snap.latest.accounts.some((a) => a.bot_id === TARGET), false);
    assert.equal(snap.history.series[V6B1_SERIES_KEY], undefined);
    assert.ok(snap.latest.accounts.some((a) => a.bot_id === "eth_okx_moex"));
    assert.ok(snap.history.series[ETH]);
  } finally {
    globalThis.fetch = prev;
  }
});

test("tracked latest.json / history.json have no v6b1; ETH remains", () => {
  const latestText = readFileSync(join(root, "public/data/latest.json"), "utf8");
  const historyText = readFileSync(join(root, "public/data/history.json"), "utf8");
  assert.equal(latestText.includes('"bot_id": "v6b1"'), false);
  assert.equal(historyText.includes('"v6b1::v6b1"'), false);
  const latest = JSON.parse(latestText);
  const history = JSON.parse(historyText);
  assert.ok(latest.accounts.some((a) => a.bot_id === "eth_okx_moex"));
  assert.ok(history.series[ETH]);
  assert.equal(history.series[V6B1_SERIES_KEY], undefined);
  dropHiddenFeedRows(latest);
  assert.equal(latest.accounts.some((a) => a.bot_id === TARGET), false);
});
