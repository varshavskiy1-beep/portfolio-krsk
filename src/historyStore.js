/**
 * Чтение и запись history.json для sync-equity.
 * Пустая история — только если файла нет. Битый JSON не перезаписываем.
 */
import fs from "node:fs";
import path from "node:path";

export const EMPTY_HISTORY = {
  schema: "equity_history.v1",
  updated_at: null,
  series: {},
};

export const HISTORY_POINT_CAP = 20000;

export function loadHistoryFile(historyPath) {
  let text;
  try {
    text = fs.readFileSync(historyPath, "utf8");
  } catch (e) {
    if (e && e.code === "ENOENT") {
      return { ...EMPTY_HISTORY, series: {} };
    }
    throw e;
  }
  return JSON.parse(text);
}

export function writeJsonAtomic(filePath, obj, { trailingNewline = false } = {}) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const bak = `${filePath}.bak`;
  const body = `${JSON.stringify(obj, null, 2)}${trailingNewline ? "\n" : ""}`;
  fs.writeFileSync(tmp, body);
  if (fs.existsSync(filePath)) fs.copyFileSync(filePath, bak);
  fs.renameSync(tmp, filePath);
}

function dayKey(t) {
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) return String(t || "").slice(0, 10);
  return new Date(ms).toISOString().slice(0, 10);
}

function lastOfEachDayKeepFirst(points) {
  if (!points.length) return [];
  const first = points[0];
  const byDay = new Map();
  for (const p of points) byDay.set(dayKey(p.t), p);
  const rows = [...byDay.values()].sort(
    (a, b) => (Date.parse(a.t) || 0) - (Date.parse(b.t) || 0),
  );
  if (rows.some((p) => p.t === first.t)) {
    return rows[0].t === first.t ? rows : [first, ...rows.filter((p) => p.t !== first.t)];
  }
  return [first, ...rows.filter((p) => p.t !== first.t)];
}

function mergeThinned(points, split, first) {
  const prefix = points.slice(0, split);
  const suffix = points.slice(split);
  const head = lastOfEachDayKeepFirst(prefix);
  const startMs = suffix.length ? Date.parse(suffix[0].t) : Infinity;
  const merged = [
    ...head.filter((p) => !Number.isFinite(startMs) || (Date.parse(p.t) || 0) < startMs),
    ...suffix,
  ];
  if (!merged.length || merged[0].t !== first.t) merged.unshift(first);
  return merged;
}

/**
 * При превышении лимита старое сжимается до одной точки в сутки.
 * Первая точка ряда (старт) не удаляется.
 */
export function capHistoryPoints(points, maxPoints = HISTORY_POINT_CAP) {
  if (!Array.isArray(points) || points.length <= maxPoints) return points;
  const first = points[0];
  const n = points.length;
  let lo = 0;
  let hi = n;
  let best = mergeThinned(points, n, first);
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const merged = mergeThinned(points, mid, first);
    if (merged.length <= maxPoints) {
      best = merged;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  if (best.length <= maxPoints && best[0]?.t === first.t) return best;
  const daily = lastOfEachDayKeepFirst(points);
  if (!daily.length || daily[0].t !== first.t) daily.unshift(first);
  if (daily.length <= maxPoints) return daily;
  return [daily[0], ...daily.slice(-(maxPoints - 1))];
}
