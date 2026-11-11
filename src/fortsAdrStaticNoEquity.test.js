/**
 * Live latest can ship forts_adr_static with error + equity=null while
 * history.json still has a last print. That print is not current NAV.
 * Card stays «нет данных»; chart does not claim missing seed.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyChartMessage, lastEquityValue, resolveEquityPoints } from "./equityChartModel.js";
import { EMPTY_CHART_NO_POINTS, PCT_NO_POSITIVE_SEED } from "./feedValidate.js";
import { sanitizeCabinetSnapshot } from "./historyMerge.js";
import {
  hasAccountData,
  isHiddenPortalAccount,
  mergePortalAccounts,
} from "./strategyMeta.js";
import { snapshotErrorLine } from "./uiCopy.js";

const STATIC_KEY = "forts_adr_static::forts_adr_static";
const HOST_ERROR = "NameError: name 'forts_static_curve' is not defined";
const HIST_LAST = { t: "2026-11-10T13:20:37.879370Z", equity: 1535646.4682664329 };

function liveStaticAccount() {
  return {
    bot_id: "forts_adr_static",
    account_id: "forts_adr_static",
    currency: "RUB",
    equity: null,
    seed: "1500000",
    positions: [],
    error: HOST_ERROR,
  };
}

function liveHistory() {
  return {
    series: {
      [STATIC_KEY]: {
        bot_id: "forts_adr_static",
        account_id: "forts_adr_static",
        currency: "RUB",
        seed: 1500000,
        points: [
          { t: "2026-09-19T03:56:37.039678Z", equity: 1500000 },
          HIST_LAST,
        ],
      },
    },
  };
}

test("production-shaped static: error + null equity is нет данных, not history last print", () => {
  const account = liveStaticAccount();
  const history = liveHistory();
  assert.equal(hasAccountData(account), false);
  assert.equal(isHiddenPortalAccount(account), false);
  assert.equal(lastEquityValue(account), null);
  assert.deepEqual(resolveEquityPoints(account, history), []);
  const merged = mergePortalAccounts([account]);
  const row = merged.find((a) => a.bot_id === "forts_adr_static");
  assert.equal(row.error, HOST_ERROR);
  assert.notEqual(lastEquityValue(row), HIST_LAST.equity);
  assert.equal(snapshotErrorLine(account), HOST_ERROR);
});

test("production-shaped static: empty % chart is no points, not missing seed", () => {
  const points = resolveEquityPoints(liveStaticAccount(), liveHistory());
  assert.equal(emptyChartMessage({ points, mode: "pct", seed: null }), EMPTY_CHART_NO_POINTS);
  assert.equal(emptyChartMessage({ points, mode: "money", seed: 1_500_000 }), EMPTY_CHART_NO_POINTS);
  assert.notEqual(emptyChartMessage({ points, mode: "pct", seed: null }), PCT_NO_POSITIVE_SEED);
  assert.equal(Number(liveStaticAccount().seed), 1_500_000);
});

test("exclusion of adaptive does not drop static when latest has host error", () => {
  const latest = {
    generated_at: "2026-11-11T06:29:45Z",
    accounts: [
      liveStaticAccount(),
      {
        bot_id: "forts_adr_adaptive",
        account_id: "forts_adr_adaptive",
        equity: "2249000",
      },
    ],
    manifest: [
      { bot_id: "forts_adr_static", logic: "ok" },
      { bot_id: "forts_adr_adaptive", logic: "no" },
    ],
  };
  const history = liveHistory();
  history.series["forts_adr_adaptive::forts_adr_adaptive"] = { points: [{ t: "x", equity: 1 }] };
  sanitizeCabinetSnapshot(latest, history);
  assert.equal(latest.accounts.length, 1);
  assert.equal(latest.accounts[0].bot_id, "forts_adr_static");
  assert.equal(latest.accounts[0].equity, null);
  assert.equal(latest.accounts[0].error, HOST_ERROR);
  assert.ok(history.series[STATIC_KEY]);
  assert.equal(history.series["forts_adr_adaptive::forts_adr_adaptive"], undefined);
});
