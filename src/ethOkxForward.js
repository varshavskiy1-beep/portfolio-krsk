/**
 * Prospective consumer for the ETH OKX forward paper reset.
 * Source of truth is accounts[] in the data-only feed (equity-ro latest.json /
 * GitHub Pages). Sidecar eth_okx_moex.forward.json is not ongoing equity.
 *
 * WORK PR586 cursor/eth-okx-paper-forward-init-35ee @
 * b51801de223387a7fc17d903c03723a90d12f445
 * docs/releases/ETH_OKX_FORWARD_CONSUMER_CONTRACT_20261109.md was not
 * readable here (WORK repo 404). Fields follow the user task:
 * history_mode=replace, generation, reconstructed === false, exact
 * strategy_id, seed_at UTC-hour cutoff, start_capital 300000.
 *
 * Until a valid backend generation is in the export, do not change the
 * live account, invent a seed, or publish a fake 0%.
 */

import { canonicalCurrency } from "./cashCurrency.js";
import { equityCurvePoints, hasEquityCurve } from "./equityCurve.js";
import { capHistoryPoints } from "./historyStore.js";
import { pointTimeMs } from "./historyReset.js";
import {
  ETH_OKX_MOEX_CANON_ID,
  isEthOkxMoex,
} from "./strategyMeta.js";

export const ETH_OKX_FORWARD_STRATEGY_ID = ETH_OKX_MOEX_CANON_ID;
export const ETH_OKX_FORWARD_START_CAPITAL = 300000;
export const ETH_OKX_FORWARD_HISTORY_MODE = "replace";
export const ETH_OKX_FORWARD_SIDECAR = "eth_okx_moex.forward.json";
export const ETH_OKX_FORWARD_SERIES_KEY = "eth_okx_moex::eth_okx_moex";
export const TEST_FEED_BANNER_RU = "ТЕСТОВЫЙ СНИМОК, не прод";

const START_CAPITAL_EPS = 1e-6;

export function isEthOkxForwardSidecarUrl(url) {
  return String(url || "").includes(ETH_OKX_FORWARD_SIDECAR);
}

export function isTestFeedSnapshot(latest) {
  return latest?.test_fixture === true;
}

function nonEmptyText(v) {
  if (v == null) return "";
  return String(v).trim();
}

function parseCapital(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Hour UTC stamp (longer than YYYY-MM-DD and parseable). Date-only is not a seed hour. */
export function isUtcHourStamp(raw) {
  if (typeof raw !== "string") return false;
  const s = raw.trim();
  if (s.length <= 10 || !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s)) return false;
  return !Number.isNaN(Date.parse(s));
}

function hasHourStamp(point) {
  const raw = point?.t ?? point?.time;
  return isUtcHourStamp(typeof raw === "string" ? raw : "");
}

function parseEquityPoint(p) {
  if (!p) return null;
  const t = p.t ?? p.time;
  if (t == null || t === "") return null;
  const stamp = String(t).trim();
  const ms = Date.parse(stamp);
  if (Number.isNaN(ms)) return null;
  const raw = p.equity;
  if (raw == null || (typeof raw === "string" && raw.trim() === "")) return null;
  const equity = Number(raw);
  if (!Number.isFinite(equity)) return null;
  return { t: stamp, equity, ms };
}

function lastPointPerMs(points) {
  const byMs = new Map();
  for (const p of points || []) {
    const row = parseEquityPoint(p);
    if (!row) continue;
    byMs.set(row.ms, { t: row.t, equity: row.equity });
  }
  return [...byMs.entries()].sort((a, b) => a[0] - b[0]).map(([, p]) => p);
}

/**
 * Valid forward reset from accounts[] only. reconstructed must be boolean false.
 * Wrong strategy_id, splice/union modes, reconstructed history, missing generation
 * or a date-only seed_at do not qualify — live state stays as the export is.
 */
