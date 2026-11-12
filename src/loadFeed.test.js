import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { cnyMomFromStartPctLine } from "./cnyMomCard.js";
import { resolveEquityPoints } from "./equityChartModel.js";
import { EQUITY_LIVE_DATA_BASE } from "./equityLiveData.js";
import { FEED_SOURCE_FALLBACK, FEED_SOURCE_LIVE, isGeneratedAtStale } from "./feedValidate.js";
import { fetchCabinetSnapshot } from "./loadFeed.js";

const LIVE = EQUITY_LIVE_DATA_BASE;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const VALID_LATEST = {
  generated_at: "2026-10-17T10:00:00Z",
  accounts: [{ bot_id: "v6b1", account_id: "v6b1", currency: "USD", seed: "10000", equity: "10000" }],
};

function jsonResponse(body, ok = true) {
  return {
    ok,
    json: async () => {
      if (typeof body === "function") return body();
      return body;
    },
  };
}

test("P01/P07: a bad latest.json is not applied; valid accounts still load", async () => {
  const prev = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("latest.json")) return jsonResponse({ accounts: [null] });
    if (u.includes("history.json")) return jsonResponse({ series: {} });
    if (u.includes("backtests.json")) return jsonResponse({ series: {} });
    return { ok: false, json: async () => null };
  };
  try {
    const bad = await fetchCabinetSnapshot("/", { liveBase: LIVE });
    assert.equal(bad.ok, false);
  } finally {
    globalThis.fetch = prev;
  }

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("latest.json")) {
      return jsonResponse(VALID_LATEST);
    }
    if (u.includes("history.json")) return jsonResponse({ series: {} });
    if (u.includes("backtests.json")) return jsonResponse({ series: {} });
    return { ok: false, json: async () => null };
  };
  try {
    const ok = await fetchCabinetSnapshot("/", { liveBase: LIVE });
    assert.equal(ok.ok, true);
    assert.equal(ok.latest.accounts[0].bot_id, "v6b1");
    assert.equal(ok.latest.accounts[0].currency, "USDT");
    assert.ok(Number.isFinite(ok.fetchedAt));
  } finally {
    globalThis.fetch = prev;
  }
});

test("P01: broken history JSON rejects the whole snapshot", async () => {
  const prev = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("latest.json")) {
      return jsonResponse({
        accounts: [{ bot_id: "v6b1", account_id: "v6b1" }],
      });
    }
    if (u.includes("history.json")) {
      return {
        ok: true,
        json: async () => {
          throw new SyntaxError("Unexpected end of JSON input");
        },
      };
    }
    return jsonResponse({ series: {} });
  };
  try {
    const snap = await fetchCabinetSnapshot("/", { liveBase: LIVE });
    assert.equal(snap.ok, false);
  } finally {
    globalThis.fetch = prev;
  }
});

test("live equity JSON: success from Pages base", async () => {
  const prev = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    assert.equal(init?.cache, "no-store");
    const u = String(url);
    if (u.startsWith(LIVE) && u.includes("data/latest.json")) {
      assert.match(u, /\?t=\d+$/);
      return jsonResponse(VALID_LATEST);
    }
    if (u.startsWith(LIVE) && u.includes("data/history.json")) {
      return jsonResponse({ series: {} });
    }
    if (u.includes("backtests.json") && !u.startsWith(LIVE)) {
      return jsonResponse({ series: {} });
    }
    return { ok: false, status: 404, json: async () => null };
  };
  try {
    const snap = await fetchCabinetSnapshot("/app/", { liveBase: LIVE });
    assert.equal(snap.ok, true);
    assert.equal(snap.source, FEED_SOURCE_LIVE);
    assert.ok(calls.some((c) => c.startsWith(LIVE) && c.includes("latest.json")));
    assert.ok(calls.some((c) => c === "/app/data/backtests.json"));
    assert.equal(calls.some((c) => c === "/app/data/latest.json"), false);
  } finally {
    globalThis.fetch = prev;
  }
});

