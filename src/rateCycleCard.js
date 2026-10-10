/**
 * Карточка «Цикл ставки 80/20»: бумажный рублёвый счёт.
 * Линия — только поле history из снимка. Индексные тикеры в таблицу не идут.
 */

import { isEmptyEquityField, isRfBondsRateCycle } from "./strategyMeta.js";
import { displayNote, formatMoneyRu } from "./uiCopy.js";

export const RATE_CYCLE_HIDDEN_SYMBOLS = ["RUCBTR5YNS", "RUCBITR1Y", "CNYRUB_TOM"];

export const RATE_CYCLE_OPENED_LINE = "Счёт только открыт, история копится.";

const CR_FUTURES = /^CR[FGHJKMNQUVXZ]\d{1,2}$/;

export function parseFeedNumber(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase();
}

export function isRateCycleHiddenIndexSymbol(symbol) {
  const s = normalizeSymbol(symbol);
  if (!s) return false;
  if (RATE_CYCLE_HIDDEN_SYMBOLS.includes(s)) return true;
  return s.startsWith("CNYRUB");
}

function noteHasHiddenIndex(text) {
  const upper = String(text || "").toUpperCase();
  if (!upper) return false;
  if (RATE_CYCLE_HIDDEN_SYMBOLS.some((s) => upper.includes(s))) return true;
  return upper.includes("CNYRUB");
}

/** Бумаги книги: паи OBLG/SBRB и фьючерс CR (корень или ближайший контракт). */
export function isRateCyclePaperSymbol(symbol) {
  const s = normalizeSymbol(symbol);
  if (!s || isRateCycleHiddenIndexSymbol(s)) return false;
  if (s === "OBLG" || s === "SBRB" || s === "CR") return true;
  return CR_FUTURES.test(s);
}

export function visibleRateCyclePositions(account) {
  const raw = Array.isArray(account?.positions) ? account.positions : [];
  if (!isRfBondsRateCycle(account)) return raw;
  return raw.filter((p) => isRateCyclePaperSymbol(p?.symbol));
}

export function hasRateCyclePaperBook(account) {
  if (!isRfBondsRateCycle(account)) return false;
  return visibleRateCyclePositions(account).length > 0;
}

/** Цифры карточки: объект есть и equity не пустой. */
export function hasRateCycleAccountLine(account) {
  if (!isRfBondsRateCycle(account)) return false;
  if (account.no_data) return false;
  return !isEmptyEquityField(account.equity);
}

export function rateCycleFallbackNote(account) {
  const seed = parseFeedNumber(account?.seed);
  const start = seed != null ? formatMoneyRu(seed, "RUB") : "300 000";
  return `Бумага: старт ${start} ₽, 80% в OBLG и 20% в SBRB, сверху юань (фьючерс CR) на 20% капитала, пока цикл ставки включён. На биржу ордера не идут.`;
}

export function rateCycleDescription(account) {
  const note = String(account?.note || "").trim();
  if (note && !noteHasHiddenIndex(note)) return displayNote(note, account);
  return rateCycleFallbackNote(account);
}

export function rateCycleHistoryPoints(account) {
  if (!isRfBondsRateCycle(account) || !hasRateCycleAccountLine(account)) return [];
  const hist = Array.isArray(account.history) ? account.history : [];
  return hist.filter((p) => p && (p.t || p.time) && p.equity != null && p.equity !== "");
}

export function rateCycleOpenedLine(account) {
  if (!hasRateCycleAccountLine(account)) return "";
  return rateCycleHistoryPoints(account).length === 1 ? RATE_CYCLE_OPENED_LINE : "";
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

export function fromStartPctLine(account) {
  if (!hasRateCycleAccountLine(account)) return "";
  const seed = parseFeedNumber(account.seed);
  const equity = parseFeedNumber(account.equity);
  if (seed == null || equity == null || seed === 0) return "";
  const pct = ((equity - seed) / seed) * 100;
  const abs = formatPctRu(Math.abs(pct), 2);
  if (abs == null) return "";
  const sign = pct >= 0 ? "+" : "−";
  return `${sign}${abs}% от старта`;
}

export function chartMoneyLabel() {
  return "В деньгах";
}

export function chartPriceDigits(currency) {
  if (currency === "RUB") return 0;
  return 2;
}
