/**
 * Prospective consumer for ETH_OKX_SIGNAL_MOEX_FUT_30D_L05 forward paper reset.
 *
 * Contract (WORK @ b51801de, docs/releases/ETH_OKX_FORWARD_CONSUMER_CONTRACT_20261109.md):
 * account_key eth_okx_moex::eth_okx_moex; strategy_id required; history_mode replace;
 * reconstructed is False (missing/true reject); generation is copied by the exporter
 * from sidecar eth_okx_moex.forward.json into accounts[] — portal does not read
 * the sidecar; start is the actual seed_at UTC (not necessarily a round hour,
 * not 00:00/27.10); history[0] t=start equity 300000; history == equity_curve;
 * seed export is only the seed row; curve export is seed + real rows after pin,
 * without substituting equity.
 *
 * Until a valid generation is in accounts[], do not change the live account.
 * Invalid contract → fail closed: empty curve, no invented 300000/0%, no union
 * with stale history.json / backtests.
 */

import { canonicalCurrency } from "./cashCurrency.js";
import { capHistoryPoints } from "./historyStore.js";
import { pointTimeMs } from "./historyReset.js";
import {
  ETH_OKX_MOEX_ACCOUNT_ID,
  ETH_OKX_MOEX_BOT_ID,
  ETH_OKX_MOEX_CANON_ID,
  isEthOkxMoex,
} from "./strategyMeta.js";

export const ETH_OKX_FORWARD_STRATEGY_ID = ETH_OKX_MOEX_CANON_ID;
export const ETH_OKX_FORWARD_START_CAPITAL = 300000;
export const ETH_OKX_FORWARD_HISTORY_MODE = "replace";
export const ETH_OKX_FORWARD_SIDECAR = "eth_okx_moex.forward.json";
export const ETH_OKX_FORWARD_SERIES_KEY = `${ETH_OKX_MOEX_BOT_ID}::${ETH_OKX_MOEX_ACCOUNT_ID}`;
export const ETH_OKX_FORWARD_CANCELLED_DAY = "2026-10-27";
export const TEST_FEED_BANNER_RU = "ТЕСТОВЫЙ СНИМОК, не прод";
export const HOUR_MS = 3600 * 1000;

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

/**
 * Actual UTC datetime with a clock (not YYYY-MM-DD). Minutes/seconds may be
 * nonzero — do not require a round hour.
 */
export function isUtcDateTimeStamp(raw) {
  if (typeof raw !== "string") return false;
  const s = raw.trim();
  if (s.length <= 10 || !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s)) return false;
  return !Number.isNaN(Date.parse(s));
}

/** @deprecated name kept for tests that checked date-only rejection */
export function isUtcHourStamp(raw) {
  return isUtcDateTimeStamp(raw);
}

function sameInstant(a, b) {
  const ma = pointTimeMs(a);
  const mb = pointTimeMs(b);
  return ma != null && mb != null && ma === mb;
}

function utcDay(stamp) {
  const ms = pointTimeMs(stamp);
  if (ms == null) return "";
  return new Date(ms).toISOString().slice(0, 10);
}

function utcHms(stamp) {
  const ms = pointTimeMs(stamp);
  if (ms == null) return "";
  return new Date(ms).toISOString().slice(11, 19);
}

/** Cancelled 27.10 restoration: date-only or UTC midnight that day. */
export function isCancelledOct27Midnight(stamp) {
  const s = nonEmptyText(stamp);
  if (!s) return false;
  if (s === ETH_OKX_FORWARD_CANCELLED_DAY) return true;
  return utcDay(s) === ETH_OKX_FORWARD_CANCELLED_DAY && utcHms(s) === "00:00:00";
}

export function seriesStrictlyEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const ta = String(a[i]?.t ?? a[i]?.time ?? "").trim();
    const tb = String(b[i]?.t ?? b[i]?.time ?? "").trim();
    if (ta !== tb) return false;
    const ea = Number(a[i]?.equity);
    const eb = Number(b[i]?.equity);
    if (!Number.isFinite(ea) || !Number.isFinite(eb) || ea !== eb) return false;
  }
  return true;
}