test("live equity JSON: live fail falls back to bundled /data", async () => {
  const prev = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.startsWith(LIVE)) {
      return { ok: false, status: 503, json: async () => null };
    }
    if (u === "/data/latest.json") return jsonResponse(VALID_LATEST);
    if (u === "/data/history.json") return jsonResponse({ series: {} });
    if (u === "/data/backtests.json") return jsonResponse({ series: {} });
    return { ok: false, json: async () => null };
  };
  try {
    const snap = await fetchCabinetSnapshot("/", { liveBase: LIVE });
    assert.equal(snap.ok, true);
    assert.equal(snap.source, FEED_SOURCE_FALLBACK);
    assert.equal(snap.latest.accounts[0].bot_id, "v6b1");
  } finally {
    globalThis.fetch = prev;
  }
});

test("stale Pages latest with forts_adr_adaptive is stripped; other accounts stay", async () => {
  const prev = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("latest.json")) {
      return jsonResponse({
        generated_at: "2026-11-11T00:00:00Z",
        accounts: [
          { bot_id: "v6b1", account_id: "v6b1", currency: "USD", seed: "10000", equity: "10000" },
          {
            bot_id: "forts_adr_adaptive",
            account_id: "forts_adr_adaptive",
            currency: "RUB",
            seed: "1500000",
            equity: "2249400",
          },
          { bot_id: "eth_okx_moex", account_id: "eth_okx_moex", currency: "RUB", seed: "300000", equity: "308800" },
        ],
      });
    }
    if (u.includes("history.json")) {
      return jsonResponse({
        series: {
          "v6b1::v6b1": { bot_id: "v6b1", account_id: "v6b1", points: [{ t: "2026-10-15T17:27:12Z", equity: 10000 }] },
          "forts_adr_adaptive::forts_adr_adaptive": {
            bot_id: "forts_adr_adaptive",
            account_id: "forts_adr_adaptive",
            points: [{ t: "2026-11-11T00:00:00Z", equity: 2249400 }],
          },
          "eth_okx_moex::eth_okx_moex": {
            bot_id: "eth_okx_moex",
            account_id: "eth_okx_moex",
            points: [{ t: "2026-10-13T00:00:00Z", equity: 308800 }],
          },
        },
      });
    }
    if (u.includes("backtests.json")) return jsonResponse({ series: {} });
    return { ok: false, json: async () => null };
  };
  try {
    const snap = await fetchCabinetSnapshot("/", { liveBase: LIVE });
    assert.equal(snap.ok, true);
    assert.deepEqual(
      snap.latest.accounts.map((a) => a.bot_id),
      ["v6b1", "eth_okx_moex"],
    );
    assert.equal(snap.history.series["forts_adr_adaptive::forts_adr_adaptive"], undefined);
    assert.equal(snap.history.series["v6b1::v6b1"].points[0].equity, 10000);
    assert.equal(snap.history.series["eth_okx_moex::eth_okx_moex"].points[0].equity, 308800);
  } finally {
    globalThis.fetch = prev;
  }
});


function abortOnSignal(init) {
  return new Promise((_, reject) => {
    const fail = () => {
      const e = new Error("aborted");
      e.name = "AbortError";
      reject(e);
    };
    if (init?.signal?.aborted) {
      fail();
      return;
    }
    init?.signal?.addEventListener("abort", fail, { once: true });
  });
}

test("hung live github.io times out and uses bundled fallback, tagged fallback", async () => {
  const prev = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.startsWith(LIVE)) return abortOnSignal(init);
    if (u === "/data/latest.json") {
      return jsonResponse({
        generated_at: "2026-10-24T06:13:05Z",
        accounts: [{ bot_id: "v6b1", account_id: "v6b1", currency: "USDT", seed: "10000", equity: "10365" }],
      });
    }
    if (u === "/data/history.json") return jsonResponse({ series: {} });
    if (u === "/data/backtests.json") return jsonResponse({ series: {} });
    return { ok: false, json: async () => null };
  };
  try {
    const snap = await fetchCabinetSnapshot("/", { liveBase: LIVE, liveTimeoutMs: 40 });
    assert.equal(snap.ok, true);
    assert.equal(snap.source, FEED_SOURCE_FALLBACK);
    assert.equal(snap.latest.generated_at, "2026-10-24T06:13:05Z");
    assert.equal(isGeneratedAtStale(snap.latest.generated_at, Date.parse("2026-11-12T05:10:00Z")), true);
  } finally {
    globalThis.fetch = prev;
  }
});

