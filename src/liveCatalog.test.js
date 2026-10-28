import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LIVE_CATALOG,
  findLiveCatalogItem,
  indexLiveCatalog,
  isValidLiveId,
  liveCatalogByBot,
  liveCatalogIsEmpty,
} from "./liveCatalog.js";
import { PORTAL_SHELLS } from "./strategyMeta.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "..", "tests", "fixtures");
const TEST_CATALOG = JSON.parse(readFileSync(join(fixtures, "live-catalog.json"), "utf8"));

test("production LIVE catalog is empty and has no PAPER shells", () => {
  assert.equal(LIVE_CATALOG.length, 0);
  assert.equal(liveCatalogIsEmpty(), true);
  const paperIds = new Set(PORTAL_SHELLS.map((s) => `${s.bot_id}::${s.account_id}`));
  for (const item of LIVE_CATALOG) {
    assert.equal(paperIds.has(`${item.botId}::${item.accountId}`), false);
  }
});

test("LIVE ids reject empty, path, double-colon and control characters", () => {
  assert.equal(isValidLiveId("demo_live_bot"), true);
  assert.equal(isValidLiveId("pub-acct-1"), true);
  assert.equal(isValidLiveId(""), false);
  assert.equal(isValidLiveId("Demo"), false);
  assert.equal(isValidLiveId("a::b"), false);
  assert.equal(isValidLiveId("a/b"), false);
  assert.equal(isValidLiveId("a b"), false);
  assert.equal(isValidLiveId("a\nb"), false);
});

test("catalog index accepts a unique allowed account", () => {
  const indexed = indexLiveCatalog(TEST_CATALOG);
  assert.equal(indexed.ok, true);
  assert.equal(findLiveCatalogItem("demo_live_bot", "pub_acct_alpha", TEST_CATALOG)?.title, "Демо-робот LIVE");
  assert.equal(liveCatalogByBot("demo_live_bot", TEST_CATALOG).length, 1);
});

test("production modules do not import tests/fixtures", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)));
  for (const f of ["liveCatalog.js", "loadLiveFeed.js", "liveFeedValidate.js", "App.jsx"]) {
    const text = readFileSync(join(root, f), "utf8");
    assert.doesNotMatch(text, /tests\/fixtures/, f);
  }
});

test("catalog rejects duplicate pair and does not auto-add unknown PAPER robots", () => {
  const dup = [...TEST_CATALOG, { ...TEST_CATALOG[0] }];
  assert.equal(indexLiveCatalog(dup).ok, false);
  assert.equal(indexLiveCatalog(dup).reason, "catalog_duplicate");
  assert.equal(findLiveCatalogItem("unknown_paper", "unknown_paper", TEST_CATALOG), null);
  assert.equal(findLiveCatalogItem("v6b1", "v6b1", LIVE_CATALOG), null);
});