export function parseEthOkxForwardReset(account) {
  if (!isEthOkxMoex(account)) return null;
  if (account.history_mode !== ETH_OKX_FORWARD_HISTORY_MODE) return null;
  if (account.reconstructed !== false) return null;
  if (nonEmptyText(account.strategy_id) !== ETH_OKX_FORWARD_STRATEGY_ID) return null;
  const generation = nonEmptyText(account.generation);
  if (!generation) return null;
  const seedAt = nonEmptyText(account.seed_at);
  if (!isUtcHourStamp(seedAt)) return null;
  const seedAtMs = Date.parse(seedAt);
  if (Number.isNaN(seedAtMs)) return null;
  const startCapital = parseCapital(account.start_capital);
  if (startCapital == null || Math.abs(startCapital - ETH_OKX_FORWARD_START_CAPITAL) > START_CAPITAL_EPS) {
    return null;
  }
  return {
    generation,
    historyMode: ETH_OKX_FORWARD_HISTORY_MODE,
    reconstructed: false,
    strategyId: ETH_OKX_FORWARD_STRATEGY_ID,
    seedAt,
    seedAtMs,
    startCapital: ETH_OKX_FORWARD_START_CAPITAL,
  };
}

export function isValidEthOkxForwardReset(account) {
  return parseEthOkxForwardReset(account) != null;
}

/** Cancelled 27.10 restoration: do not splice a reconstructed book into the cache. */
export function isEthOkxReconstructedExport(account) {
  return isEthOkxMoex(account) && account.reconstructed === true;
}

/**
 * Actual export curve for a valid replace generation: equity_curve, else hourly
 * history. Date-only rows are not mixed into the hourly track. Points before
 * seed_at are dropped. Missing points are not invented.
 * @returns {Array|{t:string,equity:number}[]|null} null = not in forward replace mode
 */
export function ethOkxForwardExportCurve(account) {
  const spec = parseEthOkxForwardReset(account);
  if (!spec) return null;
  let raw = [];
  if (hasEquityCurve(account)) {
    raw = equityCurvePoints(account);
  }
  if (!raw.length) {
    const hist = Array.isArray(account.history) ? account.history : [];
    const hourly = hist.filter(hasHourStamp);
    raw = lastPointPerMs(hourly.length ? hourly : hist);
  }
  return raw.filter((p) => {
    const ms = pointTimeMs(p.t ?? p.time);
    return ms != null && ms >= spec.seedAtMs;
  });
}

export function ethOkxForwardChartSeed(account) {
  const spec = parseEthOkxForwardReset(account);
  if (spec) return spec.startCapital;
  return null;
}

export function dropPointsBeforeSeedAt(points, seedAt) {
  const cutoff = pointTimeMs(seedAt);
  if (cutoff == null) return Array.isArray(points) ? points : [];
  return (points || []).filter((p) => {
    const ms = pointTimeMs(p?.t ?? p?.time);
    return ms != null && ms >= cutoff;
  });
}

/** New generation replaces the stored series; never union with the previous cache. */
export function applyEthOkxForwardHistoryReplace(hist, account) {
  const spec = parseEthOkxForwardReset(account);
  if (!spec || !hist) return false;
  if (!hist.series) hist.series = {};
  const points = ethOkxForwardExportCurve(account) || [];
  hist.series[ETH_OKX_FORWARD_SERIES_KEY] = {
    bot_id: account.bot_id,
    account_id: account.account_id,
    currency: canonicalCurrency(account) || "RUB",
    seed: spec.startCapital,
    generation: spec.generation,
    history_mode: spec.historyMode,
    reconstructed: false,
    seed_at: spec.seedAt,
    points: capHistoryPoints(points),
  };
  return true;
}

/**
 * Generation left the feed: drop the replace-mode cache so the next append
 * does not splice the new book onto (or under) the old one.
 */
export function dropStaleEthOkxForwardGenerationCache(hist, account) {
  if (!hist?.series || !isEthOkxMoex(account)) return false;
  if (parseEthOkxForwardReset(account)) return false;
  const stored = hist.series[ETH_OKX_FORWARD_SERIES_KEY];
  if (stored?.generation == null || stored.generation === "") return false;
  delete hist.series[ETH_OKX_FORWARD_SERIES_KEY];
  return true;
}

/** Working stitch must not union the new book with the old tester backtest. */
export function withoutEthOkxForwardBacktest(backtests, account) {
  if (!parseEthOkxForwardReset(account)) return backtests;
  if (!backtests?.series?.[ETH_OKX_FORWARD_SERIES_KEY]) return backtests;
  const series = { ...backtests.series };
  delete series[ETH_OKX_FORWARD_SERIES_KEY];
  return { ...backtests, series };
}
