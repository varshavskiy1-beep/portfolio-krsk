/**
 * Слияние снимка ленты в history.json (без файлов и сети — для sync-equity и тестов).
 * Счёт с непустым equity_curve: ряд ключа заменяется этой кривой целиком
 * (капитал — число). ETH по сигналу OKX — так же, если history пришёл с часами.
 * Остальные счета только дописываются.
 * Снятый / исчезнувший из ленты account_id не держим в series и не создаём заново.
 */
import { canonicalCurrency } from "./cashCurrency.js";
import { equityCurvePoints, hasEquityCurve } from "./equityCurve.js";
import { ethOkxTimedSeries } from "./ethOkxCard.js";
import { applyHistoryResets, filterResetPoints, shouldAppendHistoryPoint } from "./historyReset.js";
import { capHistoryPoints } from "./historyStore.js";
import {
  ROBOT2_ACCOUNT_ID,
  ROBOT2_BOT_ID,
  isHiddenPortalAccount,
  isHiddenPortalId,
} from "./strategyMeta.js";

function keyOf(a) {
  return `${a.bot_id}::${a.account_id}`;
}

function isRetiredFeedId(id) {
  const n = String(id || "").trim().toLowerCase();
  return n === ROBOT2_BOT_ID || n === ROBOT2_ACCOUNT_ID;
}

export function isDroppedEquitySeries(key, series) {
  if (isRetiredFeedId(series?.bot_id) || isRetiredFeedId(series?.account_id)) return true;
  return String(key || "").split("::").some(isRetiredFeedId);
}

/** Убирает снятые стратегии из снимка ленты перед публикацией latest.json. */
export function dropHiddenFeedRows(latest) {
  if (!latest) return latest;
  if (Array.isArray(latest.accounts)) {
    latest.accounts = latest.accounts.filter((a) => a && !isHiddenPortalAccount(a));
  }
  if (Array.isArray(latest.manifest)) {
    latest.manifest = latest.manifest.filter((m) => m && !isHiddenPortalId(m.bot_id));
  }
  return latest;
}

/**
 * Если account_id исчез из ленты или стратегия снята — ряд не оставляем.
 * Карточку из orphan series не восстанавливаем.
 */
export function dropOrphanHistorySeries(hist, _latest) {
  if (!hist?.series) return [];
  const dropped = [];
  for (const key of Object.keys(hist.series)) {
    if (isDroppedEquitySeries(key, hist.series[key])) {
      delete hist.series[key];
      dropped.push(key);
    }
  }
  return dropped;
}

export function mergeLatestIntoHistory(hist, latest) {
  const gen = latest.generated_at || new Date().toISOString();
  hist.updated_at = gen;
  // v6b1 reset_from 2026-10-15T17:27:12Z;
  // rf_bonds_rate_cycle reset_from 2026-10-10T08:13:19Z (drop wealth-index 2.44).
  // Drop the old books even if this history.json (or a merge with master) still has them.
  applyHistoryResets(hist);
  for (const a of latest.accounts || []) {
    if (isHiddenPortalAccount(a)) continue;
    const k = keyOf(a);
    // ETH по сигналу OKX: ряд с часами (equity_curve или history с UTC) заменяет ключ так же.
    const timedEth = ethOkxTimedSeries(a);
    if (hasEquityCurve(a) || timedEth.length) {
      const curve = timedEth.length ? timedEth : equityCurvePoints(a);
      if (curve.length) {
        const prev = hist.series[k] || {};
        hist.series[k] = {
          ...prev,
          bot_id: a.bot_id,
          account_id: a.account_id,
          currency: canonicalCurrency(a),
          seed: a.seed == null || a.seed === "" ? prev.seed ?? null : Number(a.seed),
          points: capHistoryPoints(filterResetPoints(k, curve)),
        };
        continue;
      }
    }
    const eq = a.equity == null || a.equity === "" ? null : Number(a.equity);
    const ts = a.updated_utc || gen;
    const currency = canonicalCurrency(a);
    if (!shouldAppendHistoryPoint(k, ts)) continue;
    if (!hist.series[k]) {
      hist.series[k] = {
        bot_id: a.bot_id,
        account_id: a.account_id,
        currency,
        seed: a.seed == null || a.seed === "" ? null : Number(a.seed),
        points: [],
      };
    }
    const s = hist.series[k];
    if (a.seed != null && a.seed !== "") s.seed = Number(a.seed);
    s.currency = currency;
    if (eq == null || Number.isNaN(eq)) continue;
    const pts = s.points;
    const last = pts[pts.length - 1];
    // skip duplicate identical consecutive points (same minute + same equity)
    if (last && last.t === ts && Math.abs(last.equity - eq) < 1e-9) continue;
    // if last point same second window within 50s and same equity — skip
    if (last && Math.abs(last.equity - eq) < 1e-9) {
      const t0 = Date.parse(last.t);
      const t1 = Date.parse(ts);
      if (!Number.isNaN(t0) && !Number.isNaN(t1) && Math.abs(t1 - t0) < 50_000) continue;
    }
    pts.push({ t: ts, equity: eq });
    s.points = capHistoryPoints(pts);
  }
  applyHistoryResets(hist);
  dropOrphanHistorySeries(hist, latest);
  return hist;
}
