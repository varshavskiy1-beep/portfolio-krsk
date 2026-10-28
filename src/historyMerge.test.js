import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { equityCurvePoints, hasEquityCurve } from "./equityCurve.js";
import {
  dropHiddenFeedRows,
  dropOrphanHistorySeries,
  isDroppedEquitySeries,
  mergeLatestIntoHistory,
} from "./historyMerge.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const latest = JSON.parse(readFileSync(join(root, "public/data/latest.json"), "utf8"));
const history = JSON.parse(readFileSync(join(root, "public/data/history.json"), "utf8"));
const ADAPTIVE = "forts_adr_adaptive::forts_adr_adaptive";
const STATIC = "forts_adr_static::forts_adr_static";
const clone = (x) => JSON.parse(JSON.stringify(x));

test("equityCurvePoints: string equity becomes number, sorted, bad points dropped", () => {
  const pts = equityCurvePoints({
    equity_curve: [
      { t: "2026-09-19T00:00:00Z", equity: "2.5" },
      { t: "2026-09-18T00:00:00Z", equity: "1.0" },
      { t: "", equity: "3" },
      { t: "2026-09-20T00:00:00Z", equity: "" },
      { t: "2026-09-21T00:00:00Z", equity: "abc" },
    ],
  });
  assert.deepEqual(pts, [
    { t: "2026-09-18T00:00:00Z", equity: 1 },
    { t: "2026-09-19T00:00:00Z", equity: 2.5 },
  ]);
  assert.equal(hasEquityCurve({ equity_curve: [] }), false);
  assert.equal(hasEquityCurve({}), false);
});

test("merge: equity_curve replaces the stored series entirely (old 1 950 000 gone)", () => {
  const hist = {
    schema: "equity_history.v1",
    updated_at: null,
    series: {
      [ADAPTIVE]: {
        bot_id: "forts_adr_adaptive",
        account_id: "forts_adr_adaptive",
        currency: "RUB",
        seed: 1500000,
        points: [
          { t: "2026-09-21T13:10:00Z", equity: 1950000 },
          { t: "2026-09-22T13:10:33Z", equity: 1837991.68 },
        ],
      },
    },
  };
  const acc = {
    bot_id: "forts_adr_adaptive",
    account_id: "forts_adr_adaptive",
    currency: "RUB",
    seed: "1500000",
    equity: "1387991.68",
    updated_utc: "2026-09-22T13:10:33Z",
    equity_curve: [
      { t: "2026-09-18T16:39:08Z", equity: "1500000.0" },
      { t: "2026-09-21T13:10:00Z", equity: "1500000.0" },
      { t: "2026-09-22T13:10:33Z", equity: "1387991.68" },
    ],
  };
  mergeLatestIntoHistory(hist, { generated_at: "2026-10-20T10:17:45Z", accounts: [acc] });
  assert.deepEqual(hist.series[ADAPTIVE].points, [
    { t: "2026-09-18T16:39:08Z", equity: 1500000 },
    { t: "2026-09-21T13:10:00Z", equity: 1500000 },
    { t: "2026-09-22T13:10:33Z", equity: 1387991.68 },
  ]);
  assert.equal(hist.series[ADAPTIVE].seed, 1500000);
  assert.equal(hist.series[ADAPTIVE].currency, "RUB");
});

test("merge: accounts without equity_curve stay append-only", () => {
  const hist = {
    series: {
      "oac_paper::oac_paper": {
        bot_id: "oac_paper",
        account_id: "oac_paper",
        points: [{ t: "2026-10-19T00:00:00Z", equity: 10000 }],
      },
    },
  };
  mergeLatestIntoHistory(hist, {
    generated_at: "2026-10-20T00:00:00Z",
    accounts: [{ bot_id: "oac_paper", account_id: "oac_paper", equity: "9900", updated_utc: "2026-10-20T00:00:00Z", equity_curve: [] }],
  });
  assert.deepEqual(hist.series["oac_paper::oac_paper"].points, [
    { t: "2026-10-19T00:00:00Z", equity: 10000 },
    { t: "2026-10-20T00:00:00Z", equity: 9900 },
  ]);
});

