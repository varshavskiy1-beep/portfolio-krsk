/**
 * Карточка «ETH по сигналу OKX»: бумажный рублёвый счёт.
 * Линия — только поле history из снимка. На дневной оси — последняя точка дня.
 * Номинал фьючерса к equity не прибавляем. cash — тот же залог, не свободные деньги.
 */

import { equityCurvePoints, hasEquityCurve } from "./equityCurve.js";
import { parseFeedNumber, RATE_CYCLE_OPENED_LINE } from "./rateCycleCard.js";
import { isEmptyEquityField, isEthOkxMoex } from "./strategyMeta.js";
import { displayNote, formatMoneyRu, positionHasField } from "./uiCopy.js";

export const ETH_OKX_OPENED_LINE = RATE_CYCLE_OPENED_LINE;

export const ETH_OKX_FALLBACK_NOTE =
  "Бумага: старт 300 000 ₽. Раз в час смотрит 720 закрытых часов ETH-USDT-SWAP на OKX и держит фьючерс ETH на Мосбирже, номинал — половина рублей. На биржу ордера не идут. На Автоследование не выводится.";

function hasNonZeroQty(position) {
  const n = parseFeedNumber(position?.qty);
  return n != null && n !== 0;
}

/** Цифры карточки: объект есть и equity не пустой. */
export function hasEthOkxAccountLine(account) {
  if (!isEthOkxMoex(account)) return false;
  if (account.no_data) return false;
  return !isEmptyEquityField(account.equity);
}

export function formatEthOkxEquity(equity) {
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

export function ethOkxEquityLine(account) {
  if (!hasEthOkxAccountLine(account)) return "";
  return `${formatEthOkxEquity(account.equity)} ₽`;
}

export function ethOkxFallbackNote(account) {
  const seed = parseFeedNumber(account?.seed);
  if (seed == null) return ETH_OKX_FALLBACK_NOTE;
  const start = formatMoneyRu(seed, "RUB");
  return `Бумага: старт ${start} ₽. Раз в час смотрит 720 закрытых часов ETH-USDT-SWAP на OKX и держит фьючерс ETH на Мосбирже, номинал — половина рублей. На биржу ордера не идут. На Автоследование не выводится.`;
}

export function ethOkxDescription(account) {
  const note = String(account?.note || "").trim();
  if (note) return displayNote(note, account);
  return ethOkxFallbackNote(account);
}

/** Календарный день точки: YYYY-MM-DD, чтобы одинаковые даты не ломали дневную ось. */
export function historyDayKey(point) {
  const raw = point?.t ?? point?.time;
  if (raw == null || raw === "") return "";
  if (typeof raw === "number") {
    const ms = raw > 1e12 ? raw : raw * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }
  const s = String(raw);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toISOString().slice(0, 10);
}

/** На дневной оси оставляем последнюю точку каждого календарного дня. */
export function collapseHistoryByDay(points) {
  const byDay = new Map();
  for (const p of points || []) {
    if (!p || p.equity == null || p.equity === "") continue;
    const day = historyDayKey(p);
    if (!day) continue;
    byDay.set(day, { ...p, t: day });
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, p]) => p);
}

/** Метка с часом (длиннее даты YYYY-MM-DD и разбирается как время), а не одна дата. */
export function hasTimeOfDay(point) {
  const raw = point?.t ?? point?.time;
  if (typeof raw !== "string") return false;
  const s = raw.trim();
  if (s.length <= 10 || !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s)) return false;
  return !Number.isNaN(Date.parse(s));
}

/**
 * History снимка, если у всех точек есть час: капитал — число, одна точка на метку
 * (последняя), по времени. Хоть одна точка только с датой — [] (старый дневной вид,
 * дневные и часовые точки не смешиваем).
 */
export function timedHistoryPoints(history) {
  const rows = (Array.isArray(history) ? history : []).filter(
    (p) => p && (p.t || p.time) && p.equity != null && p.equity !== "",
  );
  if (!rows.length || !rows.every(hasTimeOfDay)) return [];
  const byMs = new Map();
  for (const p of rows) {
    const t = String(p.t ?? p.time).trim();
    const raw = p.equity;
    if (raw == null || (typeof raw === "string" && raw.trim() === "")) continue;
    const equity = Number(raw);
    if (!Number.isFinite(equity)) continue;
    byMs.set(Date.parse(t), { t, equity });
  }
  return [...byMs.entries()].sort((a, b) => a[0] - b[0]).map(([, p]) => p);
}

/**
 * Полный ряд ETH с часами: непустой equity_curve, иначе history, где у всех точек есть час.
 * Пусто — в ленте только даты (или ничего). Дневные точки сюда не попадают:
 * если появились часовые данные, используется только новый ряд.
 */
export function ethOkxTimedSeries(account) {
  if (!isEthOkxMoex(account)) return [];
  if (hasEquityCurve(account)) {
    const curve = equityCurvePoints(account);
    if (curve.length) return curve;
  }
  return timedHistoryPoints(account?.history);
}

export function ethOkxHistoryPoints(account) {
  if (!isEthOkxMoex(account) || !hasEthOkxAccountLine(account)) return [];
  const timed = ethOkxTimedSeries(account);
  if (timed.length) return timed;
  // В ленте только даты: последняя точка дня, как раньше.
  const hist = Array.isArray(account.history) ? account.history : [];
  const raw = hist.filter((p) => p && (p.t || p.time) && p.equity != null && p.equity !== "");
  return collapseHistoryByDay(raw);
}

export function ethOkxOpenedLine(account) {
  if (!hasEthOkxAccountLine(account)) return "";
  return ethOkxHistoryPoints(account).length <= 1 ? ETH_OKX_OPENED_LINE : "";
}

export function ethOkxFromStartPctLine(account) {
  if (!hasEthOkxAccountLine(account)) return "";
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

/** Только строки с qty ≠ 0. LQDT не выдумываем. */
export function visibleEthOkxPositions(account) {
  const raw = Array.isArray(account?.positions) ? account.positions : [];
  if (!isEthOkxMoex(account)) return raw;
  return raw.filter((p) => hasNonZeroQty(p));
}

/** Текущая отметка, не цена входа: mark, иначе avg_px. */
export function ethOkxMarkValue(position) {
  if (positionHasField(position, "mark")) return position.mark;
  if (positionHasField(position, "avg_px")) return position.avg_px;
  return null;
}

export function formatEthOkxMark(position) {
  const raw = ethOkxMarkValue(position);
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

/** cash — тот же залог, что и equity. Свободными деньгами не показываем. */
export function ethOkxCollateralLine() {
  return "";
}
