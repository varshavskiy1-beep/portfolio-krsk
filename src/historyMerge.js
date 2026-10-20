/**
 * Слияние снимка ленты в history.json (без файлов и сети — для sync-equity и тестов).
 * Счёт с непустым equity_curve: ряд ключа заменяется этой кривой целиком
 * (капитал — число). Остальные счета только дописываются.
 */
import { canonicalCurrency } from "./cashCurrency.js";
import { equityCurvePoints, hasEquityCurve } from "./equityCurve.js";
import { applyHistoryResets, filterResetPoints, shouldAppendHistoryPoint } from "./historyReset.js";
import { capHistoryPoints } from "./historyStore.js";

function keyOf(a) {
  return `${a.bot_id}::${a.account_id}`;
}

export function mergeLatestIntoHistory(hist, latest) {
  const gen = latest.generated_at || new Date().toISOString();
  hist.updated_at = gen;
  // paper_block2 reset_from 2026-10-15T08:57:31Z; v6b1 reset_from 2026-10-15T17:27:12Z;
  // rf_bonds_rate_cycle reset_from 2026-10-10T08:13:19Z (drop wealth-index 2.44).
  // Drop the old books even if this history.json (or a merge with master) still has them.
  applyHistoryResets(hist);
  for (const a of latest.accounts || []) {
    const k = keyOf(a);
    if (hasEquityCurve(a)) {
      const curve = equityCurvePoints(a);
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
  return hist;
}
