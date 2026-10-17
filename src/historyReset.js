/**
 * Отсечки сохранённой истории. Старые точки до reset_from не рисуем
 * и не возвращаем при синке в public/data/history.json.
 */

export const PAPER_BLOCK2_SERIES_KEY = "three_robots_okx_nasdaq_1h::paper_block2";
export const PAPER_BLOCK2_RESET_FROM = "2026-10-15T08:57:31Z";
export const PAPER_BLOCK2_RESET_EQUITY = 10000;
export const PAPER_BLOCK2_RESET_LINE =
  "Счёт обнулён 15.10 после исправления, история копится.";

export const V6B1_SERIES_KEY = "v6b1::v6b1";
export const V6B1_RESET_FROM = "2026-10-15T17:27:12Z";
export const V6B1_RESET_EQUITY = 10000;

/** Индекс богатства ~2,44 до перевода книги в рубли. Первая рублёвая точка ≈ 300 000. */
export const RATE_CYCLE_SERIES_KEY = "rf_bonds_rate_cycle::rf_bonds_rate_cycle";
export const RATE_CYCLE_RESET_FROM = "2026-10-10T08:13:19Z";
export const RATE_CYCLE_RESET_EQUITY = 300000;
export const RATE_CYCLE_RESET_LINE =
  "Индексная точка до перевода книги в рубли скрыта; дальше учёт в рублях.";

export const HISTORY_RESETS = {
  [PAPER_BLOCK2_SERIES_KEY]: {
    resetFrom: PAPER_BLOCK2_RESET_FROM,
    seedPoint: { t: PAPER_BLOCK2_RESET_FROM, equity: PAPER_BLOCK2_RESET_EQUITY },
    caption: PAPER_BLOCK2_RESET_LINE,
  },
  [V6B1_SERIES_KEY]: {
    resetFrom: V6B1_RESET_FROM,
    seedPoint: { t: V6B1_RESET_FROM, equity: V6B1_RESET_EQUITY },
    caption: PAPER_BLOCK2_RESET_LINE,
  },
  [RATE_CYCLE_SERIES_KEY]: {
    resetFrom: RATE_CYCLE_RESET_FROM,
    seedPoint: { t: RATE_CYCLE_RESET_FROM, equity: RATE_CYCLE_RESET_EQUITY },
    caption: RATE_CYCLE_RESET_LINE,
  },
};

export function seriesKey(account) {
  if (!account) return "";
  return `${account.bot_id}::${account.account_id}`;
}

export function pointTimeMs(t) {
  if (t == null || t === "") return null;
  if (typeof t === "number") {
    const ms = t > 1e12 ? t : t * 1000;
    return Number.isFinite(ms) ? ms : null;
  }
  const s = String(t);
  const ms = Date.parse(s.length === 10 ? `${s}T00:00:00Z` : s);
  return Number.isNaN(ms) ? null : ms;
}

export function isBeforeReset(t, resetFrom) {
  const a = pointTimeMs(t);
  const b = pointTimeMs(resetFrom);
  if (a == null || b == null) return false;
  return a < b;
}

export function filterResetPoints(key, points, { ensureSeed = false } = {}) {
  const spec = HISTORY_RESETS[key];
  if (!spec) return Array.isArray(points) ? points : [];
  const kept = (points || []).filter((p) => {
    if (!p) return false;
    const t = p.t ?? p.time;
    return !isBeforeReset(t, spec.resetFrom);
  });
  if (!kept.length && ensureSeed) return [{ ...spec.seedPoint }];
  return kept;
}

/** Чистит hist.series на месте. Возвращает сводку по затронутым ключам. */
export function applyHistoryResets(hist) {
  const report = [];
  if (!hist?.series) return report;
  for (const [key, spec] of Object.entries(HISTORY_RESETS)) {
    const series = hist.series[key];
    if (!series) {
      hist.series[key] = {
        bot_id: key.split("::")[0],
        account_id: key.split("::")[1],
        points: [{ ...spec.seedPoint }],
      };
      report.push({ key, removed: 0, kept: 1, seeded: true });
      continue;
    }
    const before = Array.isArray(series.points) ? series.points.length : 0;
    series.points = filterResetPoints(key, series.points, { ensureSeed: true });
    report.push({
      key,
      removed: Math.max(0, before - series.points.length),
      kept: series.points.length,
      seeded: before === 0 || (before > 0 && series.points.length === 1 && before !== 1),
    });
  }
  return report;
}

export function shouldAppendHistoryPoint(key, ts) {
  const spec = HISTORY_RESETS[key];
  if (!spec) return true;
  return !isBeforeReset(ts, spec.resetFrom);
}

export function historyResetLine(account, historyPoints) {
  const key = seriesKey(account);
  const spec = HISTORY_RESETS[key];
  if (!spec) return "";
  const pts = filterResetPoints(key, historyPoints || []);
  const days = new Set();
  for (const p of pts) {
    const t = p?.t ?? p?.time;
    if (!t) continue;
    days.add(String(t).slice(0, 10));
  }
  if (days.size > 1) return "";
  return spec.caption || PAPER_BLOCK2_RESET_LINE;
}

export function robot2ResetLine(account, historyPoints) {
  if (!account || seriesKey(account) !== PAPER_BLOCK2_SERIES_KEY) return "";
  return historyResetLine(account, historyPoints);
}
