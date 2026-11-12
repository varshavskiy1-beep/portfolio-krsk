/**
 * CNY-only prefix contract (reviewed artifact cny_mom_h360.early_prefix.v1).
 * Prefix: 198 UTC-Z points, first 2026-10-12T11:07:00Z / 300000, last
 * 2026-10-23T06:17:26Z / 332483.56. Cutoff strictly before 2026-10-23T06:21:01Z
 * (published duplicate of journal naive 08:00 / 332497.77). 06:21/07:01/07:21
 * are not prefix. Canonical tail is live account.history (do not freeze n=480).
 * Clocks: prefix has Z, journal is naive. Do not rewrite labels or invent TZ.
 */
import {
  CNY_JOURNAL_CAPITAL_GENERATION,
  CNY_JOURNAL_FROM,
  CNY_MOM_BOOK_FROM,
  STALE_BUNDLED_CNY_EQUITY,
  cnyJournalHistoryPoints,
  hasCnyMomAccountLine,
  isCnyJournalReplaceSignal,
  isCnyJournalStoredSeries,
} from "./cnyMomCard.js";
import prefixDoc from "./fixtures/cny_mom_h360_early_prefix.v1.json" with { type: "json" };
import { CNY_MOM_H360_SERIES_KEY, isCnyMomH360 } from "./strategyMeta.js";

export const CNY_BOOK_PREFIX_GENERATION = "cny-book-prefix-v1";
export const CNY_PREFIX_SCHEMA = "cny_mom_h360.early_prefix.v1";
/** Published sample that already is the first canonical journal print. */
export const CNY_PREFIX_EXCLUDE_FROM = "2026-10-23T06:21:01Z";
export const CNY_PREFIX_SEED = 300000;
export const CNY_PREFIX_SEAM = {
  last_prefix: { t: "2026-10-23T06:17:26Z", equity: 332483.56266424 },
  first_canonical: { t: CNY_JOURNAL_FROM, equity: 332497.77 },
  equity_delta_rub: 14.207335760002024,
  prefix_clock: "utc_z",
  canonical_clock: "naive",
  known_label_shift_hours: 1.65,
};

const PREFIX_POINTS = prefixDoc.points;

export function cnyTimeKey(t) {
  return String(t ?? "").trim().replace(/Z$/, "");
}

export function cnyTimeStrictlyBefore(t, bound) {
  const a = cnyTimeKey(t);
  const b = cnyTimeKey(bound);
  return Boolean(a && b && a < b);
}

function isStaleEquity(equity) {
  const n = Number(equity);
  return Number.isFinite(n) && Math.abs(n - STALE_BUNDLED_CNY_EQUITY) < 1e-4;
}

function normalizePrefixPoint(p) {
  if (!p || p.equity == null || p.equity === "") return null;
  const t = String(p.t ?? p.time ?? "").trim();
  if (!t) return null;
  const equity = Number(p.equity);
  if (!Number.isFinite(equity) || isStaleEquity(equity)) return null;
  return { t, equity };
}

/** v1 prefix only. Unknown future generation/reset does not inherit it. */
export function cnyPrefixCompatibleGeneration(generation) {
  const g = String(generation || "").trim();
  return g === "" || g === CNY_JOURNAL_CAPITAL_GENERATION;
}

export function isValidatedCnyPrefix(points, cut = CNY_PREFIX_EXCLUDE_FROM) {
  if (!Array.isArray(points) || !points.length) return false;
  const first = points[0];
  const firstEq = Number(first?.equity);
  if (!String(first?.t || "").startsWith("2026-10-12T11:07")) return false;
  if (!(Math.abs(firstEq - CNY_PREFIX_SEED) < 1e-6)) return false;
  if (!String(first.t).startsWith(CNY_MOM_BOOK_FROM.slice(0, 16))) return false;
  for (const p of points) {
    if (!p || isStaleEquity(p.equity)) return false;
    if (!cnyTimeStrictlyBefore(p.t, cut)) return false;
  }
  return true;
}