test("hung CDN body after headers still times out; not painted as live", async () => {
  const prev = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.startsWith(LIVE)) {
      return {
        ok: true,
        json: () => abortOnSignal(init),
      };
    }
    if (u === "/data/latest.json") {
      return jsonResponse({
        generated_at: "2026-10-24T06:13:05Z",
        accounts: [{ bot_id: "v6b1", account_id: "v6b1", currency: "USDT", seed: "10000", equity: "10365" }],
      });
    }
    if (u === "/data/history.json") return jsonResponse({ series: {} });
    if (u === "/data/backtests.json") return jsonResponse({ series: {} });
    return { ok: false, json: async () => null };
  };
  try {
    const snap = await fetchCabinetSnapshot("/", { liveBase: LIVE, liveTimeoutMs: 40 });
    assert.equal(snap.ok, true);
    assert.equal(snap.source, FEED_SOURCE_FALLBACK);
    assert.notEqual(snap.source, FEED_SOURCE_LIVE);
    assert.equal(snap.latest.generated_at, "2026-10-24T06:13:05Z");
  } finally {
    globalThis.fetch = prev;
  }
});

test("hung same-origin equity-live still uses github.io when it answers", async () => {
  const prev = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes("equity-live/")) return abortOnSignal(init);
    if (u.startsWith(LIVE) && u.includes("latest.json")) {
      return jsonResponse({
        generated_at: "2026-11-12T05:03:37Z",
        accounts: [{ bot_id: "v6b1", account_id: "v6b1", currency: "USDT", seed: "10000", equity: "10112" }],
      });
    }
    if (u.startsWith(LIVE) && u.includes("history.json")) {
      return jsonResponse({ series: { "v6b1::v6b1": { bot_id: "v6b1", account_id: "v6b1", points: [] } } });
    }
    if (u.includes("backtests.json")) return jsonResponse({ series: {} });
    return { ok: false, json: async () => null };
  };
  try {
    const snap = await fetchCabinetSnapshot("/", { liveBase: LIVE, liveTimeoutMs: 40 });
    assert.equal(snap.ok, true);
    assert.equal(snap.source, FEED_SOURCE_LIVE);
    assert.equal(snap.latest.generated_at, "2026-11-12T05:03:37Z");
  } finally {
    globalThis.fetch = prev;
  }
});

test("hung equity-live and hung github.io both 8s-class timeouts then tagged fallback", async () => {
  const prev = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes("equity-live/") || u.startsWith(LIVE)) return abortOnSignal(init);
    if (u === "/data/latest.json") {
      return jsonResponse({
        generated_at: "2026-10-24T06:13:05Z",
        accounts: [{ bot_id: "v6b1", account_id: "v6b1", currency: "USDT", seed: "10000", equity: "10365" }],
      });
    }
    if (u === "/data/history.json") return jsonResponse({ series: {} });
    if (u === "/data/backtests.json") return jsonResponse({ series: {} });
    return { ok: false, json: async () => null };
  };
  try {
    const snap = await fetchCabinetSnapshot("/", { liveBase: LIVE, liveTimeoutMs: 40 });
    assert.equal(snap.ok, true);
    assert.equal(snap.source, FEED_SOURCE_FALLBACK);
    assert.equal(snap.latest.generated_at, "2026-10-24T06:13:05Z");
  } finally {
    globalThis.fetch = prev;
  }
});

