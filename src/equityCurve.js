/**
 * Поле equity_curve из ленты: готовый ряд капитала, посчитанный сервером.
 * Капитал приходит строкой — здесь он становится числом. Точки без времени
 * или без числа отбрасываются, новых не добавляем, ряд не сглаживаем.
 */

export function hasEquityCurve(account) {
  return Array.isArray(account?.equity_curve) && account.equity_curve.length > 0;
}

/** [{t, equity:number}] по времени, одна точка на метку времени (берём последнюю). */
export function equityCurvePoints(account) {
  if (!hasEquityCurve(account)) return [];
  const byMs = new Map();
  for (const p of account.equity_curve) {
    const t = p?.t ?? p?.time;
    if (t == null || t === "") continue;
    const ms = Date.parse(String(t));
    if (Number.isNaN(ms)) continue;
    const raw = p?.equity;
    if (raw == null || (typeof raw === "string" && raw.trim() === "")) continue;
    const equity = Number(raw);
    if (!Number.isFinite(equity)) continue;
    byMs.set(ms, { t: String(t), equity });
  }
  return [...byMs.entries()].sort((a, b) => a[0] - b[0]).map(([, p]) => p);
}