export function extractCnyValidatedPrefix(points, cut = CNY_PREFIX_EXCLUDE_FROM) {
  const bound = cut || CNY_PREFIX_EXCLUDE_FROM;
  const byT = new Map();
  for (const raw of points || []) {
    const p = normalizePrefixPoint(raw);
    if (!p) continue;
    if (!cnyTimeStrictlyBefore(p.t, bound)) continue;
    byT.set(cnyTimeKey(p.t), p);
  }
  const out = [...byT.values()].sort((a, b) => {
    const ka = cnyTimeKey(a.t);
    const kb = cnyTimeKey(b.t);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  return isValidatedCnyPrefix(out, bound) ? out : [];
}

export function reviewedCnyPrefixFixture() {
  return extractCnyValidatedPrefix(PREFIX_POINTS, CNY_PREFIX_EXCLUDE_FROM);
}

/** Stored prefix is reused only if it is this reviewed 198-point book. */
export function cnyPrefixMatchesReviewed(points) {
  const reviewed = reviewedCnyPrefixFixture();
  if (!Array.isArray(points) || points.length !== reviewed.length) return false;
  if (points[0]?.t !== reviewed[0].t) return false;
  if (points.at(-1)?.t !== reviewed.at(-1).t) return false;
  if (Math.abs(Number(points[0].equity) - CNY_PREFIX_SEED) > 1e-6) return false;
  if (Math.abs(Number(points.at(-1).equity) - Number(reviewed.at(-1).equity)) > 1e-6) return false;
  return isValidatedCnyPrefix(points, CNY_PREFIX_EXCLUDE_FROM);
}

export function mergeCnyPrefixAndCanonical(prefix, canonical) {
  const tail = Array.isArray(canonical) ? canonical.filter((p) => p && p.t) : [];
  const head = extractCnyValidatedPrefix(prefix, CNY_PREFIX_EXCLUDE_FROM);
  if (!head.length) return tail.slice();
  if (!tail.length) return head.slice();
  return [...head, ...tail];
}

function storedCnySeries(history) {
  return history?.series?.[CNY_MOM_H360_SERIES_KEY] || null;
}

function storedCnyPoints(history) {
  const series = storedCnySeries(history);
  return Array.isArray(series?.points) ? series.points : [];
}

export function resolveCnyValidatedPrefix(history) {
  const fromStored = extractCnyValidatedPrefix(storedCnyPoints(history), CNY_PREFIX_EXCLUDE_FROM);
  if (cnyPrefixMatchesReviewed(fromStored)) return fromStored;
  return reviewedCnyPrefixFixture();
}

/**
 * Naive journal hours plotted as UTC clock faces so they stay after prefix Z.
 * Stored labels are not rewritten. This is not a timezone conversion.
 */
export function cnyChartUnix(t) {
  const s = String(t ?? "").trim();
  if (!s) return null;
  if (/Z$/i.test(s) || /[+-]\d{2}:\d{2}$/.test(s)) {
    const ms = Date.parse(s);
    return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
  }
  const ms = Date.parse(`${s}Z`);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

export function cnyPointsHaveMixedClocks(points) {
  let z = false;
  let naive = false;
  for (const p of points || []) {
    const t = String(p?.t ?? p?.time ?? "").trim();
    if (!t || !t.includes("T")) continue;
    if (/Z$/i.test(t) || /[+-]\d{2}:\d{2}$/.test(t)) z = true;
    else naive = true;
  }
  return z && naive;
}

function canonicalTailFromStored(stored) {
  const tail = [];
  for (const raw of stored || []) {
    const p = normalizePrefixPoint(raw);
    if (!p) continue;
    if (cnyTimeStrictlyBefore(p.t, CNY_PREFIX_EXCLUDE_FROM)) continue;
    if (isStaleEquity(p.equity)) continue;
    if (String(p.t).includes("Z")) continue;
    tail.push(p);
  }
  return tail;
}

export function cnyFullHistoryPoints(account, history) {
  if (!isCnyMomH360(account) || !hasCnyMomAccountLine(account)) return [];
  if (!isCnyJournalReplaceSignal(account)) return null;
  const journal = cnyJournalHistoryPoints(account);
  const gen = account.generation || storedCnySeries(history)?.generation;
  if (!cnyPrefixCompatibleGeneration(gen)) {
    return journal.length ? journal : [];
  }
  if (journal.length) {
    return mergeCnyPrefixAndCanonical(resolveCnyValidatedPrefix(history), journal);
  }
  const series = storedCnySeries(history);
  if (!isCnyJournalStoredSeries(series)) return [];
  const tail = canonicalTailFromStored(storedCnyPoints(history));
  if (!tail.length) return [];
  return mergeCnyPrefixAndCanonical(resolveCnyValidatedPrefix(history), tail);
}

export function cnyPublisherPoints(account, prevPoints) {
  const journal = cnyJournalHistoryPoints(account);
  if (!journal.length) return null;
  if (!cnyPrefixCompatibleGeneration(account.generation)) return journal;
  const fromPrev = extractCnyValidatedPrefix(prevPoints, CNY_PREFIX_EXCLUDE_FROM);
  const prefix = cnyPrefixMatchesReviewed(fromPrev) ? fromPrev : reviewedCnyPrefixFixture();
  return mergeCnyPrefixAndCanonical(prefix, journal);
}
