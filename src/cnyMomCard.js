/**
 * Карточка «Юань 360»: бумажный рублёвый счёт.
 * Без replace — накопленный history.json (с открытия рублёвой книги) плюс поле history.
 * history_mode=replace / generation=cny-journal-capital-v1 — канон journal.capital
 * с 23 Oct; валидный prefix книги с 12 Oct 300000 сохраняется (cnyPrefix.js).
 * Индексные тикеры в таблицу не идут.
 */

import { RATE_CYCLE_HIDDEN_SYMBOLS, RATE_CYCLE_OPENED_LINE, parseFeedNumber } from "./rateCycleCard.js";
import { CNY_MOM_H360_SERIES_KEY, isEmptyEquityField, isCnyMomH360 } from "./strategyMeta.js";
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

export function cnyMomFuturesSnapshotLine(account) {
  const cr = visibleCnyMomPositions(account).find((p) => {
    const s = normalizeCnySymbol(p?.symbol);
    return s === "CR" || CR_FUTURES.test(s);
  });
  if (!cr) {
    return "В этом снимке ненулевого фьючерса CR нет.";
  }
  const qty = parseFeedNumber(cr.qty);
  const side = String(cr.side || "").trim() || "qty";
  const symbol = normalizeCnySymbol(cr.symbol);
  const qtyTxt = qty == null ? String(cr.qty) : String(qty);
  return `В снимке фьючерс ${symbol} ${side} ${qtyTxt}.`;
}