test("blocked live CDN uses tagged fallback, not a quiet Oct 24 live frame", async () => {
  const prev = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.startsWith(LIVE)) throw new TypeError("Failed to fetch");
    if (u === "/data/latest.json") {
      return jsonResponse({
        generated_at: "2026-10-24T06:13:05Z",
        accounts: [
          { bot_id: "v6b1", account_id: "v6b1", currency: "USDT", seed: "10000", equity: "10365" },
          {
            bot_id: "cny_mom_h360",
            account_id: "cny_mom_h360",
            currency: "RUB",
            seed: "300000",
            equity: "335539.3734402401",
            updated_utc: "2026-10-24T05:21:02Z",
            as_of: "2026-10-24",
            history: [{ t: "2026-10-24", equity: "335539.3734402401" }],
          },
        ],
      });
    }
    if (u === "/data/history.json") {
      return jsonResponse({
        series: {
          "cny_mom_h360::cny_mom_h360": {
            bot_id: "cny_mom_h360",
            account_id: "cny_mom_h360",
            points: [{ t: "2026-10-24T05:21:02Z", equity: 335539.3734402401 }],
          },
        },
      });
    }
    if (u === "/data/backtests.json") return jsonResponse({ series: {} });
    return { ok: false, json: async () => null };
  };
  try {
    const snap = await fetchCabinetSnapshot("/", { liveBase: LIVE });
    assert.equal(snap.ok, true);
    assert.equal(snap.source, FEED_SOURCE_FALLBACK);
    assert.equal(snap.latest.generated_at, "2026-10-24T06:13:05Z");
    const cny = snap.latest.accounts.find((a) => a.bot_id === "cny_mom_h360");
    assert.equal(cny.no_data, true);
    assert.equal(cny.equity, null);
    assert.equal(cnyMomFromStartPctLine(cny), "");
    assert.deepEqual(resolveEquityPoints(cny, snap.history), []);
    assert.equal(snap.latest.accounts.find((a) => a.bot_id === "v6b1").equity, "10365");
  } finally {
    globalThis.fetch = prev;
  }
});

test("live latest with failed live history does not mix Nov equity with Oct curves", async () => {
  const prev = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.startsWith(LIVE) && u.includes("latest.json")) {
      return jsonResponse({
        generated_at: "2026-11-12T05:03:37Z",
        accounts: [
          {
            bot_id: "cny_mom_h360",
            account_id: "cny_mom_h360",
            currency: "RUB",
            seed: "300000",
            equity: "318428.04",
            history_mode: "replace",
            generation: "cny-journal-capital-v1",
            history: [{ t: "2026-10-23T08:00:00", equity: "332497.77" }],
          },
        ],
      });
    }
    if (u.startsWith(LIVE) && u.includes("history.json")) {
      return { ok: false, status: 503, json: async () => null };
    }
    if (u === "/data/latest.json") {
      return jsonResponse({
        generated_at: "2026-10-24T06:13:05Z",
        accounts: [
          {
            bot_id: "cny_mom_h360",
            account_id: "cny_mom_h360",
            currency: "RUB",
            seed: "300000",
            equity: "335539.3734402401",
            updated_utc: "2026-10-24T05:21:02Z",
            as_of: "2026-10-24",
            history: [{ t: "2026-10-24", equity: "335539.3734402401" }],
          },
        ],
      });
    }
    if (u === "/data/history.json") {
      return jsonResponse({
        series: {
          "cny_mom_h360::cny_mom_h360": {
            bot_id: "cny_mom_h360",
            account_id: "cny_mom_h360",
            points: [{ t: "2026-10-24T05:21:02Z", equity: 335539.3734402401 }],
          },
        },
      });
    }
    if (u.includes("backtests.json")) return jsonResponse({ series: {} });
    return { ok: false, json: async () => null };
  };
  try {
    const snap = await fetchCabinetSnapshot("/", { liveBase: LIVE });
    assert.equal(snap.ok, true);
    assert.equal(snap.source, FEED_SOURCE_FALLBACK);
    assert.equal(snap.latest.generated_at, "2026-10-24T06:13:05Z");
    const cny = snap.latest.accounts.find((a) => a.bot_id === "cny_mom_h360");
    assert.notEqual(Number(cny.equity), 318428.04);
    assert.equal(cny.no_data, true);
  } finally {
    globalThis.fetch = prev;
  }
});

