import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  collapseHistoryByDay,
  ethOkxHistoryPoints,
  ethOkxTimedSeries,
  hasTimeOfDay,
} from "./ethOkxCard.js";
import { buildSeries, resolveChartBase, resolveEquityPoints, toUnix } from "./equityChartModel.js";
import { mergeLatestIntoHistory } from "./historyMerge.js";
import { stitchPaperPoints } from "./stitchEquity.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEY = "eth_okx_moex::eth_okx_moex";

// Пример из записки деплоера (WORK PR #545, 0e152df1): метки UTC.
const TIMED = [
  { t: "2026-10-13T03:59:59Z", equity: "300000.0" },
  { t: "2026-10-13T04:00:00Z", equity: "299970.19681904" },
  { t: "2026-10-13T20:00:00Z", equity: "297011.84427952" },
];
// Как в живой ленте сейчас: только даты.
const DATE_ONLY = [
  { t: "2026-10-13", equity: "300000.0" },
  { t: "2026-10-13", equity: "299970.19681904" },
  { t: "2026-10-13", equity: "297011.84427952" },
];

const BASE = {
  bot_id: "eth_okx_moex",
  account_id: "eth_okx_moex",
  currency: "RUB",
  seed: "300000",
  equity: "297011.84427952",
  updated_utc: "2026-10-13T20:00:00Z",
  positions: [],
};

// Старый history.json ключа: дневная метка и снимки синка.
const OLD_HISTORY = () => ({
  series: {
    [KEY]: {
      bot_id: "eth_okx_moex",
      account_id: "eth_okx_moex",
      currency: "RUB",
      seed: 300000,
      points: [
        { t: "2026-10-13", equity: 297011.84427952 },
        { t: "2026-10-13T05:42:49Z", equity: 299970.19681904 },
        { t: "2026-10-14T05:42:49Z", equity: 297011.84427952 },
      ],
    },
  },
});

function assertTimedCard(points) {
  assert.equal(points.length, 3);
  assert.equal(points[0].t, "2026-10-13T03:59:59Z");
  assert.equal(points[0].equity, 300000);
  assert.equal(points[2].t, "2026-10-13T20:00:00Z");
  assert.equal(points[2].equity, 297011.84427952);
  assert.ok(points.every((p) => p.t.length > 10));
  const pct = buildSeries(points, 300000, "pct");
  assert.equal(pct[0].time, toUnix("2026-10-13T03:59:59Z"));
  assert.equal(pct[0].value, 0);
  assert.equal(pct[2].time, toUnix("2026-10-13T20:00:00Z"));
  assert.ok(Math.abs(pct[2].value - -0.99605191) < 1e-6);
}

test("eth: метка с часом отличается от даты", () => {
  assert.equal(hasTimeOfDay({ t: "2026-10-13T03:59:59Z" }), true);
  assert.equal(hasTimeOfDay({ t: "2026-10-13" }), false);
  assert.equal(hasTimeOfDay({ t: "2026-10-13Tчепуха" }), false);
});

test("eth: equity_curve с часами — весь ряд, старт 0% в 03:59:59Z, 297 011,84 в 20:00Z", () => {
  const acc = { ...BASE, equity_curve: TIMED, history: DATE_ONLY };
  const points = resolveEquityPoints(acc, OLD_HISTORY());
  assertTimedCard(points);
  assert.equal(resolveChartBase(acc, points, { series: {} }).base, 300000);
});

test("eth: history с часами без equity_curve — день не схлопывается", () => {
  const acc = { ...BASE, history: TIMED };
  assertTimedCard(ethOkxHistoryPoints(acc));
  assertTimedCard(resolveEquityPoints(acc, OLD_HISTORY()));
});

test("eth: только даты — как раньше, последняя точка дня", () => {
  const acc = { ...BASE, history: DATE_ONLY };
  assert.deepEqual(ethOkxTimedSeries(acc), []);
  const points = ethOkxHistoryPoints(acc);
  assert.deepEqual(points, collapseHistoryByDay(DATE_ONLY));
  assert.equal(points.length, 1);
  assert.equal(points[0].t, "2026-10-13");
  assert.equal(Number(points[0].equity), 297011.84427952);
});

test("eth: в history.json ряд с часами заменяет ключ целиком, старые точки не смешиваются", () => {
  for (const acc of [
    { ...BASE, equity_curve: TIMED, history: DATE_ONLY },
    { ...BASE, history: TIMED },
  ]) {
    const hist = mergeLatestIntoHistory(OLD_HISTORY(), {
      generated_at: "2026-10-13T20:05:00Z",
      accounts: [acc],
    });
    const pts = hist.series[KEY].points;
    assert.deepEqual(
      pts.map((p) => [p.t, p.equity]),
      TIMED.map((p) => [p.t, Number(p.equity)]),
    );
    assert.ok(pts.every((p) => p.t.length > 10));
  }
});

test("eth: только даты — history.json дописывается как раньше", () => {
  const hist = mergeLatestIntoHistory(OLD_HISTORY(), {
    generated_at: "2026-10-14T06:00:00Z",
    accounts: [{ ...BASE, history: DATE_ONLY, updated_utc: "2026-10-14T06:00:00Z" }],
  });
  const pts = hist.series[KEY].points;
  assert.equal(pts.length, 4);
  assert.deepEqual(pts.at(-1), { t: "2026-10-14T06:00:00Z", equity: 297011.84427952 });
});

test("eth: склейка берёт новый ряд, а не history.json", () => {
  const pts = stitchPaperPoints({ ...BASE, equity_curve: TIMED }, null, OLD_HISTORY());
  assert.deepEqual(pts.map((p) => p.t), TIMED.map((p) => p.t));
  const fromHist = stitchPaperPoints({ ...BASE, history: TIMED }, null, OLD_HISTORY());
  assert.deepEqual(fromHist.map((p) => p.t), TIMED.map((p) => p.t));
  const dateOnly = stitchPaperPoints({ ...BASE, history: DATE_ONLY }, null, OLD_HISTORY());
  assert.equal(dateOnly.length, 3);
  assert.equal(dateOnly[0].t, "2026-10-13");
});

test("eth: живая лента сейчас — вид карточки не меняется", () => {
  const latest = JSON.parse(readFileSync(join(root, "public/data/latest.json"), "utf8"));
  const acc = latest.accounts.find((a) => a.bot_id === "eth_okx_moex");
  if (!acc) return;
  const timed = ethOkxTimedSeries(acc);
  if (timed.length) return; // экспортёр уже отдаёт часы — проверено тестами выше
  const raw = (acc.history || []).filter((p) => p && (p.t || p.time) && p.equity != null && p.equity !== "");
  assert.deepEqual(ethOkxHistoryPoints(acc), collapseHistoryByDay(raw));
});
