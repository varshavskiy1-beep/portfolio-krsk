import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchCabinetSnapshot } from "./loadFeed.js";

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
    const bad = await fetchCabinetSnapshot("/");
    assert.equal(bad.ok, false);
  } finally {
    globalThis.fetch = prev;
  }

  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("latest.json")) {
      return jsonResponse({
        generated_at: "2026-10-17T10:00:00Z",
        accounts: [{ bot_id: "v6b1", account_id: "v6b1", currency: "USD", seed: "10000", equity: "10000" }],
      });
    }
    if (u.includes("history.json")) return jsonResponse({ series: {} });
    if (u.includes("backtests.json")) return jsonResponse({ series: {} });
    return { ok: false, json: async () => null };
  };
  try {
    const ok = await fetchCabinetSnapshot("/");
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
    const snap = await fetchCabinetSnapshot("/");
    assert.equal(snap.ok, false);
  } finally {
    globalThis.fetch = prev;
  }
});