test("same-origin equity-live pair is used when github.io is blocked", async () => {
  const prev = globalThis.fetch;
  const extract = JSON.parse(
    readFileSync(join(root, "src/fixtures/cny_mom_h360_host_account_extract.json"), "utf8"),
  );
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.startsWith(LIVE)) throw new TypeError("Failed to fetch");
    if (u.includes("equity-live/data/latest.json")) {
      return jsonResponse({
        generated_at: "2026-11-12T05:03:37Z",
        accounts: [
          { bot_id: "v6b1", account_id: "v6b1", currency: "USDT", seed: "10000", equity: "10112.25605731400" },
          { ...extract.account, history: extract.history, equity_curve: extract.equity_curve },
        ],
      });
    }
    if (u.includes("equity-live/data/history.json")) {
      return jsonResponse({
        series: {
          "v6b1::v6b1": {
            bot_id: "v6b1",
            account_id: "v6b1",
            points: [{ t: "2026-11-08T11:03:21Z", equity: 10112.256057314 }],
          },
          "cny_mom_h360::cny_mom_h360": {
            bot_id: "cny_mom_h360",
            account_id: "cny_mom_h360",
            points: Array.from({ length: 570 }, (_, i) => ({
              t: i === 0 ? "2026-10-12T11:07:00Z" : `2026-10-13T00:00:00Z`,
              equity: i === 569 ? 318428.04 : 300000,
            })),
          },
        },
      });
    }
    if (u.includes("backtests.json")) return jsonResponse({ series: {} });
    if (u === "/data/latest.json") {
      return jsonResponse({
        generated_at: "2026-10-24T06:13:05Z",
        accounts: [{ bot_id: "v6b1", account_id: "v6b1", equity: "10365" }],
      });
    }
    return { ok: false, json: async () => null };
  };
  try {
    const snap = await fetchCabinetSnapshot("/", { liveBase: LIVE });
    assert.equal(snap.ok, true);
    assert.equal(snap.source, FEED_SOURCE_LIVE);
    assert.equal(snap.latest.generated_at, "2026-11-12T05:03:37Z");
    const cny = snap.latest.accounts.find((a) => a.bot_id === "cny_mom_h360");
    assert.equal(Number(cny.equity), 318428.04);
    assert.equal(cnyMomFromStartPctLine(cny), "+6,14% от старта");
    const pts = resolveEquityPoints(cny, snap.history);
    assert.equal(pts[0].t, "2026-10-12T11:07:00Z");
    assert.equal(Number(pts[0].equity), 300000);
    assert.ok(pts.length > 479);
    assert.equal(pts.at(-1).t, "2026-11-12T06:00:00");
    assert.ok(pts.every((p) => Number(p.equity) !== 335539.3734402401));
    assert.notEqual(snap.latest.generated_at, "2026-10-24T06:13:05Z");
  } finally {
    globalThis.fetch = prev;
  }
});

test("CDN fallback of stale bundled CNY is нет данных; other accounts stay", async () => {
  const prev = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.startsWith(LIVE)) return { ok: false, status: 503, json: async () => null };
    if (u === "/data/latest.json") {
      return jsonResponse({
        generated_at: "2026-10-24T06:13:05Z",
        accounts: [
          { bot_id: "v6b1", account_id: "v6b1", currency: "USD", seed: "10000", equity: "10000" },
          {
            bot_id: "cny_mom_h360",
            account_id: "cny_mom_h360",
            currency: "RUB",
            seed: "300000",
            equity: "335539.3734402401",
            updated_utc: "2026-10-24T05:21:02Z",
            as_of: "2026-10-24",
            history: [{ t: "2026-10-24", equity: "335539.3734402401" }],
          },
          { bot_id: "eth_okx_moex", account_id: "eth_okx_moex", currency: "RUB", seed: "300000", equity: "308800" },
        ],
      });
    }
    if (u === "/data/history.json") {
      return jsonResponse({
        series: {
          "v6b1::v6b1": { bot_id: "v6b1", account_id: "v6b1", points: [{ t: "2026-10-15T17:27:12Z", equity: 10000 }] },
          "cny_mom_h360::cny_mom_h360": {
            bot_id: "cny_mom_h360",
            account_id: "cny_mom_h360",
            points: [
              { t: "2026-10-12T11:07:00Z", equity: 300000 },
              { t: "2026-10-24T05:21:02Z", equity: 335539.3734402401 },
            ],
          },
          "eth_okx_moex::eth_okx_moex": {
            bot_id: "eth_okx_moex",
            account_id: "eth_okx_moex",
            points: [{ t: "2026-10-13T00:00:00Z", equity: 308800 }],
          },
        },
      });
    }
    if (u.includes("backtests.json")) return jsonResponse({ series: {} });
    return { ok: false, json: async () => null };
  };
  try {
    const snap = await fetchCabinetSnapshot("/", { liveBase: LIVE });
    assert.equal(snap.ok, true);
    assert.equal(snap.source, FEED_SOURCE_FALLBACK);
    const cny = snap.latest.accounts.find((a) => a.bot_id === "cny_mom_h360");
    assert.equal(cny.no_data, true);
    assert.equal(cny.equity, null);
    assert.equal(snap.history.series["cny_mom_h360::cny_mom_h360"], undefined);
    assert.deepEqual(
      snap.latest.accounts.filter((a) => a.bot_id !== "cny_mom_h360").map((a) => a.bot_id),
      ["v6b1", "eth_okx_moex"],
    );
    assert.equal(snap.latest.accounts.find((a) => a.bot_id === "v6b1").equity, "10000");
    assert.equal(snap.history.series["v6b1::v6b1"].points[0].equity, 10000);
    assert.equal(snap.history.series["eth_okx_moex::eth_okx_moex"].points[0].equity, 308800);
  } finally {
    globalThis.fetch = prev;
  }
});

