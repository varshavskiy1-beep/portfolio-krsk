import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ROBOT2_ACCOUNT_ID,
  ROBOT2_BOT_ID,
  displayTitle,
  mergePortalAccounts,
  portalExcluded,
} from "./strategyMeta.js";

test("portalExcluded drops outdated live OKX mark for robot 2", () => {
  const excluded = [
    { id: "three_robots_finam_live", reason: "live Finam" },
    { id: ROBOT2_BOT_ID, reason: "live OKX" },
    { id: "three_robots_okx_spcx_btc_4h", reason: "live OKX" },
  ];
  const visible = portalExcluded(excluded);
  assert.deepEqual(
    visible.map((e) => e.id),
    ["three_robots_finam_live", "three_robots_okx_spcx_btc_4h"],
  );
});

test("mergePortalAccounts adds robot 2 shell when absent", () => {
  const merged = mergePortalAccounts([
    { bot_id: "v6b1", account_id: "v6b1", currency: "USDT", equity: "10000" },
  ]);
  const robot2 = merged.find((a) => a.bot_id === ROBOT2_BOT_ID);
  assert.ok(robot2);
  assert.equal(robot2.account_id, ROBOT2_ACCOUNT_ID);
  assert.equal(robot2.no_data, true);
  assert.equal(robot2.currency, "USD");
});

test("mergePortalAccounts keeps published paper account", () => {
  const published = {
    bot_id: ROBOT2_BOT_ID,
    account_id: ROBOT2_ACCOUNT_ID,
    currency: "USD",
    equity: "10000",
    seed: "10000",
    positions: [],
  };
  const merged = mergePortalAccounts([published]);
  assert.equal(merged.filter((a) => a.bot_id === ROBOT2_BOT_ID).length, 1);
  assert.equal(merged[0].no_data, undefined);
  assert.equal(merged[0].equity, "10000");
});

test("displayTitle maps robot 2 ids to human title", () => {
  assert.equal(displayTitle({ bot_id: ROBOT2_BOT_ID, account_id: ROBOT2_ACCOUNT_ID }), "Робот 2 · MSTR/TSLA/SPCX");
});
