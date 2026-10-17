import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HISTORY_RESETS,
  PAPER_BLOCK2_RESET_FROM,
  PAPER_BLOCK2_RESET_LINE,
  PAPER_BLOCK2_SERIES_KEY,
  RATE_CYCLE_RESET_EQUITY,
  RATE_CYCLE_RESET_FROM,
  RATE_CYCLE_SERIES_KEY,
  V6B1_RESET_FROM,
  V6B1_SERIES_KEY,
  applyHistoryResets,
  filterResetPoints,
  historyResetLine,
  isBeforeReset,
  robot2ResetLine,
  shouldAppendHistoryPoint,
} from "./historyReset.js";

const OLD = [
  { t: "2026-09-21T14:11:01Z", equity: 10000 },
  { t: "2026-10-14T19:09:46Z", equity: 8475.67 },
  { t: "2026-10-15T08:57:31Z", equity: 10000 },
];

const V6B1_OLD = [
  { t: "2026-09-19T03:58:23Z", equity: 9994 },
  { t: "2026-10-15T15:02:44Z", equity: 8106.48 },
  { t: "2026-10-15T17:27:12Z", equity: 10000 },
];

test("paper_block2 cutoff drops points before reset_from and keeps the reset snapshot", () => {
  const kept = filterResetPoints(PAPER_BLOCK2_SERIES_KEY, OLD);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].t, PAPER_BLOCK2_RESET_FROM);
  assert.equal(kept[0].equity, 10000);
  assert.equal(isBeforeReset("2026-10-14T19:09:46Z", PAPER_BLOCK2_RESET_FROM), true);
  assert.equal(isBeforeReset(PAPER_BLOCK2_RESET_FROM, PAPER_BLOCK2_RESET_FROM), false);
});

test("v6b1 cutoff drops pre-reset all-cash book and keeps 10000", () => {
  const kept = filterResetPoints(V6B1_SERIES_KEY, V6B1_OLD);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].t, V6B1_RESET_FROM);
  assert.equal(kept[0].equity, 10000);
  assert.equal(isBeforeReset("2026-10-15T15:02:44Z", V6B1_RESET_FROM), true);
  assert.equal(isBeforeReset(V6B1_RESET_FROM, V6B1_RESET_FROM), false);
});

test("applyHistoryResets removes old paper_block2 and v6b1 trade and seeds 10000 if empty", () => {
  const hist = {
    series: {
      [PAPER_BLOCK2_SERIES_KEY]: {
        bot_id: "three_robots_okx_nasdaq_1h",
        account_id: "paper_block2",
        currency: "USDT",
        seed: 10000,
        points: OLD,
      },
      [V6B1_SERIES_KEY]: {
        bot_id: "v6b1",
        account_id: "v6b1",
        currency: "USDT",
        seed: 10000,
        points: V6B1_OLD,
      },
      "young_bounce_combo::young_bounce_combo": {
        bot_id: "young_bounce_combo",
        account_id: "young_bounce_combo",
        points: [{ t: "2026-01-01", equity: 9000 }],
      },
    },
  };
  const report = applyHistoryResets(hist);
  const robot2 = report.find((r) => r.key === PAPER_BLOCK2_SERIES_KEY);
  assert.equal(robot2.removed, 2);
  assert.equal(robot2.kept, 1);
  assert.deepEqual(hist.series[PAPER_BLOCK2_SERIES_KEY].points, [
    { t: PAPER_BLOCK2_RESET_FROM, equity: 10000 },
  ]);
  const v6 = report.find((r) => r.key === V6B1_SERIES_KEY);
  assert.equal(v6.removed, 2);
  assert.equal(v6.kept, 1);
  assert.deepEqual(hist.series[V6B1_SERIES_KEY].points, [
    { t: V6B1_RESET_FROM, equity: 10000 },
  ]);
  assert.equal(hist.series["young_bounce_combo::young_bounce_combo"].points.length, 1);
  assert.equal(hist.series["young_bounce_combo::young_bounce_combo"].points[0].equity, 9000);

  const empty = { series: { [PAPER_BLOCK2_SERIES_KEY]: { points: [] } } };
  applyHistoryResets(empty);
  assert.equal(empty.series[PAPER_BLOCK2_SERIES_KEY].points[0].equity, 10000);
  assert.equal(String(empty.series[PAPER_BLOCK2_SERIES_KEY].points[0].t).slice(0, 10), "2026-10-15");
  assert.equal(empty.series[V6B1_SERIES_KEY].points[0].equity, 10000);
  assert.equal(empty.series[V6B1_SERIES_KEY].points[0].t, V6B1_RESET_FROM);
});

