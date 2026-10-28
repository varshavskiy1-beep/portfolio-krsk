/**
 * Выбор точек LIVE-истории. Без склейки PAPER/backtest, reset_from и
 * специальных резолверов по совпавшему bot_id.
 */

import { liveSeriesKey } from "./liveCatalog.js";

/**
 * @param {object|null} account
 * @param {object|null} history
 * @returns {Array<{ t: string, equity: number }>}
 */
export function resolveLiveEquityPoints(account, history) {
  if (!account) return [];
  if (account.valuation_basis === "unknown") return [];
  if (account.equity == null && !history) return [];
  const key = liveSeriesKey(account.bot_id, account.account_id);
  const points = history?.series?.[key]?.points;
  return Array.isArray(points) ? points : [];
}

/**
 * @param {object} account
 * @returns {{ kind: "unknown_basis"|"no_value"|"value", text?: string, value?: number }}
 */
export function liveEquityDisplay(account) {
  if (!account) return { kind: "no_value", text: "Нет данных о стоимости счёта" };
  if (account.valuation_basis === "unknown") {
    return { kind: "unknown_basis", text: "Метод оценки счёта не подтверждён" };
  }
  if (account.equity == null || !Number.isFinite(account.equity)) {
    return { kind: "no_value", text: "Нет данных о стоимости счёта" };
  }
  return { kind: "value", value: account.equity };
}
