/**
 * Карточка «Сигналы Офиса · Comon + Юань 360»: бумажный рублёвый счёт.
 * Линия — только history бумажной книги. Номинал MXI/CR к equity не прибавляем.
 * Replay W1/W2 в паспорт, не в кривую кабинета.
 */

import {
  collapseHistoryByDay,
  ethOkxMarkValue,
  hasTimeOfDay,
  timedHistoryPoints,
} from "./ethOkxCard.js";
import { parseFeedNumber, RATE_CYCLE_OPENED_LINE } from "./rateCycleCard.js";
import { isEmptyEquityField, isOfficeSignalsComonCny } from "./strategyMeta.js";
import { displayNote, formatMoneyRu, positionHasField } from "./uiCopy.js";

export const OFFICE_SIGNALS_OPENED_LINE = RATE_CYCLE_OPENED_LINE;

export const OFFICE_SIGNALS_FALLBACK_NOTE =
  "Бумага. «Сигналы Офиса · Comon + Юань 360» (Режим A · CR 1,0×), старт 1 000 000 ₽. На биржу ордера не идут.";

const MXI_FUTURES = /^MM[FGHJKMNQUVXZ]\d{1,2}$/;
const CR_FUTURES = /^CR[FGHJKMNQUVXZ]\d{1,2}$/;
const HIDDEN_INDEX = /^(IMOEXF|RUCBTR5YNS|RUCBITR1Y|CNYRUB)/;

export const OFFICE_SIGNALS_REGIMES = {
  STOCKS_MXI: "STOCKS_MXI",
  SMA40_PARK: "SMA40_PARK",
  CNY360_PARK: "CNY360_PARK",
};

const REGIME_LINE = {
  STOCKS_MXI: "Режим STOCKS_MXI: 8 акций IMOEX ∩ Comon и квартальный MXI 1,0×, юань закрыт.",
  SMA40_PARK: "Режим SMA40_PARK: весь капитал в FMMM, юань закрыт.",
  CNY360_PARK: "Режим CNY360_PARK: парковка FMMM с буфером 12% и лонг CR строго 1,0×.",
  INIT: "Режим INIT: робот ещё не принял первое торговое решение.",
};

export function normalizeOfficeSignalsSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase();
}

export function isOfficeSignalsHiddenSymbol(symbol) {
  const s = normalizeOfficeSignalsSymbol(symbol);
  return Boolean(s) && HIDDEN_INDEX.test(s);
}

export function isOfficeSignalsMxiSymbol(symbol) {
  const s = normalizeOfficeSignalsSymbol(symbol);
  return s === "MXI" || MXI_FUTURES.test(s);
}

export function isOfficeSignalsCnySymbol(symbol) {
  const s = normalizeOfficeSignalsSymbol(symbol);
  return s === "CR" || CR_FUTURES.test(s);
}

export function isOfficeSignalsParkingSymbol(symbol) {
  const s = normalizeOfficeSignalsSymbol(symbol);
  return s === "FMMM" || s === "LQDT";
}

/** Бумажная книга: акции TQBR, MM*, CR*, FMMM/LQDT. IMOEXF и индексы скрыты. */
export function isOfficeSignalsPaperSymbol(symbol) {
  const s = normalizeOfficeSignalsSymbol(symbol);
  if (!s || isOfficeSignalsHiddenSymbol(s)) return false;
  if (isOfficeSignalsParkingSymbol(s)) return true;
  if (isOfficeSignalsMxiSymbol(s) || isOfficeSignalsCnySymbol(s)) return true;
  if (/^[A-Z]{3,6}P?$/.test(s)) return true;
  return false;
}

function hasNonZeroQty(position) {
  const n = parseFeedNumber(position?.qty);
  return n != null && n !== 0;
}

export function visibleOfficeSignalsPositions(account) {
  const raw = Array.isArray(account?.positions) ? account.positions : [];
  if (!isOfficeSignalsComonCny(account)) return raw;
  return raw.filter((p) => isOfficeSignalsPaperSymbol(p?.symbol) && hasNonZeroQty(p));
}

/** Цифры карточки: объект есть и equity не пустой. */
export function hasOfficeSignalsAccountLine(account) {
  if (!isOfficeSignalsComonCny(account)) return false;
  if (account.no_data) return false;
  return !isEmptyEquityField(account.equity);
}

export function formatOfficeSignalsEquity(equity) {
  const n = parseFeedNumber(equity);
  if (n == null) return "—";
  try {
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return n.toFixed(2).replace(".", ",");
  }
}

export function officeSignalsEquityLine(account) {
  if (!hasOfficeSignalsAccountLine(account)) return "";
  return `${formatOfficeSignalsEquity(account.equity)} ₽`;
}

export function officeSignalsFallbackNote(account) {
  const seed = parseFeedNumber(account?.seed);
  if (seed == null) return OFFICE_SIGNALS_FALLBACK_NOTE;
  const start = formatMoneyRu(seed, "RUB");
  return `Бумага. «Сигналы Офиса · Comon + Юань 360» (Режим A · CR 1,0×), старт ${start} ₽. На биржу ордера не идут.`;
}

export function officeSignalsDescription(account) {
  const note = String(account?.note || "").trim();
  if (note) return displayNote(note, account);
  return officeSignalsFallbackNote(account);
}

export function officeSignalsHistoryPoints(account) {
  if (!isOfficeSignalsComonCny(account) || !hasOfficeSignalsAccountLine(account)) return [];
  const hist = Array.isArray(account.history) ? account.history : [];
  const raw = hist.filter((p) => p && (p.t || p.time) && p.equity != null && p.equity !== "");
  if (!raw.length) return [];
  if (raw.every(hasTimeOfDay)) return timedHistoryPoints(hist);
  return collapseHistoryByDay(raw);
}

export function officeSignalsOpenedLine(account) {
  if (!hasOfficeSignalsAccountLine(account)) return "";
  return officeSignalsHistoryPoints(account).length <= 1 ? OFFICE_SIGNALS_OPENED_LINE : "";
}

export function officeSignalsRegimeLine(account) {
  if (!hasOfficeSignalsAccountLine(account)) return "";
  const r = String(account.regime || "").trim();
  if (!r) return "";
  return REGIME_LINE[r] || `Режим ${r}.`;
}

export function officeSignalsFromStartPctLine(account) {
  if (!hasOfficeSignalsAccountLine(account)) return "";
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

/** Текущая отметка, иначе цена входа. */
export function officeSignalsMarkValue(position) {
  if (positionHasField(position, "mark")) return position.mark;
  if (positionHasField(position, "avg_px")) return position.avg_px;
  return ethOkxMarkValue(position);
}

export function formatOfficeSignalsMark(position) {
  const raw = officeSignalsMarkValue(position);
  const n = parseFeedNumber(raw);
  if (n == null) return raw == null || raw === "" ? "—" : String(raw);
  try {
    return new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: 4,
    }).format(n);
  } catch {
    return String(raw).replace(".", ",");
  }
}

/** cash — залог/остаток книги, не свободные деньги для вывода. */
export function officeSignalsCollateralLine() {
  return "";
}
