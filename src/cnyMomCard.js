/**
 * Карточка «Юань 360»: бумажный рублёвый счёт.
 * Линия — только поле history из снимка. Индексные тикеры в таблицу не идут.
 */

import { RATE_CYCLE_HIDDEN_SYMBOLS, RATE_CYCLE_OPENED_LINE, parseFeedNumber } from "./rateCycleCard.js";
import { isEmptyEquityField, isCnyMomH360 } from "./strategyMeta.js";
import { displayNote, formatMoneyRu } from "./uiCopy.js";

export const CNY_MOM_OPENED_LINE = RATE_CYCLE_OPENED_LINE;

const CR_FUTURES = /^CR[FGHJKMNQUVXZ]\d{1,2}$/;

export function normalizeCnySymbol(symbol) {
  return String(symbol || "").trim().toUpperCase();
}

export function isCnyMomHiddenIndexSymbol(symbol) {
  const s = normalizeCnySymbol(symbol);
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

function hasNonZeroQty(position) {
  const n = parseFeedNumber(position?.qty);
  return n != null && n !== 0;
}

/** Книга: паи LQDT и фьючерс CR (корень или ближайший контракт), qty ≠ 0. */
export function isCnyMomPaperSymbol(symbol) {
  const s = normalizeCnySymbol(symbol);
  if (!s || isCnyMomHiddenIndexSymbol(s)) return false;
  if (s === "LQDT" || s === "CR") return true;
  return CR_FUTURES.test(s);
}

export function visibleCnyMomPositions(account) {
  const raw = Array.isArray(account?.positions) ? account.positions : [];
  if (!isCnyMomH360(account)) return raw;
  return raw.filter((p) => isCnyMomPaperSymbol(p?.symbol) && hasNonZeroQty(p));
}

/** Цифры карточки: объект есть и equity не пустой. */
export function hasCnyMomAccountLine(account) {
  if (!isCnyMomH360(account)) return false;
  if (account.no_data) return false;
  return !isEmptyEquityField(account.equity);
}

export function cnyMomFallbackNote(account) {
  const seed = parseFeedNumber(account?.seed);
  const start = seed != null ? formatMoneyRu(seed, "RUB") : "300 000";
  return `Бумага: старт ${start} ₽ в паях LQDT. Раз в час смотрит 360 часовых закрытий фьючерса юаня. Номинал фьючерса — 2,5 капитала, когда будет задан дисконт пая. Пока дисконта нет, фьючерс не открывается. На биржу ордера не идут. На Автоследование не выводится.`;
}

export function cnyMomDescription(account) {
  const note = String(account?.note || "").trim();
  if (note && !noteHasHiddenIndex(note)) return displayNote(note, account);
  return cnyMomFallbackNote(account);
}

export function cnyMomHistoryPoints(account) {
  if (!isCnyMomH360(account) || !hasCnyMomAccountLine(account)) return [];
  const hist = Array.isArray(account.history) ? account.history : [];
  return hist.filter((p) => p && (p.t || p.time) && p.equity != null && p.equity !== "");
}

export function cnyMomOpenedLine(account) {
  if (!hasCnyMomAccountLine(account)) return "";
  return cnyMomHistoryPoints(account).length === 1 ? CNY_MOM_OPENED_LINE : "";
}

export function cnyMomFromStartPctLine(account) {
  if (!hasCnyMomAccountLine(account)) return "";
  const seed = parseFeedNumber(account.seed);
  const equity = parseFeedNumber(account.equity);
  if (seed == null || equity == null || seed === 0) return "";
  const pct = ((equity - seed) / seed) * 100;
  const abs = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(pct));
  const sign = pct >= 0 ? "+" : "−";
  return `${sign}${abs}% от старта`;
}
