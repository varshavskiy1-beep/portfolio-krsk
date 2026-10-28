import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accountMatchesQuery,
  catalogCurrencies,
  filterPortalAccounts,
  modeSummaryCounts,
} from "./portalFilters.js";
import { emptyFilters, filtersAfterModeChange } from "./portalMode.js";

const accounts = [
  { bot_id: "v6b1", title: "Волатильность", currency: "USDT" },
  { bot_id: "forts_adr_adaptive", title: "FORTS ADR", currency: "RUB" },
  { bot_id: "demo_live_bot", title: "Демо-робот LIVE", currency: "USDT" },
];
const accessors = {
  titleOf: (a) => a.title,
  currencyOf: (a) => a.currency,
};

test("empty query and surrounding spaces keep every account", () => {
  assert.equal(accountMatchesQuery(accounts[0], "", accessors.titleOf), true);
  assert.equal(accountMatchesQuery(accounts[0], "   ", accessors.titleOf), true);
  assert.equal(filterPortalAccounts(accounts, { query: "  " }, accessors).length, 3);
});

test("search is case-insensitive on title and bot_id", () => {
  assert.equal(filterPortalAccounts(accounts, { query: "ВОЛАТ" }, accessors).map((a) => a.bot_id).join(), "v6b1");
  assert.equal(filterPortalAccounts(accounts, { query: "V6B1" }, accessors).map((a) => a.bot_id).join(), "v6b1");
  assert.equal(filterPortalAccounts(accounts, { query: "нет такого" }, accessors).length, 0);
});

test("search combines with currency and summary counts stay full-mode", () => {
  const summary = modeSummaryCounts(accounts);
  assert.deepEqual(summary, { bots: 3, accounts: 3 });
  assert.deepEqual(catalogCurrencies(accounts, accessors.currencyOf), ["USDT", "RUB"]);
  const filtered = filterPortalAccounts(accounts, { query: "демо", currency: "USDT" }, accessors);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].bot_id, "demo_live_bot");
  const none = filterPortalAccounts(accounts, { query: "демо", currency: "RUB" }, accessors);
  assert.equal(none.length, 0);
});

test("mode change clears search and currency", () => {
  const next = filtersAfterModeChange("paper", "live", { query: "v6", currency: "RUB" });
  assert.deepEqual(next, emptyFilters());
});
