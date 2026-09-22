/**
 * Цвет графика эквити = знак PnL от seed (как в шапке «от seed …»),
 * а не наклон линии внутри выбранного окна 1Д/1Н/1М.
 *
 * Если seed известен и первая реальная точка далеко от него, в серию
 * добавляется синтетическая база (equity = seed, время = сутки до первой
 * точки). Тогда короткая история показывает рост от старта, а не только
 * последний отрезок просадки.
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
/** Первая точка «уже у seed» — синтетическую базу не добавляем. */
export const NEAR_SEED_REL = 0.01;

export function toUnix(t) {
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

export function isNearSeed(equity, seedN) {
  if (!Number.isFinite(seedN) || seedN === 0 || !Number.isFinite(equity)) return false;
  return Math.abs(equity - seedN) / Math.abs(seedN) <= NEAR_SEED_REL;
}

function prependSeedBaseline(dedup, seedN) {
  if (!Number.isFinite(seedN) || !dedup.length) return dedup;
  if (isNearSeed(dedup[0].eq, seedN)) return dedup;
  const t0 = dedup[0].time - DAY_SEC;
  if (t0 >= dedup[0].time) return dedup;
  return [{ time: t0, eq: seedN }, ...dedup];
}

export function buildSeries(points, seed, mode) {
  const seedN = seed == null || seed === "" ? null : Number(seed);
  const raw = [];
  for (const p of points || []) {
    const time = toUnix(p.t);
    const eq = p.equity == null || p.equity === "" ? null : Number(p.equity);
    if (time == null || eq == null || Number.isNaN(eq)) continue;
    raw.push({ time, eq });
  }
  raw.sort((a, b) => a.time - b.time);
  const dedup = [];
  for (const row of raw) {
    if (dedup.length && dedup[dedup.length - 1].time === row.time) dedup[dedup.length - 1] = row;
    else dedup.push(row);
  }
  if (!dedup.length) return [];
  const withSeed = prependSeedBaseline(dedup, seedN);
  const base =
    mode === "pct" ? (seedN && seedN !== 0 ? seedN : withSeed[0].eq) : null;
  return withSeed.map(({ time, eq }) => ({
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
  const seedN = seed == null || seed === "" ? NaN : Number(seed);
  if (Number.isFinite(seedN)) return last >= seedN;
  return last >= series[0].value;
}

export function chartSeriesColors(up) {
  return up ? CHART_POS : CHART_NEG;
}