test("merge on current latest.json: forts series equal equity_curve, other keys only grow", () => {
  const before = clone(history);
  const after = mergeLatestIntoHistory(clone(history), clone(latest));
  const byKey = Object.fromEntries(latest.accounts.map((a) => [`${a.bot_id}::${a.account_id}`, a]));
  for (const key of [ADAPTIVE, STATIC]) {
    assert.deepEqual(after.series[key].points, equityCurvePoints(byKey[key]));
    // живая лента: каждый день добавляет точку, старые не пропадают
    assert.ok(after.series[key].points.length >= 32);
    // the committed history.json already equals the feed curve
    assert.deepEqual(before.series[key].points, after.series[key].points);
  }
  const a = after.series[ADAPTIVE].points;
  assert.equal(a[0].t.slice(0, 10), "2026-09-18");
  assert.equal(a[0].equity, 1500000);
  assert.ok(!a.some((p) => p.equity === 1950000));
  const s = after.series[STATIC].points;
  assert.equal(s[0].t.slice(0, 16), "2026-09-19T03:56");
  assert.equal(s[0].equity, 1500000);
  assert.ok(Math.abs(s[1].equity - 1508999.9999124017) < 1e-6);
  for (const [key, ser] of Object.entries(before.series)) {
    if (key === ADAPTIVE || key === STATIC) continue;
    if (isDroppedEquitySeries(key, ser)) {
      assert.equal(after.series[key], undefined, key);
      continue;
    }
    const prev = ser.points || [];
    assert.deepEqual(after.series[key].points.slice(0, prev.length), prev, key);
  }
  assert.equal(after.series["three_robots_okx_nasdaq_1h::paper_block2"], undefined);
});

test("merge drops retired paper_block2 even if leftover feed still has the account", () => {
  const key = "three_robots_okx_nasdaq_1h::paper_block2";
  const hist = {
    series: {
      [key]: {
        bot_id: "three_robots_okx_nasdaq_1h",
        account_id: "paper_block2",
        points: [
          { t: "2026-10-15T08:57:31Z", equity: 10000 },
          { t: "2026-10-23T19:09:44Z", equity: 10306.11 },
        ],
      },
      "v6b1::v6b1": {
        bot_id: "v6b1",
        account_id: "v6b1",
        points: [{ t: "2026-10-15T17:27:12Z", equity: 10000 }],
      },
    },
  };
  mergeLatestIntoHistory(hist, {
    generated_at: "2026-10-28T00:00:00Z",
    accounts: [
      { bot_id: "v6b1", account_id: "v6b1", equity: "10100", updated_utc: "2026-10-28T00:00:00Z" },
      {
        bot_id: "three_robots_okx_nasdaq_1h",
        account_id: "paper_block2",
        equity: "10306.11",
        updated_utc: "2026-10-28T00:00:00Z",
      },
    ],
  });
  assert.equal(hist.series[key], undefined);
  assert.equal(hist.series["v6b1::v6b1"].points.at(-1).equity, 10100);
});

test("orphan series is dropped when account_id left the feed; other books stay", () => {
  const key = "three_robots_okx_nasdaq_1h::paper_block2";
  const hist = {
    series: {
      [key]: {
        bot_id: "three_robots_okx_nasdaq_1h",
        account_id: "paper_block2",
        points: [{ t: "2026-10-15T08:57:31Z", equity: 10000 }],
      },
      "grail_b20_3x::grail_b20_3x": {
        bot_id: "grail_b20_3x",
        account_id: "grail_b20_3x",
        points: [{ t: "2026-09-01T00:00:00Z", equity: 20000 }],
      },
      "v6b1::v6b1": { bot_id: "v6b1", account_id: "v6b1", points: [{ t: "2026-10-15T17:27:12Z", equity: 10000 }] },
    },
  };
  const dropped = dropOrphanHistorySeries(hist, {
    accounts: [{ bot_id: "v6b1", account_id: "v6b1", equity: "10000" }],
  });
  assert.deepEqual(dropped, [key]);
  assert.equal(hist.series[key], undefined);
  assert.ok(hist.series["grail_b20_3x::grail_b20_3x"]);
  assert.ok(hist.series["v6b1::v6b1"]);
});

test("dropHiddenFeedRows strips paper_block2 from accounts and manifest, keeps robot 3 live mark", () => {
  const latest = {
    accounts: [
      { bot_id: "v6b1", account_id: "v6b1", equity: "10000" },
      { bot_id: "three_robots_okx_nasdaq_1h", account_id: "paper_block2", equity: "10306" },
    ],
    manifest: [
      { bot_id: "v6b1", logic: "ok" },
      { bot_id: "three_robots_okx_nasdaq_1h", logic: "retired" },
    ],
    excluded: [
      { id: "three_robots_finam_live", reason: "live Finam" },
      { id: "three_robots_okx_nasdaq_1h", reason: "live OKX" },
      { id: "three_robots_okx_spcx_btc_4h", reason: "live OKX" },
    ],
  };
  dropHiddenFeedRows(latest);
  assert.deepEqual(
    latest.accounts.map((a) => a.account_id),
    ["v6b1"],
  );
  assert.deepEqual(
    latest.manifest.map((m) => m.bot_id),
    ["v6b1"],
  );
  assert.deepEqual(
    latest.excluded.map((e) => e.id),
    ["three_robots_finam_live", "three_robots_okx_nasdaq_1h", "three_robots_okx_spcx_btc_4h"],
  );
});
