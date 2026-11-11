/**
 * Retired forts_adr_adaptive: stale feed/cache and a direct hash must not
 * show the card, equity, %PnL, OG or passport. Other books stay intact.
 * The id remains only in exclusion lists and these tests.
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
  FORTS_ADR_ADAPTIVE_ACCOUNT_ID,
  FORTS_ADR_ADAPTIVE_BOT_ID,
  FORTS_ADR_ADAPTIVE_SERIES_KEY,
  HIDDEN_PORTAL_IDS,
  isHiddenPortalAccount,
  isHiddenPortalId,
  mergePortalAccounts,
} from "./strategyMeta.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = FORTS_ADR_ADAPTIVE_BOT_ID;
const ETH = "eth_okx_moex::eth_okx_moex";
const V6 = "v6b1::v6b1";

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
        bot_id: TARGET,
        account_id: TARGET,
        currency: "RUB",
        equity: "2249400",
        seed: "1500000",
        equity_curve: [
          { t: "2026-09-18T16:39:08Z", equity: "1500000" },
          { t: "2026-11-11T00:00:00Z", equity: "2249400" },
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
      { bot_id: TARGET, logic: "lookahead in entry hour" },
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
      [FORTS_ADR_ADAPTIVE_SERIES_KEY]: {
        bot_id: TARGET,
        account_id: TARGET,
        currency: "RUB",
        seed: 1500000,
        points: [
          { t: "2026-09-18T16:39:08Z", equity: 1500000 },
          { t: "2026-11-11T00:00:00Z", equity: 2249400 },
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

test("exclusion list names the retired adaptive ids", () => {
  assert.equal(HIDDEN_PORTAL_IDS.has(TARGET), true);
  assert.equal(HIDDEN_PORTAL_IDS.has(FORTS_ADR_ADAPTIVE_ACCOUNT_ID), true);
  assert.equal(isHiddenPortalId(TARGET), true);
  assert.equal(
    isHiddenPortalAccount({ bot_id: TARGET, account_id: TARGET }),
    true,
  );
  assert.equal(isDroppedEquitySeries(FORTS_ADR_ADAPTIVE_SERIES_KEY, staleHistory().series[FORTS_ADR_ADAPTIVE_SERIES_KEY]), true);
});

test("stale feed + history: card, chips, OG, passport and %PnL never surface; other books stay", () => {
  const latest = staleLatest();
  const hist = staleHistory();
  const v6First = hist.series[V6].points[0].equity;
  const ethFirst = hist.series[ETH].points[0].equity;

  const cards = mergePortalAccounts(latest.accounts);
  assert.equal(cards.some((a) => a.bot_id === TARGET || a.account_id === TARGET), false);
  assert.equal(displayedBotIds(latest.accounts).includes(TARGET), false);
  assert.ok(cards.some((a) => a.bot_id === "v6b1"));
  assert.ok(cards.some((a) => a.bot_id === "eth_okx_moex"));

  const winner = pickOgWinner(latest, hist);
  assert.ok(winner);
  assert.doesNotMatch(winner.key, /forts_adr_adaptive/);
  assert.equal(ogDescription(winner).includes(TARGET), false);
  assert.equal(ogDescription(winner).includes("+49,96"), false);

  assert.equal(hasAuthoredPassport(TARGET), false);
  const passport = getPassport(TARGET);
  assert.equal(passport.hidden, true);
  assert.equal(passport.title, "");

  mergeLatestIntoHistory(hist, latest);
  assert.equal(hist.series[FORTS_ADR_ADAPTIVE_SERIES_KEY], undefined);
  assert.equal(hist.series[V6].points[0].equity, v6First);
  assert.equal(hist.series[ETH].points[0].equity, ethFirst);
});

test("direct hash #/s/forts_adr_adaptive is blocked and does not keep the old result", () => {
  const route = parsePortalHash("#/s/forts_adr_adaptive");
  assert.equal(isBlockedStrategyRoute(route), true);
  assert.equal(isBlockedStrategyRoute(parsePortalHash("#/s/FORTS_ADR_ADAPTIVE")), true);
  assert.equal(isBlockedStrategyRoute(parsePortalHash("#/s/forts_adr_adaptive/")), true);
  assert.equal(isBlockedStrategyRoute(parsePortalHash("#/s/eth_okx_moex")), false);
  assert.equal(isBlockedStrategyRoute(parsePortalHash("#/s/v6b1")), false);
});

test("incoming bot_id on a later sync still cannot recreate the series", () => {
  const hist = { series: {} };
  mergeLatestIntoHistory(hist, staleLatest());
  assert.equal(hist.series[FORTS_ADR_ADAPTIVE_SERIES_KEY], undefined);
  assert.ok(hist.series[V6]);
  assert.ok(hist.series[ETH]);
});

test("publisher sanitize drops adaptive from gh-pages payloads and keeps other rows", () => {
  const latest = staleLatest();
  const hist = staleHistory();
  const ethAcc = JSON.stringify(latest.accounts.find((a) => a.bot_id === "eth_okx_moex"));
  const v6Acc = JSON.stringify(latest.accounts.find((a) => a.bot_id === "v6b1"));
  sanitizeCabinetSnapshot(latest, hist);
  assert.equal(latest.accounts.some((a) => a.bot_id === TARGET), false);
  assert.equal(latest.manifest.some((m) => m.bot_id === TARGET), false);
  assert.equal(hist.series[FORTS_ADR_ADAPTIVE_SERIES_KEY], undefined);
  assert.equal(JSON.stringify(latest.accounts.find((a) => a.bot_id === "eth_okx_moex")), ethAcc);
  assert.equal(JSON.stringify(latest.accounts.find((a) => a.bot_id === "v6b1")), v6Acc);
});

test("stale live JSON cache: fetchCabinetSnapshot never returns the retired account", async () => {
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
    assert.equal(
      snap.latest.accounts.some((a) => a.bot_id === TARGET || a.account_id === TARGET),
      false,
    );
    assert.equal(snap.history.series[FORTS_ADR_ADAPTIVE_SERIES_KEY], undefined);
    assert.ok(snap.latest.accounts.some((a) => a.bot_id === "v6b1"));
    assert.ok(snap.latest.accounts.some((a) => a.bot_id === "eth_okx_moex"));
    assert.ok(snap.history.series[V6]);
    assert.ok(snap.history.series[ETH]);
  } finally {
    globalThis.fetch = prev;
  }
});

test("tracked latest.json / history.json have no forts_adr_adaptive; other live books remain", () => {
  const latestText = readFileSync(join(root, "public/data/latest.json"), "utf8");
  const historyText = readFileSync(join(root, "public/data/history.json"), "utf8");
  assert.equal(latestText.includes(TARGET), false);
  assert.equal(historyText.includes(TARGET), false);
  const latest = JSON.parse(latestText);
  const history = JSON.parse(historyText);
  assert.ok(latest.accounts.some((a) => a.bot_id === "eth_okx_moex"));
  assert.ok(latest.accounts.some((a) => a.bot_id === "v6b1"));
  assert.ok(history.series[ETH]);
  assert.ok(history.series[V6]);
  assert.equal(history.series[FORTS_ADR_ADAPTIVE_SERIES_KEY], undefined);
  dropHiddenFeedRows(latest);
  assert.equal(latest.accounts.some((a) => a.bot_id === TARGET), false);
});

test("non-test UI modules do not render the retired adaptive title", () => {
  const srcDir = join(root, "src");
  const files = readdirSync(srcDir).filter((f) => /\.(js|jsx)$/.test(f) && !f.endsWith(".test.js"));
  for (const f of files) {
    const text = readFileSync(join(srcDir, f), "utf8");
    assert.doesNotMatch(text, /FORTS: сам выбирает ширину коридора/, f);
  }
  const index = readFileSync(join(root, "index.html"), "utf8");
  const share = readFileSync(join(root, "public/share.html"), "utf8");
  assert.doesNotMatch(index, /forts_adr_adaptive/);
  assert.doesNotMatch(share, /forts_adr_adaptive/);
});
