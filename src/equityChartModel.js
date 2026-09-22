/**
 * Цвет графика эквити = знак PnL от seed (как в шапке «от seed …»),
 * а не наклон линии внутри выбранного окна 1Д/1Н/1М.
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

export function toUnix(t) {
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
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
  const base =
    mode === "pct" ? (seedN && seedN !== 0 ? seedN : dedup[0].eq) : null;
  return dedup.map(({ time, eq }) => ({
    time,
    value: mode === "pct" ? ((eq - base) / base) * 100 : eq,
  }));
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
