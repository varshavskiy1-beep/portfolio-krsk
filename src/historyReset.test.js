import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HISTORY_RESETS,
  PAPER_BLOCK2_RESET_FROM,
  PAPER_BLOCK2_RESET_LINE,
  PAPER_BLOCK2_SERIES_KEY,
  applyHistoryResets,
  filterResetPoints,
  isBeforeReset,
  robot2ResetLine,
  shouldAppendHistoryPoint,
} from "./historyReset.js";

const OLD = [
  { t: "2026-09-21T14:11:01Z", equity: 10000 },
  { t: "2026-10-14T19:09:46Z", equity: 8475.67 },
  { t: "2026-10-15T08:57:31Z", equity: 10000 },
];

test("paper_block2 cutoff drops points before reset_from and keeps the reset snapshot", () => {
  const kept = filterResetPoints(PAPER_BLOCK2_SERIES_KEY, OLD);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].t, PAPER_BLOCK2_RESET_FROM);
  assert.equal(kept[0].equity, 10000);
  assert.equal(isBeforeReset("2026-10-14T19:09:46Z", PAPER_BLOCK2_RESET_FROM), true);
  assert.equal(isBeforeReset(PAPER_BLOCK2_RESET_FROM, PAPER_BLOCK2_RESET_FROM), false);
});

test("applyHistoryResets removes old paper_block2 trade and seeds 10000 if empty", () => {
  const hist = {
    series: {
      [PAPER_BLOCK2_SERIES_KEY]: {
        bot_id: "three_robots_okx_nasdaq_1h",
        account_id: "paper_block2",
        currency: "USDT",
        seed: 10000,
        points: OLD,
      },
      "v6b1::v6b1": {
        bot_id: "v6b1",
        account_id: "v6b1",
        points: [{ t: "2026-01-01", equity: 9000 }],
      },
    },
  };
  const report = applyHistoryResets(hist);
  const row = report.find((r) => r.key === PAPER_BLOCK2_SERIES_KEY);
  assert.equal(row.removed, 2);
  assert.equal(row.kept, 1);
  assert.deepEqual(hist.series[PAPER_BLOCK2_SERIES_KEY].points, [
    { t: PAPER_BLOCK2_RESET_FROM, equity: 10000 },
  ]);
  assert.equal(hist.series["v6b1::v6b1"].points.length, 1);
  assert.equal(hist.series["v6b1::v6b1"].points[0].equity, 9000);

  const empty = { series: { [PAPER_BLOCK2_SERIES_KEY]: { points: [] } } };
  applyHistoryResets(empty);
  assert.equal(empty.series[PAPER_BLOCK2_SERIES_KEY].points[0].equity, 10000);
  assert.equal(String(empty.series[PAPER_BLOCK2_SERIES_KEY].points[0].t).slice(0, 10), "2026-10-15");
});

test("sync must not append points earlier than reset_from", () => {
  assert.equal(shouldAppendHistoryPoint(PAPER_BLOCK2_SERIES_KEY, "2026-10-14T19:09:46Z"), false);
  assert.equal(shouldAppendHistoryPoint(PAPER_BLOCK2_SERIES_KEY, PAPER_BLOCK2_RESET_FROM), true);
  assert.equal(shouldAppendHistoryPoint(PAPER_BLOCK2_SERIES_KEY, "2026-10-15T09:10:00Z"), true);
  assert.equal(shouldAppendHistoryPoint("v6b1::v6b1", "2026-01-01T00:00:00Z"), true);
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
});

test("HISTORY_RESETS only lists paper_block2", () => {
  assert.deepEqual(Object.keys(HISTORY_RESETS), [PAPER_BLOCK2_SERIES_KEY]);
});