test("sync must not append points earlier than reset_from", () => {
  assert.equal(shouldAppendHistoryPoint(PAPER_BLOCK2_SERIES_KEY, "2026-10-14T19:09:46Z"), false);
  assert.equal(shouldAppendHistoryPoint(PAPER_BLOCK2_SERIES_KEY, PAPER_BLOCK2_RESET_FROM), true);
  assert.equal(shouldAppendHistoryPoint(PAPER_BLOCK2_SERIES_KEY, "2026-10-15T09:10:00Z"), true);
  assert.equal(shouldAppendHistoryPoint(V6B1_SERIES_KEY, "2026-10-15T15:02:44Z"), false);
  assert.equal(shouldAppendHistoryPoint(V6B1_SERIES_KEY, V6B1_RESET_FROM), true);
  assert.equal(shouldAppendHistoryPoint(V6B1_SERIES_KEY, "2026-10-15T17:40:00Z"), true);
  assert.equal(shouldAppendHistoryPoint("young_bounce_combo::young_bounce_combo", "2026-01-01T00:00:00Z"), true);
});

test("reset caption shows while the new book has one calendar day", () => {
  const acc = { bot_id: "three_robots_okx_nasdaq_1h", account_id: "paper_block2" };
  assert.equal(robot2ResetLine(acc, OLD), PAPER_BLOCK2_RESET_LINE);
  assert.equal(
    robot2ResetLine(acc, [{ t: "2026-10-15T08:57:31Z", equity: 10000 }]),
    PAPER_BLOCK2_RESET_LINE,
  );
  assert.equal(
    robot2ResetLine(acc, [
      { t: "2026-10-15T08:57:31Z", equity: 10000 },
      { t: "2026-10-16T09:00:00Z", equity: 10010 },
    ]),
    "",
  );
  assert.equal(robot2ResetLine({ bot_id: "cny_mom_h360", account_id: "cny_mom_h360" }, OLD), "");
  assert.equal(
    robot2ResetLine({ bot_id: "three_robots_okx_nasdaq_1h", account_id: "paper_block1" }, OLD),
    "",
  );

  const v6 = { bot_id: "v6b1", account_id: "v6b1" };
  assert.equal(historyResetLine(v6, V6B1_OLD), PAPER_BLOCK2_RESET_LINE);
  assert.equal(
    historyResetLine(v6, [
      { t: V6B1_RESET_FROM, equity: 10000 },
      { t: "2026-10-16T09:00:00Z", equity: 10010 },
    ]),
    "",
  );
  assert.equal(historyResetLine({ bot_id: "young_bounce_combo", account_id: "young_bounce_combo" }, V6B1_OLD), "");
});

test("HISTORY_RESETS lists paper_block2, v6b1 and rate-cycle", () => {
  assert.deepEqual(
    Object.keys(HISTORY_RESETS).sort(),
    [PAPER_BLOCK2_SERIES_KEY, RATE_CYCLE_SERIES_KEY, V6B1_SERIES_KEY].sort(),
  );
});

test("rf_bonds_rate_cycle cutoff drops wealth-index 2.44 and keeps the first ruble print", () => {
  const mixed = [
    { t: "2026-10-09T09:37:15Z", equity: 2.441925306087005 },
    { t: RATE_CYCLE_RESET_FROM, equity: RATE_CYCLE_RESET_EQUITY },
    { t: "2026-10-17T01:01:54Z", equity: 300909.56 },
  ];
  const kept = filterResetPoints(RATE_CYCLE_SERIES_KEY, mixed);
  assert.equal(kept.length, 2);
  assert.equal(kept[0].t, RATE_CYCLE_RESET_FROM);
  assert.equal(kept[0].equity, 300000);
  assert.equal(kept.every((p) => p.equity > 1000), true);
  assert.equal(isBeforeReset("2026-10-09T09:37:15Z", RATE_CYCLE_RESET_FROM), true);
  assert.equal(isBeforeReset(RATE_CYCLE_RESET_FROM, RATE_CYCLE_RESET_FROM), false);
  assert.equal(shouldAppendHistoryPoint(RATE_CYCLE_SERIES_KEY, "2026-10-09T09:37:15Z"), false);
  assert.equal(shouldAppendHistoryPoint(RATE_CYCLE_SERIES_KEY, RATE_CYCLE_RESET_FROM), true);

  const hist = {
    series: {
      [RATE_CYCLE_SERIES_KEY]: {
        bot_id: "rf_bonds_rate_cycle",
        account_id: "rf_bonds_rate_cycle",
        points: mixed,
      },
    },
  };
  applyHistoryResets(hist);
  assert.equal(hist.series[RATE_CYCLE_SERIES_KEY].points[0].equity, 300000);
  assert.equal(
    hist.series[RATE_CYCLE_SERIES_KEY].points.some((p) => p.equity < 10),
    false,
  );
});
