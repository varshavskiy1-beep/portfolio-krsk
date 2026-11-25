import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lastEquityValue, resolveEquityPoints } from "./equityChartModel.js";
import {
  DEFAULT_OFFICE_SIGNALS_REPLAY_WINDOW,
  OFFICE_SIGNALS_REPLAY_COLUMNS,
  OFFICE_SIGNALS_REPLAY_CSV_FILES,
  OFFICE_SIGNALS_REPLAY_ENGINE_LABEL,
  OFFICE_SIGNALS_REPLAY_HEADING,
  OFFICE_SIGNALS_REPLAY_ROLL1_REF,
  OFFICE_SIGNALS_REPLAY_SOURCE,
  OFFICE_SIGNALS_REPLAY_WINDOWS,
  officeSignalsReplayCaption,
  officeSignalsReplayKpis,
  officeSignalsReplayWindowId,
  parseOfficeSignalsReplayJournal,
  replayAccountingDiffs,
  replayCrSideDays,
  replayEquityPoints,
  verifyOfficeSignalsReplayJournal,
} from "./officeSignalsComonCnyReplay.js";
import { stitchEquity } from "./stitchEquity.js";
import { OFFICE_SIGNALS_COMON_CNY_BOT_ID } from "./strategyMeta.js";
import { getPassport, validatePassport } from "./strategyPassport.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadJournal(windowId) {
  const rel = OFFICE_SIGNALS_REPLAY_CSV_FILES[windowId];
  return readFileSync(join(root, rel), "utf8");
}

test("imported roll0 journals match schema, counts, dates and checkpoints", () => {
  assert.equal(OFFICE_SIGNALS_REPLAY_COLUMNS.length, 15);
  assert.equal(DEFAULT_OFFICE_SIGNALS_REPLAY_WINDOW, "W1");
  for (const id of ["W1", "W2"]) {
    const rows = parseOfficeSignalsReplayJournal(loadJournal(id));
    assert.deepEqual(verifyOfficeSignalsReplayJournal(rows, id), [], id);
    assert.notEqual(rows[0].equity, OFFICE_SIGNALS_REPLAY_SOURCE.baseCapital);
  }
});

test("replay equity identity does not add MXI/CR notional twice", () => {
  for (const id of ["W1", "W2"]) {
    const rows = parseOfficeSignalsReplayJournal(loadJournal(id));
    const acc = replayAccountingDiffs(rows);
    assert.equal(acc.maxNav, 0, id);
    assert.ok(acc.maxPnl < 1e-6, `${id} pnl ${acc.maxPnl}`);
    const withFut = rows.find((r) => r.mxi_qty !== 0 || r.cr_qty !== 0);
    assert.ok(withFut, id);
    const notionalGuess = Math.abs(withFut.mxi_qty) * 10 + Math.abs(withFut.cr_qty) * 1000;
    assert.notEqual(withFut.equity, withFut.cash + withFut.stocks + withFut.park + notionalGuess);
  }
});

test("W1 has CR short and long days; funding copy is long-only stop", () => {
  const w1 = parseOfficeSignalsReplayJournal(loadJournal("W1"));
  assert.deepEqual(replayCrSideDays(w1), { short: 403, long: 189, flat: 466 });
  const p = getPassport(OFFICE_SIGNALS_COMON_CNY_BOT_ID);
  const funding = p.parameters.find((r) => r.name === "Фильтр фандинга F2/F1");
  assert.match(funding.value, /≥ 10%/);
  assert.match(funding.meaning, /short_blocked_by_funding: false/);
  assert.match(p.essence.paragraphs.join("\n"), /403 дня шорта CR и 189 дней лонга/);
});

test("W1/W2 captions, proxy label, default window and sourced KPIs", () => {
  assert.equal(officeSignalsReplayWindowId("nope"), "W1");
  assert.equal(OFFICE_SIGNALS_REPLAY_HEADING, "Исторический replay (не форвард)");
  assert.equal(
    OFFICE_SIGNALS_REPLAY_ENGINE_LABEL,
    "Исторический replay движка 08d3ca6 — не форвардные сделки кабинета",
  );
  const w1 = officeSignalsReplayCaption("W1");
  const w2 = officeSignalsReplayCaption("W2");
  assert.match(w1, /реальный CR/);
  assert.match(w1, /06\.09\.2022–30\.10\.2026/);
  assert.match(w1, /24\.11\.2026/);
  assert.doesNotMatch(w1, /прокси-фьючерс Si/);
  assert.match(w2, /прокси-фьючерс Si/);
  assert.match(w2, /05\.09\.2022/);
  assert.match(w2, /31\.07\.2019–30\.10\.2026/);
  assert.equal(OFFICE_SIGNALS_REPLAY_WINDOWS.W2.siProxy, true);
  const kpis = officeSignalsReplayKpis("W1").map((k) => `${k.name}:${k.value}`).join("|");
  assert.match(kpis, /CAGR:\+65,95%/);
  assert.match(kpis, /MaxDD:−9,46%/);
  assert.equal(OFFICE_SIGNALS_REPLAY_ROLL1_REF.W1.cagrPct, 64);
  assert.equal(OFFICE_SIGNALS_REPLAY_ROLL1_REF.W2.maxDdPct, -17.78);
});

test("main forward curve ignores replay journals; stitch would gap", () => {
  const forward = {
    bot_id: OFFICE_SIGNALS_COMON_CNY_BOT_ID,
    account_id: OFFICE_SIGNALS_COMON_CNY_BOT_ID,
    currency: "RUB",
    seed: "1000000",
    equity: "1000000.00",
    history: [{ t: "2026-11-24", equity: 1000000 }],
  };
  const w1 = parseOfficeSignalsReplayJournal(loadJournal("W1"));
  const replayPts = replayEquityPoints(w1);
  const leaked = {
    series: {
      "office_signals_comon_cny::office_signals_comon_cny": {
        points: replayPts,
      },
    },
  };
  const pts = resolveEquityPoints(forward, leaked);
  assert.equal(pts.length, 1);
  assert.equal(pts[0].t, "2026-11-24");
  assert.equal(Number(pts[0].equity), 1000000);
  assert.ok(pts.every((p) => Number(p.equity) !== w1.at(-1).equity));
  assert.equal(lastEquityValue(forward), 1000000);

  const st = stitchEquity(replayPts, [{ t: "2026-11-24", equity: 1000000 }]);
  assert.equal(st.ok, false);
  assert.equal(st.reason, "gap");
  assert.equal(OFFICE_SIGNALS_REPLAY_SOURCE.forwardGapCalendarDays > 7, true);
});

test("replay series is not in backtests.json or live snapshots", () => {
  const backtests = JSON.parse(readFileSync(join(root, "public/data/backtests.json"), "utf8"));
  assert.equal(backtests.series["office_signals_comon_cny::office_signals_comon_cny"], undefined);
  const latest = JSON.parse(readFileSync(join(root, "public/data/latest.json"), "utf8"));
  const history = JSON.parse(readFileSync(join(root, "public/data/history.json"), "utf8"));
  assert.equal(
    (latest.accounts || []).some((a) => a.bot_id === OFFICE_SIGNALS_COMON_CNY_BOT_ID),
    false,
  );
  assert.equal(history?.series?.["office_signals_comon_cny::office_signals_comon_cny"], undefined);
});

test("passport still validates with zero errors after replay copy", () => {
  assert.deepEqual(validatePassport(getPassport(OFFICE_SIGNALS_COMON_CNY_BOT_ID)), []);
});
