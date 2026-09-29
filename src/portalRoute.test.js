import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isBlockedStrategyRoute, parsePortalHash } from "./portalRoute.js";
import { getPassport, hasAuthoredPassport, passportUiStrings } from "./strategyPassport.js";
import { isHiddenPortalId, normalizePortalId } from "./strategyMeta.js";

test("hash #/s/grail_b20_3x is a blocked strategy route", () => {
  const route = parsePortalHash("#/s/grail_b20_3x");
  assert.equal(route.name, "strategy");
  assert.equal(route.botId, "grail_b20_3x");
  assert.equal(isBlockedStrategyRoute(route), true);
  assert.equal(isHiddenPortalId(route.botId), true);
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
