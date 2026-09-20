/**
 * Выбор счёта для OG-превью: максимальная прибыль в деньгах (equity − seed).
 * Валюты не конвертируются и не складываются. При равенстве pnl
 * внутри одной валюты побеждает больший процент (pnl/seed).
 */

export function seriesKey(account) {
  return `${account.bot_id}::${account.account_id}`;
}

export function toNum(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function resolveSeed(account, series) {
  const fromAccount = toNum(account?.seed);
  if (fromAccount != null) return fromAccount;
  const fromSeries = toNum(series?.seed);
  if (fromSeries != null) return fromSeries;
  const first = series?.points?.find((p) => toNum(p?.equity) != null);
  return toNum(first?.equity);
}

export function resolveEquity(account, series) {
  const fromAccount = toNum(account?.equity);
  if (fromAccount != null) return fromAccount;
  const pts = series?.points;
  if (!pts?.length) return null;
  for (let i = pts.length - 1; i >= 0; i--) {
    const eq = toNum(pts[i]?.equity);
    if (eq != null) return eq;
  }
  return null;
}

export function scoreAccount(account, series, currencyFn) {
  if (!account) return null;
  const equity = resolveEquity(account, series);
  const seed = resolveSeed(account, series);
  if (equity == null || seed == null || seed <= 0) return null;
  const pnl = equity - seed;
  const pct = pnl / seed;
  const currency =
    (typeof currencyFn === "function" ? currencyFn(account) : null) ||
    account.currency ||
    series?.currency ||
    "";
  return {
    account,
    series: series || null,
    equity,
    seed,
    pnl,
    pct,
    currency,
    key: seriesKey(account),
  };
}

/**
 * Среди всех счетов с валидными equity+seed выбирает max(pnl) без FX.
 * Ничья: выше процент, если валюта та же; иначе стабильный порядок по ключу.
 */
export function pickOgWinner(latest, history, currencyFn) {
  const seriesMap = history?.series || {};
  const scored = [];
  for (const account of latest?.accounts || []) {
    const row = scoreAccount(account, seriesMap[seriesKey(account)], currencyFn);
    if (row) scored.push(row);
  }
  if (!scored.length) return null;
  scored.sort((a, b) => {
    if (b.pnl !== a.pnl) return b.pnl - a.pnl;
    if (a.currency === b.currency) {
      const ap = a.pct ?? Number.NEGATIVE_INFINITY;
      const bp = b.pct ?? Number.NEGATIVE_INFINITY;
      if (bp !== ap) return bp - ap;
    }
    return a.key.localeCompare(b.key);
  });
  return scored[0];
}

const ODD_SPACES = /[\u00a0\u202f\u2007\u2008\u2009\u200a\u2060\ufeff]/g;

/** Telegram (and some crawlers) drop cards when description has NBSP/NNBSP. */
export function asciiOgText(s) {
  return String(s)
    .replace(ODD_SPACES, " ")
    .replace(/[\u2212\u2013\u2014]/g, "-")
    .replace(/ {2,}/g, " ")
    .trim();
}

function groupInt(intPart) {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatMoney(n, currency) {
  if (n == null || !Number.isFinite(n)) return "-";
  const abs = Math.abs(n);
  const digits = currency === "RUB" || abs >= 100 ? 0 : 2;
  const sign = n < 0 ? "-" : "";
  const [intPart, frac] = abs.toFixed(digits).split(".");
  return frac != null ? `${sign}${groupInt(intPart)},${frac}` : `${sign}${groupInt(intPart)}`;
}

export function formatPct(pct) {
  if (pct == null || !Number.isFinite(pct)) return "-";
  const sign = pct > 0 ? "+" : pct < 0 ? "-" : "";
  const [intPart, frac] = Math.abs(pct * 100).toFixed(2).split(".");
  return `${sign}${groupInt(intPart)},${frac}`;
}

export const OG_SITE = "https://portfolio-krsk.vercel.app";

/** Short cache-bust for crawlers: YYYYMMDDHHMM (UTC), no ISO colons. */
export function ogCacheBust(iso) {
  const d = iso ? new Date(iso) : new Date();
  const t = Number.isNaN(d.getTime()) ? new Date() : d;
  const pad = (n) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}`;
}

/**
 * Absolute JPEG URL. Never use ISO timestamps (colons become %3A and
 * some crawlers drop the card). Short ?v=YYYYMMDDHHMM is optional cache-bust.
 */
export function ogImageHref(generatedAt, { cacheBust = true } = {}) {
  if (!cacheBust) return `${OG_SITE}/og-cover.jpg`;
  return `${OG_SITE}/og-cover.jpg?v=${ogCacheBust(generatedAt)}`;
}

export function formatSignedMoney(n, currency) {
  const body = formatMoney(n, currency);
  if (n > 0) return `+${body}`;
  return body;
}

export function winnerLabel(row) {
  if (!row) return "";
  const { account } = row;
  if (account.bot_id && account.account_id && account.bot_id !== account.account_id) {
    return `${account.bot_id} / ${account.account_id}`;
  }
  return account.account_id || account.bot_id || row.key;
}

export function ogDescription(row) {
  if (!row) return "Бумажные торговые боты. Валюты не складываются.";
  const money = formatSignedMoney(row.pnl, row.currency);
  const pct = formatPct(row.pct);
  return asciiOgText(
    `${winnerLabel(row)}: ${money} ${row.currency} (${pct}%) с запуска. Бумажный кабинет, валюты не складываются.`,
  );
}

export function ogTitle(row) {
  if (!row) return "portfolio_krsk - бумажные боты";
  return asciiOgText(`portfolio_krsk - ${winnerLabel(row)}`);
}
