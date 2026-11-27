/**
 * Карточки «Кватро-360 Ставка и Крипта» и «Трио-360 · Всепогодный»:
 * бумажные рублёвые счета ЕДП. Эквити = ofz_value_rub + cash_rub;
 * номинал фьючерсов к капиталу не прибавляем.
 */

import { equityCurvePoints, hasEquityCurve } from "./equityCurve.js";
import { hasTimeOfDay, timedHistoryPoints } from "./ethOkxCard.js";
import { formatPctRu, parseFeedNumber, RATE_CYCLE_OPENED_LINE } from "./rateCycleCard.js";
import {
  isEmptyEquityField,
  isMoexMulti360,
  isMoexQuad360,
  isMoexTrio360,
  MOEX_QUAD_360_LOGIC,
  MOEX_TRIO_360_LOGIC,
  withMoexMulti360Aliases,
} from "./strategyMeta.js";
import { displayNote, formatMoneyRu, positionHasField } from "./uiCopy.js";

export const MOEX_MULTI_360_OPENED_LINE = RATE_CYCLE_OPENED_LINE;
export const MOEX_MULTI_360_GO_CAP_PCT = 45;

const CR_FUTURES = /^CR[FGHJKMNQUVXZ]\d{1,2}$/;
const EH_FUTURES = /^EH[FGHJKMNQUVXZ]\d{1,2}$/;
const MM_FUTURES = /^MM[FGHJKMNQUVXZ]\d{1,2}$/;
const OFZ_SECID = /^SU\d+/;
const HIDDEN_SYMBOLS = /^(MIX|RGBITR|BTC|BTCUSDT)/;

function aliased(account) {
  return withMoexMulti360Aliases(account);
}

function hasNonZeroQty(position) {
  const n = parseFeedNumber(position?.qty ?? position?.signed_qty);
  return n != null && n !== 0;
}

export function normalizeMoexMulti360Symbol(positionOrSymbol) {
  if (positionOrSymbol == null) return "";
  if (typeof positionOrSymbol === "string") return positionOrSymbol.trim().toUpperCase();
  return String(positionOrSymbol.symbol || positionOrSymbol.secid || positionOrSymbol.code || "")
    .trim()
    .toUpperCase();
}

export function isMoexMulti360HiddenSymbol(symbol) {
  const s = normalizeMoexMulti360Symbol(symbol);
  return Boolean(s) && HIDDEN_SYMBOLS.test(s);
}

export function isMoexMulti360FuturesSymbol(symbol) {
  const s = normalizeMoexMulti360Symbol(symbol);
  if (!s || isMoexMulti360HiddenSymbol(s)) return false;
  if (s === "CR" || CR_FUTURES.test(s)) return true;
  if (s === "IMOEXF") return true;
  if (s === "GLDRUBF") return true;
  if (s === "EH" || EH_FUTURES.test(s)) return true;
  if (s === "MM" || s === "MXI" || MM_FUTURES.test(s)) return true;
  return false;
}

export function isMoexMulti360OfzSymbol(symbol, account) {
  const s = normalizeMoexMulti360Symbol(symbol);
  if (!s) return false;
  if (s === "OFZ") return true;
  const ofz = String(account?.ofz_secid || "").trim().toUpperCase();
  if (ofz && s === ofz) return true;
  return OFZ_SECID.test(s);
}

export function moexMulti360PositionSide(position) {
  const qty = parseFeedNumber(position?.qty ?? position?.signed_qty);
  const raw = String(position?.side || "").trim().toLowerCase();
  if (qty != null && qty < 0) return "short";
  if (raw === "short") return "short";
  if (raw === "long") return "long";
  if (qty != null && qty > 0) return "long";
  return raw;
}

function absQtyString(position) {
  const n = parseFeedNumber(position?.qty ?? position?.signed_qty);
  if (n == null) {
    const raw = position?.qty;
    return raw == null || raw === "" ? "" : String(raw);
  }
  return String(Math.abs(n));
}

export function moexMulti360MarkValue(position) {
  if (positionHasField(position, "mark")) return position.mark;
  if (positionHasField(position, "avg_px")) return position.avg_px;
  return null;
}

