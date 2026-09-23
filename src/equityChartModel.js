/**
 * Цвет графика = знак PnL от начального капитала (поле JSON `seed`).
 * Ряд начинается с equity = начальный капитал: если такой точки нет —
 * клеим синтетическую (день до первой реальной). Одна реальная точка
 * тоже даёт видимую линию (seed → факт или горизонталь).
 * Ось Y обязана включать этот уровень (в % — 0%).
 */

export const CHART_POS = {
  lineColor: "#1f7a4c",
  topColor: "rgba(31, 122, 76, 0.28)",
  bottomColor: "rgba(31, 122, 76, 0.02)",
  priceLineColor: "#1f7a4c",
};

export const CHART_NEG = {
  lineColor: "#a33",
  topColor: "rgba(170, 51, 51, 0.25)",
  bottomColor: "rgba(170, 51, 51, 0.02)",
  priceLineColor: "#a33",
};

export const DAY_SEC = 24 * 3600;
export const RANGE_1M_SEC = 30 * DAY_SEC;

export function toUnix(t) {
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

export function parseSeed(seed) {
  const seedN = seed == null || seed === "" ? NaN : Number(seed);
  return Number.isFinite(seedN) ? seedN : null;
}

/** Точка уже равна начальному капиталу — вторую на этом уровне не клеим. */
export function isAlreadySeed(equity, seedN) {
  if (!Number.isFinite(seedN) || !Number.isFinite(equity)) return false;
  return Math.abs(equity - seedN) <= Math.max(1e-6, Math.abs(seedN) * 1e-9);
}

function parsePoint(p) {
  const time = toUnix(p?.t);
  const eq = p?.equity == null || p.equity === "" ? null : Number(p.equity);
  if (time == null || eq == null || Number.isNaN(eq)) return null;
  return { time, eq };
}

export function normalizePoints(points) {
  const raw = [];
  for (const p of points || []) {
    const row = parsePoint(p);
    if (row) raw.push(row);
  }
  raw.sort((a, b) => a.time - b.time);
  const dedup = [];
  for (const row of raw) {
    if (dedup.length && dedup[dedup.length - 1].time === row.time) dedup[dedup.length - 1] = row;
    else dedup.push(row);
  }
  return dedup;
}

/**
 * Кривая для карточки: equity_curve счёта, иначе history.series[bot::account].
 * Пустой массив equity_curve не перекрывает историю (иначе карточка без Area).
 */
export function resolveEquityPoints(account, history) {
  if (!account || account.no_data) return [];
  if (Array.isArray(account.equity_curve) && account.equity_curve.length) {
    return account.equity_curve;
  }
  const key = `${account.bot_id}::${account.account_id}`;
  return history?.series?.[key]?.points || [];
}

function prependSeedBaseline(dedup, seedN) {
  if (!Number.isFinite(seedN) || !dedup.length) return dedup;
  if (isAlreadySeed(dedup[0].eq, seedN)) return dedup;
  const t0 = dedup[0].time - DAY_SEC;
  if (t0 >= dedup[0].time) return dedup;
  return [{ time: t0, eq: seedN }, ...dedup];
}

/** Одна точка → линия seed→факт или горизонталь, чтобы Area не была пустой. */
function ensureDrawableSeries(dedup, seedN) {
  const withSeed = prependSeedBaseline(dedup, seedN);
  if (withSeed.length >= 2) return withSeed;
  if (!withSeed.length) return withSeed;
  const only = withSeed[0];
  const t0 = only.time - DAY_SEC;
  const startEq = Number.isFinite(seedN) ? seedN : only.eq;
  if (t0 >= only.time) return withSeed;
  return [{ time: t0, eq: startEq }, only];
}

/** Уровень начального капитала на оси: 0% или сумма seed. */
export function seedAxisValue(seed, mode) {
  const seedN = parseSeed(seed);
  if (seedN == null) return null;
  return mode === "pct" ? 0 : seedN;
}

function padFlatRange(minValue, maxValue, mode) {
  if (minValue !== maxValue) return { minValue, maxValue };
  const pad = mode === "pct" ? 1 : Math.max(Math.abs(minValue) * 0.01, 1);
  return { minValue: minValue - pad, maxValue: maxValue + pad };
}

/** Ось Y всегда захватывает начальный капитал, не только пик окна. */
export function expandPriceRange(range, seed, mode) {
  if (!range || !Number.isFinite(range.minValue) || !Number.isFinite(range.maxValue)) return range;
  const anchor = seedAxisValue(seed, mode);
  let minValue = range.minValue;
  let maxValue = range.maxValue;
  if (anchor != null) {
    minValue = Math.min(minValue, anchor);
    maxValue = Math.max(maxValue, anchor);
  }
  return padFlatRange(minValue, maxValue, mode);
}

export function priceRangeIncludingSeed(series, seed, mode) {
  const vals = (series || []).map((p) => p.value).filter((v) => Number.isFinite(v));
  if (!vals.length) {
    const anchor = seedAxisValue(seed, mode);
    if (anchor == null) return null;
    return padFlatRange(anchor, anchor, mode);
  }
  return expandPriceRange(
    { minValue: Math.min(...vals), maxValue: Math.max(...vals) },
    seed,
    mode,
  );
}

export function buildSeries(points, seed, mode) {
  const seedN = parseSeed(seed);
  const dedup = normalizePoints(points);
  if (!dedup.length) return [];
  const rows = ensureDrawableSeries(dedup, seedN);
  const base = mode === "pct" ? (seedN && seedN !== 0 ? seedN : rows[0].eq) : null;
  return rows.map(({ time, eq }) => ({
    time,
    value: mode === "pct" ? ((eq - base) / base) * 100 : eq,
  }));
}

/**
 * Короткая история (весь ряд короче 1М) — по умолчанию «Всё», чтобы
 * синтетический seed и все реальные точки были в кадре. Длинный ряд — «1М».
 */
export function defaultChartRange(series) {
  if (!series || series.length < 2) return "all";
  const span = series[series.length - 1].time - series[0].time;
  return span < RANGE_1M_SEC ? "all" : "1m";
}

/**
 * @param {{ value: number }[]} series — уже через buildSeries
 * @param {number|string|null|undefined} seed
 * @param {"pct"|"money"} mode
 * @returns {boolean} true → зелёный (текущая эквити ≥ seed)
 */
export function isChartUpVsSeed(series, seed, mode) {
  if (!series.length) return true;
  const last = series[series.length - 1].value;
  if (!Number.isFinite(last)) return true;
  if (mode === "pct") return last >= 0;
  const seedN = parseSeed(seed);
  if (seedN != null) return last >= seedN;
  return last >= series[0].value;
}

export function chartSeriesColors(up) {
  return up ? CHART_POS : CHART_NEG;
}
