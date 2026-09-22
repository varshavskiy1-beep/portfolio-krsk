/**
 * Пользовательские подписи. Слово seed в интерфейсе не показываем:
 * это стартовый / начальный капитал счёта.
 */

export function formatMoneyRu(n, currency) {
  if (n == null || Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: currency === "RUB" ? 0 : 2,
    }).format(n);
  } catch {
    return String(n);
  }
}

/** «от начального капитала 1 500 000» + опционально дельта. */
export function fromCapitalLine({ seed, currency, delta, pct }) {
  const seedTxt = formatMoneyRu(seed, currency);
  let line = `от начального капитала ${seedTxt}`;
  if (delta == null || Number.isNaN(delta)) return line;
  const sign = delta >= 0 ? "+" : "";
  const pctPart =
    pct != null && !Number.isNaN(pct)
      ? ` (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)`
      : "";
  return `${line}: ${sign}${formatMoneyRu(delta, currency)}${pctPart}`;
}

/** Технические note из снимка: seed → «начальный капитал». */
export function displayNote(note) {
  if (note == null || note === "") return "";
  return String(note).replace(/\bseed\b/gi, "начальный капитал");
}