function asPointList(rows) {
  if (!Array.isArray(rows)) return null;
  const out = [];
  for (const p of rows) {
    const t = nonEmptyText(p?.t ?? p?.time);
    const equity = parseCapital(p?.equity);
    if (!t || equity == null) return null;
    out.push({ t, equity });
  }
  return out;
}

/**
 * Exporter may have started a replace payload. Wrong/incomplete contract must
 * not fall through to legacy daily collapse or history.json union.
 */
export function isEthOkxForwardAttempt(account) {
  if (!isEthOkxMoex(account)) return false;
  if (account.history_mode != null && account.history_mode !== "") return true;
  if (account.generation != null && account.generation !== "") return true;
  if (account.reconstructed != null) return true;
  if (account.seed_at != null && account.seed_at !== "") return true;
  if (account.start != null && account.start !== "") return true;
  return false;
}

export function isEthOkxReconstructedExport(account) {
  return isEthOkxMoex(account) && account.reconstructed === true;
}

/**
 * Valid replace generation from accounts[] only. Sidecar is not read here.
 */
export function parseEthOkxForwardReset(account) {
  if (!account) return null;
  if (account.bot_id !== ETH_OKX_MOEX_BOT_ID || account.account_id !== ETH_OKX_MOEX_ACCOUNT_ID) {
    return null;
  }
  if (account.history_mode !== ETH_OKX_FORWARD_HISTORY_MODE) return null;
  if (account.reconstructed !== false) return null;
  if (nonEmptyText(account.strategy_id) !== ETH_OKX_FORWARD_STRATEGY_ID) return null;
  const generation = nonEmptyText(account.generation);
  if (!generation) return null;

  const seedAt = nonEmptyText(account.seed_at);
  if (!isUtcDateTimeStamp(seedAt) || isCancelledOct27Midnight(seedAt)) return null;
  const seedAtMs = pointTimeMs(seedAt);
  if (seedAtMs == null) return null;
  const start = nonEmptyText(account.start) || seedAt;
  if (nonEmptyText(account.start) && !sameInstant(account.start, seedAt)) return null;

  const seed = parseCapital(account.seed);
  if (seed == null || Math.abs(seed - ETH_OKX_FORWARD_START_CAPITAL) > START_CAPITAL_EPS) return null;
  if (account.start_capital != null && account.start_capital !== "") {
    const cap = parseCapital(account.start_capital);
    if (cap == null || Math.abs(cap - ETH_OKX_FORWARD_START_CAPITAL) > START_CAPITAL_EPS) return null;
  }

  const history = asPointList(account.history);
  const curve = asPointList(account.equity_curve);
  if (!history || !curve || !seriesStrictlyEqual(account.history, account.equity_curve)) return null;
  const first = history[0];
  if (!first || !sameInstant(first.t, seedAt)) return null;
  if (Math.abs(first.equity - ETH_OKX_FORWARD_START_CAPITAL) > START_CAPITAL_EPS) return null;

  return {
    generation,
    historyMode: ETH_OKX_FORWARD_HISTORY_MODE,
    reconstructed: false,
    strategyId: ETH_OKX_FORWARD_STRATEGY_ID,
    accountKey: ETH_OKX_FORWARD_SERIES_KEY,
    seedAt,
    seedAtMs,
    start,
    startCapital: ETH_OKX_FORWARD_START_CAPITAL,
    points: history.map((p) => ({ t: p.t, equity: p.equity })),
  };
}

export function isValidEthOkxForwardReset(account) {
  return parseEthOkxForwardReset(account) != null;
}

/**
 * Valid replace → export series as-is (already history==curve, history[0]=seed).
 * Failed attempt → [] (fail closed). Otherwise null (legacy path).
 */
