import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHANGE_TRACK_LABEL,
  LAST_AVAILABLE_MONTH,
  NO_POSITIVE_BASE,
  YOY_PANE_EMPTY,
  asOfDayFromGeneratedAt,
  buildStitchedChartModel,
  formatMonthLong,
  formatMonthShort,
  formatPctRu,
  formatTickMark,
  formatTimeLabel,
  lastObservedRow,
  lineSeriesData,
  monthToTime,
  selectChartMonth,
  timeToMonth,
  yoyHistogramData,
} from "./stitchedChartModel.js";

function row(month, equity, extra = {}) {
  return { month, day: extra.day ?? `${month}-15`, equity, ...extra };
}

test("1 consecutive months get MoM against the previous calendar month", () => {
  const model = buildStitchedChartModel({
    monthly: [row("2024-01", 100), row("2024-02", 110), row("2024-03", 121)],
    yoy: [],
  });
  assert.equal(model.ok, true);
  assert.equal(model.rows.length, 3);
  assert.equal(model.rows[0].mom, null);
  assert.equal(formatPctRu(model.rows[1].mom), "+10,00%");
  assert.equal(model.rows[1].change, 10);
  assert.equal(formatPctRu(model.rows[2].mom), "+10,00%");
  assert.equal(model.rows[2].change, 11);
});

test("2 control example May 2024=100, Apr 2025=110, May 2025=121", () => {
  const monthly = [row("2024-05", 100), row("2025-04", 110), row("2025-05", 121)];
  const yoy = [{ month: "2025-05", day: "2025-05-15", yoy: 0.21, sma36: null }];
  const model = buildStitchedChartModel({ monthly, yoy });
  assert.equal(model.ok, true);
  const may = model.byMonth.get("2025-05");
  assert.equal(may.change, 11);
  assert.ok(Math.abs(may.mom - 0.1) < 1e-12);
  assert.equal(may.yoy, 0.21);
  assert.equal(formatPctRu(may.mom), "+10,00%");
  assert.equal(formatPctRu(may.yoy), "+21,00%");
  assert.equal(formatMonthLong(may.month), "Май 2025");
  assert.equal(CHANGE_TRACK_LABEL, "Изменение эквити в шкале трека");
});

test("3 December to January is a consecutive calendar step", () => {
  const model = buildStitchedChartModel({
    monthly: [row("2024-12", 200), row("2025-01", 220)],
    yoy: [],
  });
  assert.equal(model.ok, true);
  assert.equal(formatPctRu(model.rows[1].mom), "+10,00%");
  assert.equal(model.rows[1].change, 20);
});

test("4 a calendar gap makes MoM null — do not skip to an older print", () => {
  const model = buildStitchedChartModel({
    monthly: [row("2024-01", 100), row("2024-03", 130)],
    yoy: [],
  });
  assert.equal(model.ok, true);
  assert.equal(model.rows.length, 3);
  assert.equal(model.byMonth.get("2024-03").mom, null);
  assert.equal(model.byMonth.get("2024-03").change, null);
  assert.equal(model.byMonth.get("2024-03").equity, 130);
});

test("5 the first month has no percent and no synthetic seed", () => {
  const model = buildStitchedChartModel({
    monthly: [row("2024-06", 50), row("2024-07", 55)],
    yoy: [],
  });
  const first = model.rows[0];
  assert.equal(first.mom, null);
  assert.equal(first.change, null);
  assert.equal(first.equity, 50);
  assert.equal(first.time, "2024-06-01");
});

test("6 positive base and equity 0 is −100%", () => {
  const model = buildStitchedChartModel({
    monthly: [row("2024-01", 80), row("2024-02", 0)],
    yoy: [],
  });
  assert.equal(model.rows[1].mom, -1);
  assert.equal(model.rows[1].change, -80);
  const pct = formatPctRu(model.rows[1].mom);
  assert.equal(pct.endsWith("100,00%"), true);
  assert.equal(pct.startsWith("-") || pct.startsWith("−"), true);
});

test("7 base ≤0 yields no percent and no NaN/Infinity", () => {
  const zero = buildStitchedChartModel({
    monthly: [row("2024-01", 0), row("2024-02", 40)],
    yoy: [],
  });
  assert.equal(zero.ok, true);
  assert.equal(zero.rows[1].mom, null);
  assert.equal(Number.isFinite(zero.rows[1].change), true);
  const neg = buildStitchedChartModel({
    monthly: [row("2024-01", -10), row("2024-02", 40)],
    yoy: [],
  });
  assert.equal(neg.rows[1].mom, null);
  assert.equal(neg.rows[1].mom, null);
  assert.ok(!Number.isNaN(neg.rows[1].change));
  assert.notEqual(neg.rows[1].mom, Infinity);
  assert.equal(NO_POSITIVE_BASE, "нет данных: нет положительной базы");
});

