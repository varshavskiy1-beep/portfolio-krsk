/**
 * Карточка «Цикл ставки 80/20: дальние облигации и юань».
 * Шкала — индекс богатства, не рубли. Числа линии только из фида.
 * Блок истории — статический канон, не снимок.
 */

import { RF_BONDS_RATE_CYCLE_LOGIC, isRfBondsRateCycle } from "./strategyMeta.js";

export const RATE_CYCLE_LOGIC_LINE = RF_BONDS_RATE_CYCLE_LOGIC;

export const INDEX_CURRENCY = "индекс";

export const RATE_CYCLE_COMPOSITION =
  "Состав: индекс RUCBTR5YNS (дальняя часть) и индекс RUCBITR1Y (ближняя часть). Пока последнее изменение ключевой ставки — снижение и ему не больше 52 недель: 80% дальняя, 20% ближняя, сверху спот CNYRUB_TOM на 20% капитала. Иначе 20/80 и юань 0. Облигации без плеча. Юань не заём.";

export const RATE_CYCLE_HISTORY_LABEL = "история, не живой счёт";

export const RATE_CYCLE_HISTORY_LINES = [
  "окно 2019-06-28…2026-10-09, 377 недель, CAGR 13,1%, просадка −5,6%.",
  "На метке 2026-10-09 решение: 80% дальняя / 20% ближняя и юань 20%, ключевая 14%, возраст последнего изменения 10 (недель).",
  "Неделя — черновик, пока пятница 2026-10-09 не закрыта.",
];

const OPTIONAL_WEIGHTS = [
  ["far_pct", "дальняя"],
  ["near_pct", "ближняя"],
  ["cny_pct", "юань"],
  ["far_weight", "дальняя"],
  ["near_weight", "ближняя"],
  ["cny_weight", "юань"],
];

export function parseFeedNumber(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Индекс: русская запятая, до 4 знаков. Без ₽ и без RUB. */
export function formatIndexRu(n) {
  const v = parseFeedNumber(n);
  if (v == null) return null;
  try {
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: Number.isInteger(v) ? 0 : 1,
      maximumFractionDigits: 4,
    }).format(v);
  } catch {
    const s = Number.isInteger(v) ? String(v) : v.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
    return s.replace(".", ",");
  }
}

export function formatPctRu(n, digits = 2) {
  const v = parseFeedNumber(n);
  if (v == null) return null;
  try {
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(v);
  } catch {
    return v.toFixed(digits).replace(".", ",");
  }
}

function lastEquityScalar(account) {
  if (!account) return null;
  const eq = account.equity;
  if (Array.isArray(eq)) {
    for (let i = eq.length - 1; i >= 0; i--) {
      const n = parseFeedNumber(eq[i]?.equity ?? eq[i]?.value ?? eq[i]);
      if (n != null) return n;
    }
    return null;
  }
  return parseFeedNumber(eq);
}

export function formatIndexEquity(account, equity) {
  if (!isRfBondsRateCycle(account)) return "";
  const n = equity == null ? lastEquityScalar(account) : parseFeedNumber(equity);
  const txt = formatIndexRu(n);
  return txt || "";
}

/** «+144,19% от старта» — отношение к seed фида, не суммы. */
export function fromStartPctLine(account) {
  if (!isRfBondsRateCycle(account)) return "";
  const seed = parseFeedNumber(account.seed);
  const equity = lastEquityScalar(account);
  if (seed == null || equity == null || seed === 0) return "";
  const pct = ((equity - seed) / seed) * 100;
  const abs = formatPctRu(Math.abs(pct), 2);
  if (abs == null) return "";
  const sign = pct >= 0 ? "+" : "−";
  return `${sign}${abs}% от старта`;
}

export function optionalFeedLines(account) {
  if (!account || !isRfBondsRateCycle(account)) return [];
  const lines = [];
  if (account.regime != null && account.regime !== "") {
    lines.push({ kind: "regime", text: `режим ${String(account.regime)}` });
  }
  const weights = [];
  for (const [field, label] of OPTIONAL_WEIGHTS) {
    if (account[field] == null || account[field] === "") continue;
    const n = parseFeedNumber(account[field]);
    if (n == null) continue;
    const asPct = field.endsWith("_pct") ? n : n;
    const shown = formatIndexRu(asPct);
    if (shown) weights.push(`${label} ${shown}${field.endsWith("_pct") ? "%" : ""}`);
  }
  if (weights.length) lines.push({ kind: "weights", text: weights.join(", ") });
  const kr = parseFeedNumber(account.key_rate_pct);
  if (account.key_rate_pct != null && account.key_rate_pct !== "" && kr != null) {
    const shown = formatIndexRu(kr);
    if (shown) lines.push({ kind: "key_rate", text: `ключевая ${shown}%` });
  }
  return lines;
}

export function chartMoneyLabel(account) {
  return isRfBondsRateCycle(account) ? "Индекс" : "В деньгах";
}

export function chartPriceDigits(currency) {
  if (currency === "RUB") return 0;
  if (currency === INDEX_CURRENCY) return 4;
  return 2;
}
