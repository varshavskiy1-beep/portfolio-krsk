import assert from "node:assert/strict";
import { test } from "node:test";
import { EQUITY_LIVE_DATA_BASE } from "./equityLiveData.js";
import { fetchCabinetSnapshot } from "./loadFeed.js";

const LIVE = EQUITY_LIVE_DATA_BASE;
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
    assert.ok(calls.some((c) => c.startsWith(LIVE) && c.includes("latest.json")));
    assert.ok(calls.some((c) => c === "/app/data/backtests.json"));
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
          { bot_id: "forts_adr_static", account_id: "forts_adr_static", currency: "RUB", seed: "1500000", equity: "1520000" },
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
          "forts_adr_static::forts_adr_static": {
            bot_id: "forts_adr_static",
            account_id: "forts_adr_static",
            points: [{ t: "2026-09-19T03:56:37Z", equity: 1520000 }],
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
      ["v6b1", "forts_adr_static"],
    );
    assert.equal(snap.history.series["forts_adr_adaptive::forts_adr_adaptive"], undefined);
    assert.equal(snap.history.series["v6b1::v6b1"].points[0].equity, 10000);
    assert.equal(snap.history.series["forts_adr_static::forts_adr_static"].points[0].equity, 1520000);
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