test("fallback snapshot still hides retired paper_block2", async () => {
  const prev = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.startsWith(LIVE)) return { ok: false, status: 503, json: async () => null };
    if (u === "/data/latest.json") {
      return jsonResponse({
        generated_at: "2026-10-24T06:13:05Z",
        accounts: [
          { bot_id: "v6b1", account_id: "v6b1", currency: "USDT", seed: "10000", equity: "10365" },
          {
            bot_id: "three_robots_okx_nasdaq_1h",
            account_id: "paper_block2",
            currency: "USDT",
            seed: "10000",
            equity: "10306",
          },
        ],
      });
    }
    if (u === "/data/history.json") {
      return jsonResponse({
        series: {
          "three_robots_okx_nasdaq_1h::paper_block2": {
            bot_id: "three_robots_okx_nasdaq_1h",
            account_id: "paper_block2",
            points: [{ t: "2026-10-15T08:57:31Z", equity: 10000 }],
          },
        },
      });
    }
    if (u === "/data/backtests.json") return jsonResponse({ series: {} });
    return { ok: false, json: async () => null };
  };
  try {
    const snap = await fetchCabinetSnapshot("/", { liveBase: LIVE });
    assert.equal(snap.ok, true);
    assert.equal(snap.source, FEED_SOURCE_FALLBACK);
    assert.equal(snap.latest.accounts.some((a) => a.account_id === "paper_block2"), false);
    assert.equal(snap.history.series["three_robots_okx_nasdaq_1h::paper_block2"], undefined);
  } finally {
    globalThis.fetch = prev;
  }
});

