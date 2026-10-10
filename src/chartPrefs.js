/**
 * Режим и период графика: по умолчанию «В %» за всё время.
 * Если пользователь уже выбирал — читаем localStorage и не перетираем.
 */

export const DEFAULT_CHART_MODE = "pct";
export const DEFAULT_CHART_RANGE = "all";

export const CHART_MODE_KEYS = ["portfolio_krsk.chartMode", "chartMode", "chart-mode"];
export const CHART_RANGE_KEYS = ["portfolio_krsk.chartRange", "chartRange", "chart-range"];

function storage() {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function readFirst(keys, allowed) {
  const ls = storage();
  if (!ls) return null;
  for (const key of keys) {
    let raw;
    try {
      raw = ls.getItem(key);
    } catch {
      continue;
    }
    if (raw == null || raw === "") continue;
    const v = String(raw).trim();
    if (allowed.has(v)) return v;
  }
  return null;
}

export function readStoredChartMode() {
  return readFirst(CHART_MODE_KEYS, new Set(["pct", "money"]));
}

export function readStoredChartRange() {
  return readFirst(CHART_RANGE_KEYS, new Set(["all", "1d", "1w", "1m", "1y"]));
}

export function initialChartMode() {
  return readStoredChartMode() || DEFAULT_CHART_MODE;
}

export function initialChartRange() {
  return readStoredChartRange() || DEFAULT_CHART_RANGE;
}

export function persistChartMode(mode) {
  if (mode !== "pct" && mode !== "money") return;
  const ls = storage();
  if (!ls) return;
  try {
    ls.setItem(CHART_MODE_KEYS[0], mode);
  } catch {
    /* quota / private mode */
  }
}

export function persistChartRange(range) {
  if (!["all", "1d", "1w", "1m", "1y"].includes(range)) return;
  const ls = storage();
  if (!ls) return;
  try {
    ls.setItem(CHART_RANGE_KEYS[0], range);
  } catch {
    /* quota / private mode */
  }
}
