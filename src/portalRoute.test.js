import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalizePortalRoute,
  homeHash,
  isBlockedStrategyRoute,
  parsePortalHash,
  strategyHash,
} from "./portalRoute.js";
import { getPassport, hasAuthoredPassport, passportUiStrings } from "./strategyPassport.js";
import { isHiddenPortalId, normalizePortalId } from "./strategyMeta.js";

test("hash #/s/grail_b20_3x is a blocked strategy route", () => {
  const route = parsePortalHash("#/s/grail_b20_3x");
  assert.equal(route.name, "strategy");
  assert.equal(route.mode, "paper");
  assert.equal(route.botId, "grail_b20_3x");
  assert.equal(route.legacy, true);
  assert.equal(isBlockedStrategyRoute(route), true);
  assert.equal(isHiddenPortalId(route.botId), true);
});

test("hash #/s/three_robots_okx_nasdaq_1h is a blocked strategy route", () => {
  const route = parsePortalHash("#/s/three_robots_okx_nasdaq_1h");
  assert.equal(route.name, "strategy");
  assert.equal(route.botId, "three_robots_okx_nasdaq_1h");
  assert.equal(isBlockedStrategyRoute(route), true);
  assert.equal(isHiddenPortalId("three_robots_okx_nasdaq_1h"), true);
  assert.equal(isHiddenPortalId("paper_block2"), true);
  assert.equal(isBlockedStrategyRoute(parsePortalHash("#/s/paper_block2")), true);
});

test("hidden id is recognized after decode, case and trailing junk", () => {
  assert.equal(isHiddenPortalId("GRAIL_B20_3X"), true);
  assert.equal(isHiddenPortalId("grail_b20_3x/"), true);
  assert.equal(isHiddenPortalId("grail_b20_3x?x=1"), true);
  assert.equal(isHiddenPortalId(normalizePortalId("grail%5Fb20%5F3x")), true);
  assert.equal(isBlockedStrategyRoute(parsePortalHash("#/s/GRAIL_B20_3X")), true);
  assert.equal(isBlockedStrategyRoute(parsePortalHash("#s/grail_b20_3x/")), true);
  assert.equal(isBlockedStrategyRoute(parsePortalHash("#/s/v6b1")), false);
});

test("blocked hash has no authored passport and no Grail title", () => {
  assert.equal(hasAuthoredPassport("grail_b20_3x"), false);
  const p = getPassport("grail_b20_3x", "не должен попасть в UI");
  assert.equal(p.hidden, true);
  assert.equal(p.authored, false);
  assert.equal(p.title, "");
  assert.doesNotMatch(p.title, /Grail B20/);
  for (const s of passportUiStrings("grail_b20_3x")) {
    assert.doesNotMatch(s, /Grail B20/);
    assert.doesNotMatch(s, /\bGrail\b/);
  }
});

test("source UI modules have no Grail B20 copy that can render", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)));
  const files = readdirSync(root).filter(
    (f) => /\.(js|jsx)$/.test(f) && !f.endsWith(".test.js"),
  );
  for (const f of files) {
    const text = readFileSync(join(root, f), "utf8");
    assert.doesNotMatch(text, /Grail B20/, f);
    assert.doesNotMatch(text, /Grail B20 · плечо 3×/, f);
  }
});

test("empty hash and slashes open PAPER home", () => {
  for (const hash of ["", "#", "#/", "#//"]) {
    const route = parsePortalHash(hash);
    assert.deepEqual(route, { name: "home", mode: "paper" }, hash);
  }
});

test("mode home routes", () => {
  assert.deepEqual(parsePortalHash("#/paper"), { name: "home", mode: "paper" });
  assert.deepEqual(parsePortalHash("#/live"), { name: "home", mode: "live" });
  assert.deepEqual(parsePortalHash("#paper"), { name: "home", mode: "paper" });
  assert.deepEqual(parsePortalHash("#/live/"), { name: "home", mode: "live" });
});

test("mode strategy routes and encoded bot id", () => {
  assert.deepEqual(parsePortalHash("#/paper/s/v6b1"), {
    name: "strategy",
    mode: "paper",
    botId: "v6b1",
  });
  assert.deepEqual(parsePortalHash("#/live/s/demo_live_bot"), {
    name: "strategy",
    mode: "live",
    botId: "demo_live_bot",
  });
  const encoded = parsePortalHash("#/paper/s/foo%5Fbar");
  assert.equal(encoded.name, "strategy");
  assert.equal(encoded.mode, "paper");
  assert.equal(encoded.botId, "foo_bar");
});

test("legacy #/s/<id> is PAPER and canonicalize uses replaceState", () => {
  const route = parsePortalHash("#/s/v6b1");
  assert.equal(route.name, "strategy");
  assert.equal(route.mode, "paper");
  assert.equal(route.botId, "v6b1");
  assert.equal(route.legacy, true);

  const calls = [];
  const historyApi = {
    state: { keep: 1 },
    replaceState(state, title, url) {
      calls.push({ state, title, url });
    },
  };
  const next = canonicalizePortalRoute(route, historyApi, {
    pathname: "/",
    search: "",
  });
  assert.deepEqual(next, { name: "strategy", mode: "paper", botId: "v6b1" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/#/paper/s/v6b1");
  assert.deepEqual(calls[0].state, { keep: 1 });
});

test("unknown mode, broken URI and extra segments are notFound and never open LIVE data", () => {
  const cases = [
    parsePortalHash("#/foo"),
    parsePortalHash("#/LIVE"),
    parsePortalHash("#/paper/s/%E0%A4%A"),
    parsePortalHash("#/live/s/%E0%A4%A"),
    parsePortalHash("#/paper/s/v6b1/extra"),
    parsePortalHash("#/live/oops"),
    parsePortalHash("#/s/v6b1/extra"),
    parsePortalHash("#/paper/live"),
  ];
  for (const route of cases) {
    assert.equal(route.name, "notFound", JSON.stringify(route));
    assert.notEqual(route.name, "home");
    if (route.mode === "live") {
      assert.equal(route.name, "notFound");
    }
  }
  assert.equal(parsePortalHash("#/foo").mode, "paper");
  assert.equal(parsePortalHash("#/LIVE").mode, "paper");
  assert.equal(parsePortalHash("#/live/oops").mode, "live");
  assert.equal(parsePortalHash("#/paper/s/%E0%A4%A").mode, "paper");
});

test("invalid address does not become a LIVE home or LIVE strategy", () => {
  const bad = [
    "#/unknown",
    "#/s/",
    "#/live/s/",
    "#/paper/s/",
    "#/live/strategy/v6b1",
  ];
  for (const hash of bad) {
    const route = parsePortalHash(hash);
    assert.notEqual(route.name, "home");
    assert.notEqual(`${route.name}:${route.mode}`, "home:live");
    if (route.name === "strategy") {
      assert.equal(route.mode, "paper");
    }
  }
});

test("hash helpers encode mode and bot id", () => {
  assert.equal(homeHash("paper"), "#/paper");
  assert.equal(homeHash("live"), "#/live");
  assert.equal(strategyHash("live", "demo_live_bot"), "#/live/s/demo_live_bot");
  assert.equal(strategyHash("paper", "a/b"), "#/paper/s/a%2Fb");
});

test("hidden PAPER id is not a blocked LIVE route", () => {
  const liveHidden = parsePortalHash("#/live/s/grail_b20_3x");
  assert.equal(liveHidden.name, "strategy");
  assert.equal(liveHidden.mode, "live");
  assert.equal(isBlockedStrategyRoute(liveHidden), false);
});