export function ethOkxForwardExportCurve(account) {
  const spec = parseEthOkxForwardReset(account);
  if (spec) return spec.points;
  if (isEthOkxForwardAttempt(account)) return [];
  return null;
}

export function ethOkxForwardChartSeed(account) {
  const spec = parseEthOkxForwardReset(account);
  if (spec) return spec.startCapital;
  return null;
}

export function ethOkxForwardHourLabelsAfterMs(account) {
  const spec = parseEthOkxForwardReset(account);
  return spec ? spec.seedAtMs : null;
}

/** Next UTC hour strictly after seed. Do not round seed down to HH:00. */
export function nextUtcHourAfter(seedAtMs) {
  if (seedAtMs == null || !Number.isFinite(seedAtMs)) return null;
  return Math.floor(seedAtMs / HOUR_MS) * HOUR_MS + HOUR_MS;
}

export function allowForwardHourTick(timeUnix, seedAtMs) {
  if (seedAtMs == null || !Number.isFinite(seedAtMs)) return true;
  let ms = Number(timeUnix);
  if (!Number.isFinite(ms)) return false;
  if (ms > 0 && ms < 1e12) ms *= 1000;
  return ms > seedAtMs;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Hour axis labels strictly after seed; seed itself is not rounded to HH:00. */
export function formatForwardHourTick(time, tickMarkType, seedAtMs) {
  let ms = typeof time === "number" ? time : Date.parse(String(time));
  if (!Number.isFinite(ms)) return "";
  if (ms > 0 && ms < 1e12) ms *= 1000;
  const isHour = tickMarkType === 3 || tickMarkType === 4;
  if (isHour && !allowForwardHourTick(ms / 1000, seedAtMs)) return "";
  const d = new Date(ms);
  if (tickMarkType === 4) {
    return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
  }
  if (tickMarkType === 3) return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  if (tickMarkType === 0) return String(d.getUTCFullYear());
  if (tickMarkType === 1) return d.toISOString().slice(0, 7);
  return d.toISOString().slice(5, 10);
}

export function dropPointsBeforeSeedAt(points, seedAt) {
  const cutoff = pointTimeMs(seedAt);
  if (cutoff == null) return Array.isArray(points) ? points : [];
  return (points || []).filter((p) => {
    const ms = pointTimeMs(p?.t ?? p?.time);
    return ms != null && ms >= cutoff;
  });
}

export function applyEthOkxForwardHistoryReplace(hist, account) {
  const spec = parseEthOkxForwardReset(account);
  if (!spec || !hist) return false;
  if (!hist.series) hist.series = {};
  hist.series[ETH_OKX_FORWARD_SERIES_KEY] = {
    bot_id: account.bot_id,
    account_id: account.account_id,
    currency: canonicalCurrency(account) || "RUB",
    seed: spec.startCapital,
    generation: spec.generation,
    history_mode: spec.historyMode,
    reconstructed: false,
    seed_at: spec.seedAt,
    points: capHistoryPoints(spec.points),
  };
  return true;
}

/**
 * Failed or departed generation: drop replace-mode cache so the next book
 * does not splice onto it.
 */
export function dropStaleEthOkxForwardGenerationCache(hist, account) {
  if (!hist?.series || !isEthOkxMoex(account)) return false;
  if (parseEthOkxForwardReset(account)) return false;
  const stored = hist.series[ETH_OKX_FORWARD_SERIES_KEY];
  if (stored?.generation == null || stored.generation === "") return false;
  delete hist.series[ETH_OKX_FORWARD_SERIES_KEY];
  return true;
}

export function withoutEthOkxForwardBacktest(backtests, account) {
  if (!parseEthOkxForwardReset(account) && !isEthOkxForwardAttempt(account)) return backtests;
  if (!backtests?.series?.[ETH_OKX_FORWARD_SERIES_KEY]) return backtests;
  const series = { ...backtests.series };
  delete series[ETH_OKX_FORWARD_SERIES_KEY];
  return { ...backtests, series };
}