test("8 empty arrays yield an empty model without throwing", () => {
  const model = buildStitchedChartModel({ monthly: [], yoy: [] });
  assert.equal(model.ok, true);
  assert.deepEqual(model.rows, []);
  assert.equal(model.byMonth.size, 0);
  assert.equal(selectChartMonth(model, "2024-01-01"), null);
  assert.equal(lastObservedRow(model), null);
});

test("9 null, a non-array container, or a broken row is an explicit reject", () => {
  assert.equal(buildStitchedChartModel(null).reason, "invalid_input");
  assert.equal(buildStitchedChartModel({ monthly: null, yoy: [] }).reason, "invalid_input");
  assert.equal(buildStitchedChartModel({ monthly: {}, yoy: [] }).reason, "invalid_input");
  assert.equal(
    buildStitchedChartModel({ monthly: [{ month: null, equity: 1 }], yoy: [] }).reason,
    "invalid_row",
  );
  assert.equal(
    buildStitchedChartModel({ monthly: [row("2024-01", 1)], yoy: "nope" }).reason,
    "invalid_input",
  );
});

test("10 a duplicate month in one array is duplicate_month", () => {
  const monthly = buildStitchedChartModel({
    monthly: [row("2024-01", 1), row("2024-01", 2)],
    yoy: [],
  });
  assert.equal(monthly.ok, false);
  assert.equal(monthly.reason, "duplicate_month");
  const yoy = buildStitchedChartModel({
    monthly: [row("2024-01", 1)],
    yoy: [
      { month: "2024-01", yoy: 0.1 },
      { month: "2024-01", yoy: 0.2 },
    ],
  });
  assert.equal(yoy.reason, "duplicate_month");
});

test("11 impossible dates and non-finite values are rejected", () => {
  assert.equal(
    buildStitchedChartModel({ monthly: [row("2024-13", 1)], yoy: [] }).reason,
    "invalid_row",
  );
  assert.equal(
    buildStitchedChartModel({ monthly: [row("2024-00", 1)], yoy: [] }).reason,
    "invalid_row",
  );
  assert.equal(
    buildStitchedChartModel({ monthly: [row("2024-02", 1, { day: "2024-02-30" })], yoy: [] }).reason,
    "invalid_row",
  );
  assert.equal(
    buildStitchedChartModel({ monthly: [row("2024-01", Infinity)], yoy: [] }).reason,
    "invalid_row",
  );
  assert.equal(
    buildStitchedChartModel({ monthly: [row("2024-01", Number.NaN)], yoy: [] }).reason,
    "invalid_row",
  );
  assert.equal(
    buildStitchedChartModel({
      monthly: [row("2024-01", 1)],
      yoy: [{ month: "2024-01", yoy: Infinity }],
    }).reason,
    "invalid_row",
  );
});

test("12 months before YoY/SMA exist, with those metrics null", () => {
  const model = buildStitchedChartModel({
    monthly: [row("2024-01", 100), row("2024-02", 110), row("2025-01", 121)],
    yoy: [{ month: "2025-01", yoy: 0.21, sma36: null }],
  });
  assert.equal(model.byMonth.get("2024-01").yoy, null);
  assert.equal(model.byMonth.get("2024-01").sma36, null);
  assert.equal(model.byMonth.get("2024-01").equity, 100);
  assert.equal(model.byMonth.get("2025-01").yoy, 0.21);
  assert.equal(model.byMonth.get("2025-01").sma36, null);
});

test("13 a gap is whitespace, not 0", () => {
  const model = buildStitchedChartModel({
    monthly: [row("2024-01", 100), row("2024-03", 120)],
    yoy: [{ month: "2024-03", yoy: 0.2 }],
  });
  const feb = model.byMonth.get("2024-02");
  assert.equal(feb.equity, null);
  assert.equal(feb.yoy, null);
  const equityPts = lineSeriesData(model.rows, "equity");
  assert.deepEqual(equityPts[1], { time: "2024-02-01" });
  assert.equal("value" in equityPts[1], false);
  const yoyPts = yoyHistogramData(model.rows, "up", "down");
  assert.deepEqual(yoyPts[1], { time: "2024-02-01" });
  assert.equal(yoyPts[2].value, 20);
});

