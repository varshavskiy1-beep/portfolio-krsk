/**
 * Снятие hidden/retired счетов из latest/history без Node API.
 * Браузер (loadFeed), sync и gh-pages publisher пользуются одним фильтром.
 */
import { neutralizeStaleBundledCny } from "./cnyMomCard.js";
import {
  FORTS_ADR_ADAPTIVE_ACCOUNT_ID,
  FORTS_ADR_ADAPTIVE_BOT_ID,
  FORTS_ADR_STATIC_ACCOUNT_ID,
  FORTS_ADR_STATIC_BOT_ID,
  PUMP_RADAR_ACCOUNT_ID,
  PUMP_RADAR_BOT_ID,
  ROBOT2_ACCOUNT_ID,
  ROBOT2_BOT_ID,
  isHiddenPortalAccount,
  isHiddenPortalId,
} from "./strategyMeta.js";

const RETIRED_EQUITY_IDS = new Set([
  ROBOT2_BOT_ID,
  ROBOT2_ACCOUNT_ID,
  FORTS_ADR_ADAPTIVE_BOT_ID,
  FORTS_ADR_ADAPTIVE_ACCOUNT_ID,
  PUMP_RADAR_BOT_ID,
  PUMP_RADAR_ACCOUNT_ID,
  FORTS_ADR_STATIC_BOT_ID,
  FORTS_ADR_STATIC_ACCOUNT_ID,
]);

function isRetiredFeedId(id) {
  return RETIRED_EQUITY_IDS.has(String(id || "").trim().toLowerCase());
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

/**
 * Снимает hidden accounts/manifest и retired series с in-memory снимка.
 * Нужно sync/publish (чтобы id не уехал на gh-pages) и загрузке кабинета
 * (устаревший cache / повторный bot_id с хоста не воскрешают карточку).
 */
export function sanitizeCabinetSnapshot(latest, history) {
  dropHiddenFeedRows(latest);
  if (history) dropOrphanHistorySeries(history, latest);
  neutralizeStaleBundledCny(latest, history);
  return { latest, history };
}
