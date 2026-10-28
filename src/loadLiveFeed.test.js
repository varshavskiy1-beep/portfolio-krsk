import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EQUITY_LIVE_DATA_BASE } from "./equityLiveData.js";
import { fetchCabinetSnapshot } from "./loadFeed.js";
import {
  fetchLiveSnapshot,
  loadLiveMode,
  parseLiveDataBase,
  readLiveDataBase,
} from "./loadLiveFeed.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "..", "tests", "fixtures");
const catalog = JSON.parse(readFileSync(join(fixtures, "live-catalog.json"), "utf8"));
const latestValid = JSON.parse(readFileSync(join(fixtures, "live-latest.valid.json"), "utf8"));
const historyValid = JSON.parse(readFileSync(join(fixtures, "live-history.valid.json"), "utf8"));
const latestEmpty = JSON.parse(readFileSync(join(fixtures, "live-latest.empty.json"), "utf8"));
const historyEmpty = JSON.parse(readFileSync(join(fixtures, "live-history.empty.json"), "utf8"));

const LIVE_BASE = "https://live-fixtures.test/";

function jsonResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => {
      if (typeof body === "function") return body();
      return body;
    },
  };
}

function installFetch(handler) {
  const prev = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = prev;
  };
}

test("LIVE base must be absolute HTTPS without credentials, query or fragment", () => {
  assert.equal(parseLiveDataBase("https://live-fixtures.test/data").ok, true);
  assert.equal(parseLiveDataBase("https://live-fixtures.test").base, "https://live-fixtures.test/");
  assert.equal(parseLiveDataBase("").reason, "live_base_empty");
  assert.equal(parseLiveDataBase("/data/live").reason, "live_base_invalid");
  assert.equal(parseLiveDataBase("javascript:alert(1)").reason, "live_base_invalid");
  assert.equal(parseLiveDataBase("http://live-fixtures.test").reason, "live_base_not_https");
  assert.equal(parseLiveDataBase("https://user:pass@live-fixtures.test").reason, "live_base_credentials");
  assert.equal(parseLiveDataBase("https://live-fixtures.test/?x=1").reason, "live_base_query");
  assert.equal(parseLiveDataBase("https://live-fixtures.test/#x").reason, "live_base_fragment");
});

test("unset LIVE base does not fetch and is an honest empty section", async () => {
  const calls = [];
  const restore = installFetch(async (url) => {
    calls.push(String(url));
    return jsonResponse({});
  });
  try {
    const unset = readLiveDataBase("");
    assert.equal(unset.configured, false);
    const loaded = await loadLiveMode("", { fetchImpl: globalThis.fetch, catalog });
    assert.equal(loaded.configured, false);
    assert.equal(loaded.ok, true);
    assert.equal(calls.length, 0);
  } finally {
    restore();
  }
});

test("LIVE never requests the PAPER equity base or bundled /data fallback", async () => {
  const calls = [];
  const restore = installFetch(async (url) => {
    calls.push(String(url));
    return { ok: false, status: 404, json: async () => null };
  });
  try {
    const snap = await fetchLiveSnapshot(LIVE_BASE, { catalog, fetchImpl: globalThis.fetch });
    assert.equal(snap.ok, false);
    assert.equal(snap.reason, "http");
    assert.ok(calls.every((u) => u.startsWith(LIVE_BASE) && u.includes("/data/live/")));
    assert.ok(calls.every((u) => !u.startsWith(EQUITY_LIVE_DATA_BASE)));
    assert.ok(calls.every((u) => !u.includes("/data/latest.json") || u.includes("/data/live/")));
  } finally {
    restore();
  }
});

test("HTTP 404, 500, rejected fetch and broken JSON fail without applying", async () => {
  const cases = [
    { handler: async () => ({ ok: false, status: 404, json: async () => null }), reason: "http" },
    { handler: async () => ({ ok: false, status: 500, json: async () => null }), reason: "http" },
    { handler: async () => { throw new TypeError("network"); }, reason: "fetch" },
    {
      handler: async () => ({
        ok: true,
        json: async () => {
          throw new SyntaxError("Unexpected end of JSON input");
        },
      }),
      reason: "json",
    },
  ];
  for (const c of cases) {
    const snap = await fetchLiveSnapshot(LIVE_BASE, { catalog, fetchImpl: c.handler });
    assert.equal(snap.ok, false, c.reason);
    assert.equal(snap.reason, c.reason);
  }
});