test("14 technical time is the first of the month; observedDay stays the print day", () => {
  const model = buildStitchedChartModel({
    monthly: [row("2026-09", 15000, { day: "2026-09-19" })],
    yoy: [],
  });
  const r = model.rows[0];
  assert.equal(r.time, "2026-09-01");
  assert.equal(r.observedDay, "2026-09-19");
  assert.notEqual(r.observedDay, r.time);
  assert.equal(monthToTime("2026-09"), "2026-09-01");
  assert.equal(formatTimeLabel(r.time), "сент. 2026");
  assert.equal(formatTickMark(r.time, 0), "2026");
  assert.equal(formatMonthShort(r.month), "сент. 2026");
});

test("15 current month / unknown cutoff / observation after the snapshot", () => {
  const provisional = buildStitchedChartModel({
    monthly: [row("2026-09", 10, { day: "2026-09-30" }), row("2026-10", 11, { day: "2026-10-17" })],
    yoy: [],
    asOfDay: "2026-10-17",
  });
  assert.equal(provisional.ok, true);
  assert.equal(provisional.byMonth.get("2026-09").periodState, "historical");
  assert.equal(provisional.byMonth.get("2026-10").periodState, "provisional");
  const unknown = buildStitchedChartModel({
    monthly: [row("2026-10", 11, { day: "2026-10-17" })],
    yoy: [],
  });
  assert.equal(unknown.byMonth.get("2026-10").periodState, "unknown");
  const future = buildStitchedChartModel({
    monthly: [row("2026-10", 11, { day: "2026-10-18" })],
    yoy: [],
    asOfDay: "2026-10-17",
  });
  assert.equal(future.ok, false);
  assert.equal(future.reason, "future_observation");
  assert.equal(asOfDayFromGeneratedAt("2026-10-17T17:11:43Z"), "2026-10-17");
});

test("16 selectChartMonth: valid Time, undefined, invalid, out of range", () => {
  const model = buildStitchedChartModel({
    monthly: [row("2024-05", 100), row("2024-06", 110)],
    yoy: [],
  });
  assert.equal(selectChartMonth(model, "2024-06-01")?.month, "2024-06");
  assert.equal(selectChartMonth(model, { year: 2024, month: 5 })?.month, "2024-05");
  assert.equal(selectChartMonth(model, Date.UTC(2024, 5, 1) / 1000)?.month, "2024-06");
  assert.equal(selectChartMonth(model, undefined), null);
  assert.equal(selectChartMonth(model, "nope"), null);
  assert.equal(selectChartMonth(model, "2020-01-01"), null);
  assert.equal(selectChartMonth(model, "2024-07-01"), null);
  assert.notEqual(selectChartMonth(model, undefined)?.month, lastObservedRow(model).month);
});

test("17 inputs are not mutated and month keys do not depend on local TZ", () => {
  const monthly = [row("2024-05", 100), row("2025-05", 121)];
  const yoy = [{ month: "2025-05", yoy: 0.21, sma36: null }];
  const snapM = JSON.stringify(monthly);
  const snapY = JSON.stringify(yoy);
  Object.freeze(monthly);
  Object.freeze(monthly[0]);
  Object.freeze(yoy);
  Object.freeze(yoy[0]);
  const model = buildStitchedChartModel({ monthly, yoy, asOfDay: "2025-05-31" });
  assert.equal(model.ok, true);
  assert.equal(JSON.stringify(monthly), snapM);
  assert.equal(JSON.stringify(yoy), snapY);
  assert.equal(timeToMonth("2024-05-01"), "2024-05");
  assert.equal(timeToMonth({ year: 2024, month: 12, day: 1 }), "2024-12");
  const utcMs = Date.UTC(2024, 0, 1, 0, 0, 0);
  assert.equal(timeToMonth(utcMs / 1000), "2024-01");
  assert.equal(YOY_PANE_EMPTY, "Недостаточно данных для изменения за 12 месяцев");
  assert.equal(LAST_AVAILABLE_MONTH, "Последний доступный месяц");
});

test("stitched chart «В %»: base is first stitched day, gaps stay gaps", async () => {
  const { stitchPctBase, toPctSeriesData } = await import("./stitchedChartModel.js");
  assert.equal(stitchPctBase({ daily: [{ eq: 200 }, { eq: 300 }] }), 200);
  assert.equal(stitchPctBase({ daily: [{ eq: 0 }] }), null);
  assert.equal(stitchPctBase({}), null);
  const out = toPctSeriesData([{ time: 1, value: 200 }, { time: 2 }, { time: 3, value: 250 }], 200);
  assert.deepEqual(out, [{ time: 1, value: 0 }, { time: 2 }, { time: 3, value: 25 }]);
  assert.deepEqual(toPctSeriesData([{ time: 1, value: 5 }], null), [{ time: 1, value: 5 }]);
});
