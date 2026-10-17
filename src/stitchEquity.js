/**
 * Склейка дневного бэктеста с бумажным треком и помесячные ряды.
 * Бумажная кривая кабинета не называется бэктестом.
 * Скачок на стыке не допускается: бумага продолжается с уровня бэктеста.
 */

import { filterResetPoints, seriesKey as resetSeriesKey } from "./historyReset.js";

export const GAP_DAYS = 7;
export const EMA_SPAN = 100;
export const YOY_MONTHS = 12;
export const SMA_YEARS = 3;
export const SMA_MONTHS = SMA_YEARS * 12;

function parseTime(t) {
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? null : ms;
}

export function dayKey(t) {
  const ms = parseTime(t);
  if (ms == null) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

export function monthKey(day) {
  return String(day).slice(0, 7);
}

function daysBetween(a, b) {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

/** Последняя точка каждых суток UTC. Ноль — это −100%, его не выбрасываем. */
export function collapseDays(points) {
  const rows = [];
  for (const p of points || []) {
    const day = dayKey(p?.t ?? p?.time ?? p?.day);
    const eq = Number(p?.equity ?? p?.eq);
    const ms = parseTime(p?.t ?? p?.time ?? `${day}T00:00:00Z`);
    if (!day || ms == null || !Number.isFinite(eq)) continue;
    rows.push({ day, eq, ms });
  }
  rows.sort((a, b) => a.ms - b.ms || a.day.localeCompare(b.day));
  const out = [];
  for (const row of rows) {
    if (out.length && out[out.length - 1].day === row.day) out[out.length - 1] = row;
    else out.push(row);
  }
  return out.map(({ day, eq }) => ({ day, eq }));
}

function monthIndex(key) {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return null;
  return y * 12 + (m - 1);
}

/** EMA по дневной эквити. Первые span−1 дней без значения, дальше классическая EMA. */
export function emaSeries(values, span = EMA_SPAN) {
  const out = new Array(values.length).fill(null);
  if (!Number.isInteger(span) || span < 2 || values.length < span) return out;
  let sum = 0;
  for (let i = 0; i < span; i += 1) sum += values[i];
  let prev = sum / span;
  out[span - 1] = prev;
  const k = 2 / (span + 1);
  for (let i = span; i < values.length; i += 1) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function toMonthly(daily) {
  const last = new Map();
  for (const row of daily) last.set(monthKey(row.day), row);
  return [...last.keys()]
    .sort()
    .map((key) => {
      const row = last.get(key);
      return {
        month: key,
        day: row.day,
        equity: row.eq,
        ema100: row.ema100,
        segment: row.segment,
      };
    });
}

function yoyAndSma(monthly) {
  const byMonth = new Map(monthly.map((row) => [row.month, row]));
  const yoy = [];
  for (const row of monthly) {
    const idx = monthIndex(row.month);
    if (idx == null) continue;
    const prevKey = indexToMonth(idx - YOY_MONTHS);
    const prev = byMonth.get(prevKey);
    if (!prev || prev.equity <= 0) continue;
    yoy.push({
      month: row.month,
      day: row.day,
      yoy: row.equity / prev.equity - 1,
    });
  }
  const sma = new Array(yoy.length).fill(null);
  for (let i = 0; i < yoy.length; i += 1) {
    if (i + 1 < SMA_MONTHS) continue;
    let ok = true;
    for (let j = i - SMA_MONTHS + 1; j < i; j += 1) {
      const a = monthIndex(yoy[j].month);
      const b = monthIndex(yoy[j + 1].month);
      if (a == null || b == null || b - a !== 1) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    let sum = 0;
    for (let j = i - SMA_MONTHS + 1; j <= i; j += 1) sum += yoy[j].yoy;
    sma[i] = sum / SMA_MONTHS;
  }
  return yoy.map((row, i) => ({ ...row, sma36: sma[i] }));
}

function indexToMonth(index) {
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/**
 * @returns {{ok:true, joinDay:string, daily:object[], monthly:object[], yoy:object[]}
 *   | {ok:false, reason:string, joinDay?:string, paperStart?:string, backtestEnd?:string}}
 */
export function stitchEquity(backtestPoints, paperPoints) {
  const backtest = collapseDays(backtestPoints);
  const paper = collapseDays(paperPoints);
  if (paper.length < 1) return { ok: false, reason: "no_paper" };
  if (backtest.length < 2) return { ok: false, reason: "no_backtest" };
  if (backtest.some((row) => row.eq < 0) || paper.some((row) => row.eq < 0)) {
    return { ok: false, reason: "negative_equity" };
  }
  const paperStart = paper[0].day;
  const paper0 = paper[0].eq;
  let join = null;
  for (const row of backtest) {
    if (row.day <= paperStart) join = row;
  }
  if (!join) {
    return {
      ok: false,
      reason: "backtest_after_paper",
      paperStart,
      backtestEnd: backtest[backtest.length - 1].day,
    };
  }
  const gap = daysBetween(join.day, paperStart);
  if (gap > GAP_DAYS) {
    return {
      ok: false,
      reason: "gap",
      joinDay: join.day,
      paperStart,
      backtestEnd: join.day,
    };
  }
  const head = backtest.filter((row) => row.day < paperStart).map((row) => ({
    day: row.day,
    eq: row.eq,
    segment: "backtest",
  }));
  const tail = paper.map((row) => ({
    day: row.day,
    eq: paper0 > 0 ? (join.eq * row.eq) / paper0 : row.eq,
    segment: "paper",
  }));
  const dailyRaw = [...head, ...tail];
  const emas = emaSeries(dailyRaw.map((row) => row.eq), EMA_SPAN);
  const daily = dailyRaw.map((row, i) => ({ ...row, ema100: emas[i] }));
  const monthly = toMonthly(daily);
  const yoy = yoyAndSma(monthly);
  return { ok: true, joinDay: join.day, paperStart, daily, monthly, yoy };
}

export function seriesKey(account) {
  return resetSeriesKey(account) || `${account?.bot_id}::${account?.account_id}`;
}

/**
 * Для склейки берём накопленный history.json (после reset_from), иначе точки карточки.
 * Иначе у Юань 360 короткий account.history даёт дыру > 7 дней.
 */
export function stitchPaperPoints(account, cardPoints, history) {
  const key = seriesKey(account);
  const histPts = history?.series?.[key]?.points;
  const raw = Array.isArray(histPts) && histPts.length ? histPts : cardPoints || [];
  return filterResetPoints(key, raw);
}

export const EXTRA_HONESTY_BY_KEY = {
  "three_robots_okx_nasdaq_1h::paper_block2":
    "Издержки не совпадают: в бэктесте 3 б.п. на сделку без funding, бумажная книга не списывает ни комиссию, ни funding.",
  "eth_okx_moex::eth_okx_moex":
    "В бэктесте не учтены целые контракты, ГО и дисконт LQDT.",
};

export function extraHonestyLine(account) {
  return EXTRA_HONESTY_BY_KEY[seriesKey(account)] || "";
}

export function backtestRowFor(backtests, account) {
  const key = seriesKey(account);
  const row = backtests?.series?.[key];
  return row && typeof row === "object" ? row : null;
}

export function backtestPointsFor(backtests, account) {
  const row = backtestRowFor(backtests, account);
  return Array.isArray(row?.points) ? row.points : [];
}

/** Честная пометка типа бэктеста. Неизвестный kind — пустая строка. */
export function kindHonestyLine(kind) {
  if (kind == null || kind === "") return "";
  const k = String(kind);
  if (k === "backtest_full_preregistered") {
    return "Бэктест: правила зафиксированы заранее.";
  }
  if (k === "backtest_is_to_2026-09-08_then_oos") {
    return "Бэктест: in-sample до 08.09.2026, дальше вне выборки.";
  }
  if (k.startsWith("backtest_in_sample_")) {
    return "Бэктест: только in-sample, параметры подбирались на этом же окне.";
  }
  return "";
}

export function backtestHonestyLines(row, account) {
  const lines = [];
  const kind = kindHonestyLine(row?.kind);
  if (kind) lines.push(kind);
  const costs = row?.costs == null ? "" : String(row.costs).trim();
  if (costs) lines.push(costs);
  const extra = extraHonestyLine(account);
  if (extra) lines.push(extra);
  return lines;
}

export function stitchCaption(result) {
  if (!result || result.ok) return "";
  if (result.reason === "no_backtest") {
    return "Склейки нет: нет дневного бэктеста до старта бумаги.";
  }
  if (result.reason === "no_paper") {
    return "Склейки нет: у бумаги ещё нет точек эквити.";
  }
  if (result.reason === "gap") {
    return `Склейки нет: бэктест кончается ${result.backtestEnd}, бумага начинается ${result.paperStart}. Дыра больше ${GAP_DAYS} дней.`;
  }
  if (result.reason === "backtest_after_paper") {
    return "Склейки нет: бэктест начинается позже бумаги.";
  }
  if (result.reason === "negative_equity") {
    return "Склейки нет: отрицательная стоимость счёта.";
  }
  return "Склейки нет.";
}