test("AbortError is rethrown and not recorded as a snapshot", async () => {
  const err = new Error("aborted");
  err.name = "AbortError";
  await assert.rejects(
    () =>
      fetchLiveSnapshot(LIVE_BASE, {
        catalog,
        fetchImpl: async () => {
          throw err;
        },
      }),
    (e) => e && e.name === "AbortError",
  );
});

test("successful pair load; snapshot mismatch retries once then rejects", async () => {
  let n = 0;
  const mismatched = { ...historyValid, snapshot_id: "other" };
  const fetchImpl = async (url) => {
    n += 1;
    const u = String(url);
    if (u.includes("latest.json")) return jsonResponse(latestValid);
    if (n <= 2) return jsonResponse(mismatched);
    return jsonResponse(historyValid);
  };
  const first = await fetchLiveSnapshot(LIVE_BASE, {
    catalog,
    fetchImpl,
    nowMs: Date.parse("2026-10-28T04:01:00Z"),
  });
  assert.equal(first.ok, true);
  assert.equal(first.latest.snapshot_id, "live-snap-001");
  assert.ok(n >= 4);

  n = 0;
  const alwaysMismatch = async (url) => {
    n += 1;
    return jsonResponse(String(url).includes("latest.json") ? latestValid : mismatched);
  };
  const fail = await fetchLiveSnapshot(LIVE_BASE, {
    catalog,
    fetchImpl: alwaysMismatch,
    nowMs: Date.parse("2026-10-28T04:01:00Z"),
  });
  assert.equal(fail.ok, false);
  assert.equal(fail.reason, "snapshot_mismatch");
  assert.equal(n, 4);
});

test("empty configured feed is a valid empty LIVE snapshot", async () => {
  const fetchImpl = async (url) => {
    const u = String(url);
    if (u.includes("latest.json")) return jsonResponse(latestEmpty);
    return jsonResponse(historyEmpty);
  };
  const snap = await fetchLiveSnapshot(LIVE_BASE, {
    catalog: [],
    fetchImpl,
    nowMs: Date.parse("2026-10-28T04:01:00Z"),
  });
  assert.equal(snap.ok, true);
  assert.deepEqual(snap.latest.accounts, []);
});

test("future generated_at is a clock error, not a fresh snapshot", async () => {
  const fetchImpl = async (url) =>
    jsonResponse(String(url).includes("latest.json") ? latestValid : historyValid);
  const snap = await fetchLiveSnapshot(LIVE_BASE, {
    catalog,
    fetchImpl,
    nowMs: Date.parse("2026-10-28T03:50:00Z"),
  });
  assert.equal(snap.ok, false);
  assert.equal(snap.reason, "generated_at_future");
});

test("PAPER loader still uses Pages then bundled fallback; LIVE is unused", async () => {
  const calls = [];
  const restore = installFetch(async (url) => {
    calls.push(String(url));
    const u = String(url);
    if (u.startsWith(EQUITY_LIVE_DATA_BASE)) return { ok: false, status: 503, json: async () => null };
    if (u.includes("latest.json")) {
      return jsonResponse({
        generated_at: "2026-10-17T10:00:00Z",
        accounts: [{ bot_id: "v6b1", account_id: "v6b1", currency: "USD", seed: "10000", equity: "10000" }],
      });
    }
    return jsonResponse({ series: {} });
  });
  try {
    const snap = await fetchCabinetSnapshot("/", { liveBase: EQUITY_LIVE_DATA_BASE });
    assert.equal(snap.ok, true);
    assert.ok(calls.some((c) => c.startsWith(EQUITY_LIVE_DATA_BASE)));
    assert.ok(calls.some((c) => c === "/data/latest.json"));
    assert.ok(calls.every((c) => !c.includes("/data/live/")));
  } finally {
    restore();
  }
});

test("slow then aborted LIVE fetch does not apply after leave", async () => {
  const ctrl = new AbortController();
  let released;
  const blocked = new Promise((resolve) => {
    released = resolve;
  });
  const fetchImpl = async (url, init) => {
    if (init?.signal?.aborted) {
      const e = new Error("aborted");
      e.name = "AbortError";
      throw e;
    }
    await blocked;
    if (init?.signal?.aborted) {
      const e = new Error("aborted");
      e.name = "AbortError";
      throw e;
    }
    return jsonResponse(String(url).includes("latest.json") ? latestValid : historyValid);
  };
  const pending = fetchLiveSnapshot(LIVE_BASE, {
    catalog,
    fetchImpl,
    signal: ctrl.signal,
    nowMs: Date.parse("2026-10-28T04:01:00Z"),
  });
  ctrl.abort();
  released();
  await assert.rejects(pending, (e) => e && e.name === "AbortError");
});
