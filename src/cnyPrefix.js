/**
 * CNY-only prefix contract: keep the 12 Oct 300000 book that starts before
 * the host journal, then the canonical journal.capital tail.
 * history_mode=replace replaces the tail, not the validated prefix.
 * On overlap the journal wins. Stalled 24 Oct 335539 never re-enters.
 * Do not invent a seed point if the prefix is missing.
 */
import {
  CNY_JOURNAL_FROM,
  CNY_MOM_BOOK_FROM,
  STALE_BUNDLED_CNY_EQUITY,
  cnyJournalHistoryPoints,
  hasCnyMomAccountLine,
  isCnyJournalReplaceSignal,
  isCnyJournalStoredSeries,
} from "./cnyMomCard.js";
import {
  CNY_BOOK_PREFIX_GENERATION,
  CNY_VALIDATED_PREFIX_POINTS,
} from "./fixtures/cny_mom_h360_validated_prefix.js";
import { CNY_MOM_H360_SERIES_KEY, isCnyMomH360 } from "./strategyMeta.js";

export { CNY_BOOK_PREFIX_GENERATION };

const PREFIX_SEED = 300000;

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

/**
 * Points strictly before the first canonical journal timestamp.
 * First must be the real 12 Oct 300000 book open — not a fabricated seed.
 */
export function isValidatedCnyPrefix(points, canonicalFrom = CNY_JOURNAL_FROM) {
  if (!Array.isArray(points) || !points.length) return false;
  const first = points[0];
  const firstEq = Number(first?.equity);
  if (!String(first?.t || "").startsWith("2026-10-12T11:07")) return false;
  if (!(Math.abs(firstEq - PREFIX_SEED) < 1e-6)) return false;
  if (!String(first.t).startsWith(CNY_MOM_BOOK_FROM.slice(0, 16))) return false;
  for (const p of points) {
    if (!p || isStaleEquity(p.equity)) return false;
    if (!cnyTimeStrictlyBefore(p.t, canonicalFrom)) return false;
  }
  return true;
}

export function extractCnyValidatedPrefix(points, canonicalFrom = CNY_JOURNAL_FROM) {
  const bound = canonicalFrom || CNY_JOURNAL_FROM;
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

export function reviewedCnyPrefixFixture(canonicalFrom = CNY_JOURNAL_FROM) {
  return extractCnyValidatedPrefix(CNY_VALIDATED_PREFIX_POINTS, canonicalFrom);
}

export function mergeCnyPrefixAndCanonical(prefix, canonical) {
  const tail = Array.isArray(canonical) ? canonical.filter((p) => p && p.t) : [];
  const bound = tail[0]?.t || CNY_JOURNAL_FROM;
  const head = extractCnyValidatedPrefix(prefix, bound);
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

/**
 * Prefix source: already-stored validated head, else the reviewed 569-era fixture.
 * Never pulls the post-23 Oct stalled 335539 tail.
 */
export function resolveCnyValidatedPrefix(history, canonicalFrom = CNY_JOURNAL_FROM) {
  const fromStored = extractCnyValidatedPrefix(storedCnyPoints(history), canonicalFrom);
  if (fromStored.length) return fromStored;
  return reviewedCnyPrefixFixture(canonicalFrom);
}

function canonicalTailFromStored(stored, bound) {
  const tail = [];
  for (const raw of stored || []) {
    const p = normalizePrefixPoint(raw);
    if (!p) continue;
    if (cnyTimeStrictlyBefore(p.t, bound)) continue;
    if (isStaleEquity(p.equity)) continue;
    tail.push(p);
  }
  return tail;
}

/**
 * Chart series for Yuan 360 when the snapshot asks for journal replace:
 * validated prefix + canonical account.history. Empty journal does not paint
 * the dirty Oct 24 book; a stored journal series is kept and re-prefixed.
 */
export function cnyFullHistoryPoints(account, history) {
  if (!isCnyMomH360(account) || !hasCnyMomAccountLine(account)) return [];
  if (!isCnyJournalReplaceSignal(account)) return null;
  const journal = cnyJournalHistoryPoints(account);
  if (journal.length) {
    const bound = journal[0].t;
    return mergeCnyPrefixAndCanonical(resolveCnyValidatedPrefix(history, bound), journal);
  }
  const series = storedCnySeries(history);
  if (!isCnyJournalStoredSeries(series)) return [];
  const stored = storedCnyPoints(history);
  const bound =
    stored.find((p) => !cnyTimeStrictlyBefore(p.t, CNY_JOURNAL_FROM))?.t || CNY_JOURNAL_FROM;
  const tail = canonicalTailFromStored(stored, bound);
  if (!tail.length) return [];
  return mergeCnyPrefixAndCanonical(resolveCnyValidatedPrefix(history, bound), tail);
}

export function cnyPublisherPoints(account, prevPoints) {
  const journal = cnyJournalHistoryPoints(account);
  if (!journal.length) return null;
  const bound = journal[0].t;
  const fromPrev = extractCnyValidatedPrefix(prevPoints, bound);
  const prefix = fromPrev.length ? fromPrev : reviewedCnyPrefixFixture(bound);
  return mergeCnyPrefixAndCanonical(prefix, journal);
}
