/**
 * Поля карточек семейства «Маяк»: режим, ставки, заём, доля акций, устаревание as_of.
 * Числа из снимка могут прийти строкой. Отсутствие необязательных полей не ошибка.
 */

import { formatMoneyRu } from "./uiCopy.js";
import { formatUpdatedLine, isMayak } from "./strategyMeta.js";

export const MAYAK_STALE_CALENDAR_DAYS = 5;

export const REGIME_COPY = {
  hard: "Жёсткий режим: ключевая выше 12% и реальная ставка выше 6 п.п., всё в LQDT (деньги), акции не покупаем",
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

export function regimeLine(account) {
  if (!account || account.regime == null || account.regime === "") return "";
  const key = String(account.regime).toLowerCase();
  const text = REGIME_COPY[key];
  if (!text) return "";
  const rates = ratesLine(account);
  return rates ? `${text}. ${rates}` : text;
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

export function emptyPositionsHint(account) {
  const key = account?.regime == null || account.regime === "" ? "" : String(account.regime).toLowerCase();
  if (key === "hard" || key === "protect") {
    return "акций нет — всё в LQDT (деньги). Это ожидаемо, не ошибка.";
  }
  return "Открытых позиций сейчас нет.";
}

export function mayakDetailLines(account) {
  if (!account) return [];
  const lines = [];
  const regime = regimeLine(account);
  if (regime) lines.push({ kind: "regime", text: regime });
  const stocks = stocksLine(account);
  if (stocks) lines.push({ kind: "stocks", text: stocks });
  const cash = cashOrLoanLine(account);
  if (cash) lines.push({ kind: isBorrowingLoan(account) ? "loan" : "cash", text: cash });
  const gross = grossLine(account);
  if (gross) lines.push({ kind: "gross", text: gross });
  return lines;
}

export function cardUpdatedLine(account, now = new Date()) {
  const line = formatUpdatedLine(account);
  if (!line || !isMayak(account) || !account.as_of) return line;
  if (!isAsOfStale(account.as_of, now)) return line;
  if (line.includes("устарело")) return line;
  return line.replace(`сессия ${account.as_of}`, `сессия ${account.as_of} · устарело`);
}