test("live Pages CNY replace 479 is used; polluted 570 Oct12 series is not stitched", async () => {
  const extract = JSON.parse(readFileSync(join(root, "src/fixtures/cny_mom_h360_host_account_extract.json"), "utf8"));
  const prev = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.startsWith(LIVE) && u.includes("latest.json")) {
      return jsonResponse({
        generated_at: "2026-11-12T05:03:37Z",
        accounts: [
          { bot_id: "v6b1", account_id: "v6b1", currency: "USDT", seed: "10000", equity: "10112.25605731400" },
          { ...extract.account, history: extract.history, equity_curve: extract.equity_curve },
          { bot_id: "eth_okx_moex", account_id: "eth_okx_moex", currency: "RUB", seed: "300000", equity: "302889.836190622" },
        ],
      });
    }
    if (u.startsWith(LIVE) && u.includes("history.json")) {
      return jsonResponse({
        series: {
          "v6b1::v6b1": {
            bot_id: "v6b1",
            account_id: "v6b1",
            points: [{ t: "2026-10-15T17:27:12Z", equity: 10000 }, { t: "2026-11-08T11:03:21Z", equity: 10112.256057314 }],
          },
          "cny_mom_h360::cny_mom_h360": {
            bot_id: "cny_mom_h360",
            account_id: "cny_mom_h360",
            points: [
              { t: "2026-10-12T11:07:00Z", equity: 300000 },
              ...Array.from({ length: 568 }, (_, i) => ({ t: `2026-10-13T${String(i % 10).padStart(2, "0")}:00:00Z`, equity: 300100 + i })),
              { t: "2026-11-12T04:21:01Z", equity: 318428.04 },
            ],
          },
          "eth_okx_moex::eth_okx_moex": {
            bot_id: "eth_okx_moex",
            account_id: "eth_okx_moex",
            points: [{ t: "2026-11-10T13:00:00", equity: 299970.06 }, { t: "2026-11-12T07:00:00", equity: 302889.84 }],
          },
        },
      });
    }
    if (u.includes("backtests.json")) return jsonResponse({ series: {} });
    return { ok: false, json: async () => null };
  };
  try {
    const snap = await fetchCabinetSnapshot("/", { liveBase: LIVE });
    assert.equal(snap.ok, true);
    assert.equal(snap.source, FEED_SOURCE_LIVE);
    assert.equal(snap.latest.generated_at, "2026-11-12T05:03:37Z");
    const cny = snap.latest.accounts.find((a) => a.bot_id === "cny_mom_h360");
    assert.equal(Number(cny.equity), 318428.04);
    assert.equal(cnyMomFromStartPctLine(cny), "+6,14% от старта");
    const pts = resolveEquityPoints(cny, snap.history);
    assert.equal(pts[0].t, "2026-10-12T11:07:00Z");
    assert.equal(Number(pts[0].equity), 300000);
    const canonAt = pts.findIndex((p) => p.t === "2026-10-23T08:00:00");
    assert.equal(canonAt, 198);
    assert.equal(pts.length, 198 + 479);
    assert.equal(Number(pts[canonAt].equity), 332497.77);
    assert.equal(pts.at(-1).t, "2026-11-12T06:00:00");
    assert.ok(pts.every((p) => Number(p.equity) !== 335539.3734402401));
    assert.equal(snap.latest.accounts.find((a) => a.bot_id === "v6b1").equity, "10112.25605731400");
    assert.equal(snap.history.series["v6b1::v6b1"].points.at(-1).equity, 10112.256057314);
    assert.equal(snap.history.series["eth_okx_moex::eth_okx_moex"].points.at(-1).equity, 302889.84);
  } finally {
    globalThis.fetch = prev;
  }
});

test("live equity JSON: both live and fallback fail → ok:false", async () => {
  const prev = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError("network down");
  };
  try {
    const snap = await fetchCabinetSnapshot("/", { liveBase: LIVE });
    assert.equal(snap.ok, false);
    assert.equal(snap.reason, "fetch");
  } finally {
    globalThis.fetch = prev;
  }
});

test("bundled same-origin fallback is the Oct 24 snapshot the user screenshot matched", () => {
  const latest = JSON.parse(readFileSync(join(root, "public/data/latest.json"), "utf8"));
  assert.equal(latest.generated_at, "2026-10-24T06:13:05Z");
  const cny = latest.accounts.find((a) => a.bot_id === "cny_mom_h360");
  const cycle = latest.accounts.find((a) => a.bot_id === "rf_bonds_rate_cycle");
  const mayak = latest.accounts.find((a) => a.bot_id === "mayak_imoex_lowvol10");
  assert.equal(Number(cny.equity), 335539.3734402401);
  assert.equal(cny.updated_utc, "2026-10-24T05:21:02Z");
  assert.equal(Number(cycle.equity), 300932.048);
  assert.equal(cycle.updated_utc, "2026-10-24T01:01:34Z");
  assert.equal(cycle.as_of, "2026-10-23");
  assert.equal(Number(mayak.equity), 301898.55348306044);
  assert.equal(mayak.updated_utc, "2026-10-23T16:26:40Z");
  assert.equal(mayak.as_of, "2026-10-22");
  assert.equal(latest.accounts.some((a) => a.account_id === "paper_block2"), true);
});
