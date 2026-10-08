/**
 * Поля карточек семейства «Маяк»: режим, ставки, заём, доля акций, устаревание as_of.
 * Числа из снимка могут прийти строкой. Отсутствие необязательных полей не ошибка.
 * Эти поля есть только у Маяка — хелперы не трогают чужие карточки.
 */

import { formatMoneyRu } from "./uiCopy.js";
import { formatUpdatedLine, isMayak, leverageBadge } from "./strategyMeta.js";

export const MAYAK_STALE_CALENDAR_DAYS = 5;

export const HARD_EXIT_LINE =
  "Выход из режима — когда ключевая ≤ 12% или реальная ставка ≤ 6 п.п.";

export const REGIME_COPY = {
  hard: "Режим жёсткий: все деньги в LQDT, акции не покупаем. Это работа канона, не сбой",
  protect: "Защита: индекс Мосбиржи ниже EMA100, всё в LQDT",
  attack: "Атака: корзина до 10 акций",
};

export function parseFeedNumber(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseFeedFlag(v) {
  if (v === true || v === "true" || v === 1 || v === "1") return true;
  if (v === false || v === "false" || v === 0 || v === "0") return false;
  return null;
}

export function regimeKey(account) {
  if (!account || account.regime == null || account.regime === "") return "";
  return String(account.regime).toLowerCase();
}

/** Число для UI: русская запятая, без лишних нулей. */
export function formatRateRu(v) {
  const n = parseFeedNumber(v);
  if (n == null) return null;
  let s;
  if (Number.isInteger(n)) {
    s = String(n);
  } else {
    s = String(n);
    if (/e/i.test(s)) {
      s = n.toFixed(8).replace(/\.?0+$/, "");
    } else {
      s = s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
    }
  }
  return s.replace(".", ",");
}

/** Деньги и проценты Маяка: всегда два знака и запятая, не точка. */
export function formatRuFixed(n, digits = 2) {
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

export function ratesLine(account) {
  if (!account) return "";
  const kr = account.key_rate_pct == null || account.key_rate_pct === "" ? null : formatRateRu(account.key_rate_pct);
  const cpi = account.cpi_pct == null || account.cpi_pct === "" ? null : formatRateRu(account.cpi_pct);
  if (kr == null && cpi == null) return "";
  const parts = [];
  if (kr != null) parts.push(`ключевая ${kr}%`);
  if (cpi != null) parts.push(`инфляция ${cpi}%`);
  return parts.join(", ");
}

export function hardCanonLine(account) {
  const rates = ratesLine(account);
  if (rates) {
    return `Режим жёсткий: ${rates} — все деньги в LQDT, акции не покупаем. Это работа канона, не сбой`;
  }
  return REGIME_COPY.hard;
}

export function regimeLine(account) {
  const key = regimeKey(account);
  if (key === "hard") return hardCanonLine(account);
  if (key === "protect") return REGIME_COPY.protect;
  if (key === "attack") return REGIME_COPY.attack;
  return "";
}

export function hardExitLine(account) {
  return regimeKey(account) === "hard" ? HARD_EXIT_LINE : "";
}

export function parseAsOfDay(asOf) {
  if (asOf == null || asOf === "") return null;
  const m = String(asOf).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, mo, d };
}

function utcDayMs({ y, mo, d }) {
  return Date.UTC(y, mo - 1, d);
}

export function calendarDaysSinceAsOf(asOf, now = new Date()) {
  const day = parseAsOfDay(asOf);
  if (!day) return null;
  const today = { y: now.getUTCFullYear(), mo: now.getUTCMonth() + 1, d: now.getUTCDate() };
  return Math.floor((utcDayMs(today) - utcDayMs(day)) / 86_400_000);
}

/** «устарело» не раньше чем через 5 календарных дней без нового as_of. */
export function isAsOfStale(asOf, now = new Date()) {
  const days = calendarDaysSinceAsOf(asOf, now);
  if (days == null) return false;
  return days >= MAYAK_STALE_CALENDAR_DAYS;
}

export function isBorrowingLoan(account) {
  if (!account) return false;
  if (parseFeedFlag(account.borrowing) === true) return true;
  const cash = parseFeedNumber(account.cash);
  return cash != null && cash < 0;
}

export function cashOrLoanLine(account) {
  if (!account || account.cash == null || account.cash === "") return "";
  const cash = parseFeedNumber(account.cash);
  if (cash == null) return "";
  if (isBorrowingLoan(account)) {
    return `заём ${formatMoneyRu(Math.abs(cash), "RUB")} ₽`;
  }
  return `кэш ${formatMoneyRu(cash, "RUB")} ₽`;
}

export function stocksLine(account) {
  if (!account || account.stocks == null || account.stocks === "") return "";
  const n = parseFeedNumber(account.stocks);
  if (n == null) return "";
  return `акции ${formatMoneyRu(n, "RUB")} ₽`;
}

export function grossLine(account) {
  if (!account || account.gross == null || account.gross === "") return "";
  const n = parseFeedNumber(account.gross);
  if (n == null) return "";
  const pct = formatRateRu(n * 100);
  if (pct == null) return "";
  return `доля акций ${pct}%`;
}

/** Плечевые карточки: при borrowing=false и gross=0 плечо не используется. */
export function unusedLeverageLine(account) {
  if (!leverageBadge(account)) return "";
  if (account.borrowing == null || account.borrowing === "") return "";
  if (account.gross == null || account.gross === "") return "";
  if (parseFeedFlag(account.borrowing) !== false) return "";
  if (parseFeedNumber(account.gross) !== 0) return "";
  return "плечо не задействовано";
}

export function emptyPositionsHint(account) {
  const key = regimeKey(account);
  if (key === "hard" || key === "protect") return "в деньгах (LQDT)";
  return "Открытых позиций сейчас нет.";
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

/** «+114,20 ₽ (+0,04%) от старта» — доходность от seed фида, не сделки. */
export function mayakFromStartLine(account) {
  if (!isMayak(account)) return "";
  const seed = parseFeedNumber(account.seed);
  const equity = lastEquityScalar(account);
  if (seed == null || equity == null) return "";
  const delta = equity - seed;
  const pct = seed !== 0 ? (delta / seed) * 100 : null;
  const money = formatRuFixed(Math.abs(delta), 2);
  if (money == null) return "";
  const sign = delta >= 0 ? "+" : "−";
  const pctAbs = pct == null ? null : formatRuFixed(Math.abs(pct), 2);
  const pctPart =
    pctAbs == null ? "" : ` (${pct >= 0 ? "+" : "−"}${pctAbs}%)`;
  return `${sign}${money} ₽${pctPart} от старта`;
}

function hideZeroBook(account) {
  const key = regimeKey(account);
  return key === "hard" || key === "protect";
}

export function mayakDetailLines(account) {
  if (!account || !isMayak(account)) return [];
  const lines = [];
  const regime = regimeLine(account);
  if (regime) {
    lines.push({
      kind: "regime",
      tone: regimeKey(account) === "hard" ? "info" : "muted",
      text: regime,
    });
  }
  const exit = hardExitLine(account);
  if (exit) lines.push({ kind: "exit", tone: "muted", text: exit });
  const unusedLev = unusedLeverageLine(account);
  if (unusedLev) lines.push({ kind: "leverage", tone: "info", text: unusedLev });
  const hideZero = hideZeroBook(account);
  const stocksN = parseFeedNumber(account.stocks);
  const stocks = stocksLine(account);
  if (stocks && !(hideZero && stocksN === 0)) {
    lines.push({ kind: "stocks", tone: "muted", text: stocks });
  }
  const cash = cashOrLoanLine(account);
  if (cash) lines.push({ kind: isBorrowingLoan(account) ? "loan" : "cash", tone: "muted", text: cash });
  const grossN = parseFeedNumber(account.gross);
  const gross = grossLine(account);
  if (gross && !(hideZero && grossN === 0)) {
    lines.push({ kind: "gross", tone: "muted", text: gross });
  }
  return lines;
}

export function cardUpdatedLine(account, now = new Date()) {
  if (!isMayak(account)) return formatUpdatedLine(account);
  const parts = [];
  if (account.as_of) {
    let day = `данные на конец торгового дня ${account.as_of}`;
    if (isAsOfStale(account.as_of, now)) day += " · устарело";
    parts.push(day);
  }
  if (account.updated_utc) parts.push(`обновлено ${account.updated_utc}`);
  if (account.next_rebalance) parts.push(`ребаланс ${account.next_rebalance}`);
  if (account.planned_fill) parts.push(`план ${account.planned_fill}`);
  return parts.join(" · ");
}