export function cnyMomFallbackNote(account) {
  const seed = parseFeedNumber(account?.seed);
  const start = seed != null ? formatMoneyRu(seed, "RUB") : "300 000";
  const fut = cnyMomFuturesSnapshotLine(account);
  return `Бумага: старт ${start} ₽ в паях LQDT. Раз в час смотрит 360 часовых закрытий фьючерса юаня. Номинал фьючерса — 2,5 капитала, когда задан дисконт пая. ${fut} На биржу ордера не идут. На Автоследование не выводится.`;
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

/** Первая рублёвая точка книги в history.json. Всё раньше — не этот счёт, не рисуем. */
export const CNY_MOM_BOOK_FROM = "2026-10-12T11:07:00Z";

/** Канон host journal.capital: принять целиком, не append к старой книге. */
export const CNY_JOURNAL_CAPITAL_GENERATION = "cny-journal-capital-v1";
/** Host journal start, naive (no timezone). Do not append Z. */
export const CNY_JOURNAL_FROM = "2026-10-23T08:00:00";
export const STALE_BUNDLED_CNY_UPDATED_UTC = "2026-10-24T05:21:02Z";
export const STALE_BUNDLED_CNY_EQUITY = 335539.3734402401;

function cnySeriesGeneration(series) {
  return String(series?.generation || "").trim();
}

function isCnyJournalGeneration(value) {
  return String(value || "").trim() === CNY_JOURNAL_CAPITAL_GENERATION;
}

/**
 * Снимок просит заменить ряд Юань 360 журналом (даже если points ещё пустые).
 * history_mode=replace на ETH/других id сюда не относится.
 */
export function isCnyJournalReplaceSignal(account) {
  if (!isCnyMomH360(account)) return false;
  const mode = String(account.history_mode || "").trim().toLowerCase();
  if (mode === "replace") return true;
  return isCnyJournalGeneration(account.generation);
}

export function isCnyJournalReplace(account) {
  return isCnyJournalReplaceSignal(account) && cnyJournalHistoryPoints(account).length > 0;
}

function isStaleBundledCnyEquity(equity) {
  const n = Number(equity);
  return Number.isFinite(n) && Math.abs(n - STALE_BUNDLED_CNY_EQUITY) < 1e-4;
}

/** Залипший bundled 24 Oct 335539 / +11,85% — не live journal. */
export function isStaleBundledCnyAccount(account) {
  if (!isCnyMomH360(account)) return false;
  if (isCnyJournalReplaceSignal(account)) return false;
  const updated = String(account.updated_utc || "");
  const asOf = String(account.as_of || "");
  const timeHit = updated === STALE_BUNDLED_CNY_UPDATED_UTC || asOf === "2026-10-24";
  return timeHit && isStaleBundledCnyEquity(account.equity);
}

export function isStaleBundledCnySeries(series) {
  if (!series || isCnyJournalGeneration(series.generation)) return false;
  const pts = Array.isArray(series.points) ? series.points : [];
  const last = pts[pts.length - 1];
  if (!last) return false;
  const t = String(last.t ?? last.time ?? "");
  return t.startsWith("2026-10-24") && isStaleBundledCnyEquity(last.equity);
}

/**
 * CDN-fail / cache: 335539 не рисуем. Другие bot_id не трогаем.
 * Журнал v1 в history.json не удаляем.
 */
export function neutralizeStaleBundledCny(latest, history) {
  if (latest && Array.isArray(latest.accounts)) {
    for (const a of latest.accounts) {
      if (!isStaleBundledCnyAccount(a)) continue;
      a.no_data = true;
      a.equity = null;
      a.history = [];
      a.error = "stale_bundled_cny";
    }
  }
  const series = history?.series?.[CNY_MOM_H360_SERIES_KEY];
  if (series && isStaleBundledCnySeries(series)) {
    delete history.series[CNY_MOM_H360_SERIES_KEY];
  }
  return { latest, history };
}

/**
 * Точки account.history как канон journal.capital: число, сортировка.
 * Метку t не нормализуем и не дописываем Z — host шлёт naive ISO.
 */
export function cnyJournalHistoryPoints(account) {
  if (!isCnyMomH360(account)) return [];
  const hist = Array.isArray(account.history) ? account.history : [];
  const byT = new Map();
  for (const p of hist) {
    if (!p || p.equity == null || p.equity === "") continue;
    const t = String(p.t ?? p.time ?? "").trim();
    if (!t) continue;
    const equity = Number(p.equity);
    if (!Number.isFinite(equity)) continue;
    byT.set(t, { t, equity });
  }
  return [...byT.values()].sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
}

export function isCnyJournalStoredSeries(series) {
  return isCnyJournalGeneration(cnySeriesGeneration(series));
}

function cnyPointMs(p) {
  const t = p?.t ?? p?.time;
  if (t == null || t === "") return null;
  const s = String(t);
  const ms = Date.parse(s.length === 10 ? `${s}T00:00:00Z` : s);
  return Number.isNaN(ms) ? null : ms;
}

/** Точки history.json для «Юань 360»: журнал v1 целиком, иначе с открытия рублёвой книги. */
export function cnyMomStoredPoints(account, history) {
  if (!isCnyMomH360(account) || !hasCnyMomAccountLine(account)) return [];
  const key = `${account.bot_id}::${account.account_id}`;
  const series = history?.series?.[key];
  const pts = series?.points;
  if (!Array.isArray(pts)) return [];
  const journal = isCnyJournalStoredSeries(series);
  const from = Date.parse(CNY_MOM_BOOK_FROM);
  return pts.filter((p) => {
    if (!p || p.equity == null || p.equity === "") return false;
    const ms = cnyPointMs(p);
    if (ms == null) return false;
    return journal || ms >= from;
  });
}

/** Сколько разных моментов времени в ряду. */
function distinctPointCount(points) {
  const seen = new Set();
  for (const p of points || []) {
    const ms = cnyPointMs(p);
    if (ms != null) seen.add(Math.floor(ms / 1000));
  }
  return seen.size;
}

/**
 * «Счёт только открыт» — только пока в итоговом ряду карточки меньше двух точек.
 * Без ряда (старый вызов) смотрим на поле history из снимка.
 */
export function cnyMomOpenedLine(account, chartPoints) {
  if (!hasCnyMomAccountLine(account)) return "";
  if (Array.isArray(chartPoints)) {
    return distinctPointCount(chartPoints) < 2 ? CNY_MOM_OPENED_LINE : "";
  }
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
