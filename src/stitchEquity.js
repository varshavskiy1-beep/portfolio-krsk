/**
 * Помесячная склейка бэктеста с бумагой.
 * Ряды только из backtests.json; пустые не рисуем и не выдумываем.
 */

import { toUnix } from "./equityChartModel.js";

export const STITCH_EMPTY_LINE = "Склейки нет";

export const STITCH_COPY = {
  title: "Помесячная склейка",
  empty: STITCH_EMPTY_LINE,
  stitch: "склейка бэктеста с бумагой",
  paper: "бумага",
  ema: "средняя 100 дней",
  yoy: "прирост за 12 мес",
  avg36: "средняя за 36 мес",
};

export const STITCH_COLORS = {
  stitch: "#2b6cb0",
  paper: "#e67e22",
  ema: "#7c3aed",
  yoyPos: "#1f7a4c",
  yoyNeg: "#a33",
  avg36: "#555",
};

export function stitchCopyValues() {
  return Object.values(STITCH_COPY);
}

function packTimeMs(t) {
  if (t == null || t === "") return null;
  if (typeof t === "number") {
    const ms = t > 1e12 ? t : t * 1000;
    return Number.isFinite(ms) ? ms : null;
  }
  const s = String(t);
  if (/^\d{4}-\d{2}$/.test(s)) return Date.parse(`${s}-01T00:00:00Z`);
  const unix = toUnix(s.length === 10 ? `${s}T00:00:00Z` : s);
  return unix == null ? null : unix * 1000;
}

function asPoints(raw) {
  if (!Array.isArray(raw) || !raw.length) return [];
  const out = [];
  for (const p of raw) {
    if (p == null) continue;
    const t = p.t ?? p.time;
    const v = p.value ?? p.equity ?? p.v;
    const ms = packTimeMs(t);
    const n = v == null || v === "" ? NaN : Number(v);
    if (ms == null || !Number.isFinite(n)) continue;
    out.push({ t: t, time: Math.floor(ms / 1000), value: n });
  }
  out.sort((a, b) => a.time - b.time);
  const dedup = [];
  for (const row of out) {
    if (dedup.length && dedup[dedup.length - 1].time === row.time) dedup[dedup.length - 1] = row;
    else dedup.push(row);
  }
  return dedup;
}

export function lookupStitchPack(backtests, botId, accountId) {
  const series = backtests?.series;
  if (!series || typeof series !== "object") return null;
  const keys = [`${botId}::${accountId}`, botId, accountId].filter((k) => k);
  for (const k of keys) {
    if (series[k] && typeof series[k] === "object") return series[k];
  }
  return null;
}

function lineFromPack(pack, names) {
  if (!pack) return [];
  for (const name of names) {
    const pts = asPoints(pack[name]);
    if (pts.length) return pts;
  }
  return [];
}

/** 12-мес прирост только из уже данного месячного ряда; без ряда — пусто. */
export function yoyFromMonthly(monthly) {
  const pts = asPoints(monthly);
  if (pts.length < 13) return [];
  const out = [];
  for (const cur of pts) {
    const want = cur.time - 365 * 24 * 3600;
    let prev = null;
    let best = Infinity;
    for (const p of pts) {
      const d = Math.abs(p.time - want);
      if (d < best && d <= 40 * 24 * 3600) {
        best = d;
        prev = p;
      }
    }
    if (!prev || !prev.value) continue;
    out.push({
      t: cur.t,
      time: cur.time,
      value: ((cur.value - prev.value) / prev.value) * 100,
    });
  }
  return out;
}

export function average36m(growth) {
  const pts = asPoints(growth);
  if (pts.length < 36) return null;
  const last = pts.slice(-36);
  const sum = last.reduce((s, p) => s + p.value, 0);
  return sum / last.length;
}

export function resolveStitchModel(pack) {
  const stitch = lineFromPack(pack, ["stitch", "stitch_monthly", "склейка"]);
  const paper = lineFromPack(pack, ["paper", "paper_monthly", "бумага"]);
  const ema = lineFromPack(pack, ["ema100", "ema100_daily", "ema"]);
  let yoy = lineFromPack(pack, ["growth_12m", "yoy", "прирост_12м"]);
  if (!yoy.length && stitch.length >= 13) yoy = yoyFromMonthly(stitch);
  else if (!yoy.length && paper.length >= 13) yoy = yoyFromMonthly(paper);
  const avgGiven = pack?.avg_36m ?? pack?.avg36;
  let avg36 = null;
  if (typeof avgGiven === "number" && Number.isFinite(avgGiven)) avg36 = avgGiven;
  else if (Array.isArray(avgGiven) && avgGiven.length) {
    const pts = asPoints(avgGiven);
    if (pts.length) avg36 = pts[pts.length - 1].value;
  }
  if (avg36 == null) avg36 = average36m(yoy);

  const lines = [];
  if (stitch.length >= 2) lines.push({ id: "stitch", label: STITCH_COPY.stitch, color: STITCH_COLORS.stitch, points: stitch });
  if (paper.length >= 2) lines.push({ id: "paper", label: STITCH_COPY.paper, color: STITCH_COLORS.paper, points: paper });
  if (ema.length >= 2) lines.push({ id: "ema", label: STITCH_COPY.ema, color: STITCH_COLORS.ema, points: ema });

  const hist = yoy.length ? yoy : [];
  const drawable = lines.length > 0 || hist.length > 0;
  return {
    empty: !drawable,
    message: drawable ? "" : STITCH_EMPTY_LINE,
    lines,
    yoy: hist,
    avg36: hist.length && avg36 != null && Number.isFinite(avg36) ? avg36 : null,
  };
}

export function stitchView(backtests, botId, accountId) {
  const pack = lookupStitchPack(backtests, botId, accountId);
  if (!pack) return { empty: true, message: STITCH_EMPTY_LINE, lines: [], yoy: [], avg36: null };
  return resolveStitchModel(pack);
}