export function formatMoexMulti360Mark(position) {
  const raw = moexMulti360MarkValue(position);
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

function displayPosition(position, account) {
  const symbol = normalizeMoexMulti360Symbol(position);
  const ofz = isMoexMulti360OfzSymbol(position, account);
  return {
    ...position,
    symbol: ofz ? String(account?.ofz_secid || position.secid || symbol || "OFZ").trim() : symbol,
    side: ofz ? "long" : moexMulti360PositionSide(position),
    qty: absQtyString(position),
    mark: moexMulti360MarkValue(position),
  };
}

function ofzAlreadyListed(rows, account) {
  return rows.some((p) => isMoexMulti360OfzSymbol(p, account));
}

function ofzFromAccount(account) {
  const qty = parseFeedNumber(account?.ofz_qty);
  const secid = String(account?.ofz_secid || "").trim();
  if (qty == null || qty === 0 || !secid) return null;
  return {
    symbol: secid,
    secid,
    code: "OFZ",
    side: "long",
    qty: String(Math.abs(qty)),
    avg_px: account.ofz_px ?? account.ofz_dirty_px,
    mark: account.ofz_px ?? account.ofz_dirty_px,
    value_rub: account.ofz_value_rub,
  };
}

/** ОФЗ (если ofz_qty > 0) и активные фьючерсы; qty === 0 скрыты; шорт штатный. */
export function visibleMoexMulti360Positions(account) {
  const acc = aliased(account);
  const raw = Array.isArray(acc?.positions) ? acc.positions : [];
  if (!isMoexMulti360(acc)) return raw;
  const rows = [];
  for (const p of raw) {
    if (!hasNonZeroQty(p)) continue;
    if (isMoexMulti360HiddenSymbol(p)) continue;
    if (isMoexMulti360OfzSymbol(p, acc) || isMoexMulti360FuturesSymbol(p)) {
      rows.push(displayPosition(p, acc));
    }
  }
  if (!ofzAlreadyListed(rows, acc)) {
    const ofz = ofzFromAccount(acc);
    if (ofz) rows.unshift(ofz);
  }
  return rows;
}

/** Цифры карточки: объект есть и equity не пустой. */
export function hasMoexMulti360AccountLine(account) {
  const acc = aliased(account);
  if (!isMoexMulti360(acc)) return false;
  if (acc.no_data) return false;
  return !isEmptyEquityField(acc.equity);
}

export function formatMoexMulti360Equity(equity) {
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

export function moexMulti360EquityLine(account) {
  if (!hasMoexMulti360AccountLine(account)) return "";
  return `${formatMoexMulti360Equity(aliased(account).equity)} ₽`;
}

export function moexMulti360FallbackNote(account) {
  const acc = aliased(account);
  const seed = parseFeedNumber(acc?.seed);
  const start = seed != null ? formatMoneyRu(seed, "RUB") : "1 000 000";
  const logic = isMoexTrio360(acc) ? MOEX_TRIO_360_LOGIC : MOEX_QUAD_360_LOGIC;
  if (isMoexTrio360(acc)) {
    return `Бумага. «Трио-360 · Всепогодный», старт ${start} ₽. ${logic}`;
  }
  return `Бумага. «Кватро-360 Ставка и Крипта», старт ${start} ₽. ${logic}`;
}

export function moexMulti360Description(account) {
  const note = String(account?.note || "").trim();
  if (note) return displayNote(note, account);
  return moexMulti360FallbackNote(account);
}

function validCurvePoints(rows) {
  return (Array.isArray(rows) ? rows : []).filter(
    (p) => p && (p.t || p.time) && p.equity != null && p.equity !== "",
  );
}

function hourlyOrRawPoints(rows) {
  const raw = validCurvePoints(rows);
  if (!raw.length) return [];
  if (raw.every(hasTimeOfDay)) return timedHistoryPoints(raw);
  const timed = timedHistoryPoints(raw.filter(hasTimeOfDay));
  if (timed.length) return timed;
  return raw;
}

export function moexMulti360SnapshotPoints(account) {
  const acc = aliased(account);
  if (!isMoexMulti360(acc)) return [];
  if (hasEquityCurve(acc)) {
    const curve = equityCurvePoints(acc);
    if (curve.length) return curve;
  }
  return hourlyOrRawPoints(acc.history);
}

export function moexMulti360StoredPoints(account, history) {
  const acc = aliased(account);
  if (!isMoexMulti360(acc)) return [];
  const keys = [`${acc.bot_id}::${acc.account_id}`];
  if (isMoexQuad360(acc)) {
    keys.push("moex_quad_360_carry_v1::paper_moex_quad_360_carry_v1");
    keys.push("moex_quad_360_carry_v1::moex_quad_360_carry_v1");
  }
  if (isMoexTrio360(acc)) {
    keys.push("moex_trio_360_clean_v1::paper_moex_trio_360_clean_v1");
    keys.push("moex_trio_360_clean_v1::moex_trio_360_clean_v1");
  }
  for (const key of keys) {
    const pts = history?.series?.[key]?.points;
    const rows = hourlyOrRawPoints(pts);
    if (rows.length) return rows;
  }
  return [];
}

/**
 * Часовая бумажная кривая: equity_curve / history снимка, иначе history.series.
 * Номинал фьючерсов в ряд не входит.
 */
export function moexMulti360HistoryPoints(account, history) {
  if (!hasMoexMulti360AccountLine(account)) return [];
  const snap = moexMulti360SnapshotPoints(account);
  if (snap.length) return snap;
  return moexMulti360StoredPoints(account, history);
}

export function moexMulti360OpenedLine(account, chartPoints) {
  if (!hasMoexMulti360AccountLine(account)) return "";
  if (Array.isArray(chartPoints)) {
    return chartPoints.length <= 1 ? MOEX_MULTI_360_OPENED_LINE : "";
  }
  return moexMulti360HistoryPoints(account).length <= 1 ? MOEX_MULTI_360_OPENED_LINE : "";
}

export function moexMulti360FromStartPctLine(account) {
  if (!hasMoexMulti360AccountLine(account)) return "";
  const acc = aliased(account);
  const seed = parseFeedNumber(acc.seed);
  const equity = parseFeedNumber(acc.equity);
  if (seed == null || equity == null || seed === 0) return "";
  const pct = ((equity - seed) / seed) * 100;
  const abs = formatPctRu(Math.abs(pct), 2);
  if (abs == null) return "";
  const sign = pct >= 0 ? "+" : "−";
  return `${sign}${abs}% от старта`;
}

function formatCoverX(n) {
  const txt = formatPctRu(n, 2);
  return txt == null ? null : txt;
}

/**
 * Строка залога / ГО. go_used_rub === 0 → фьючерсы вне позиции.
 * Номинал фьючерсов сюда не суммируется.
 */
export function moexMulti360CollateralLine(account) {
  if (!hasMoexMulti360AccountLine(account)) return "";
  const acc = aliased(account);
  const goUsed = parseFeedNumber(acc.go_used_rub);
  if (goUsed === 0) return "ГО 0,0% · фьючерсы вне позиции";
  const ofz = String(acc.ofz_secid || "").trim();
  const goPct = parseFeedNumber(acc.go_pct);
  const cover = parseFeedNumber(acc.collateral_coverage_x);
  const parts = [];
  if (ofz) parts.push(`Залог: ОФЗ ${ofz}`);
  if (goPct != null) {
    const pct = formatPctRu(goPct, 2);
    if (pct != null) parts.push(`ГО ${pct}% (лимит ${MOEX_MULTI_360_GO_CAP_PCT}%)`);
  }
  if (cover != null) {
    const x = formatCoverX(cover);
    if (x != null) parts.push(`покрытие ${x}×`);
  }
  return parts.join(" · ");
}

export function moexMulti360ChartMoneyLabel() {
  return "₽";
}

export function moexMulti360BookEquity(account) {
  if (!hasMoexMulti360AccountLine(account)) return null;
  return parseFeedNumber(aliased(account).equity);
}
