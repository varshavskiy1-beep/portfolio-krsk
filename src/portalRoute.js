/**
 * Hash-маршруты кабинета. Снятые bot_id не доходят до паспорта и StrategyPage.
 */

import { isHiddenPortalId, normalizePortalId } from "./strategyMeta.js";

export function parsePortalHash(hash) {
  const h = String(hash || "").replace(/^#/, "");
  const m = h.match(/^\/?s\/([^/]+)\/?$/);
  if (!m) return { name: "home" };
  let raw = m[1];
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* оставляем как есть */
  }
  return { name: "strategy", botId: normalizePortalId(raw) };
}

export function readPortalRoute() {
  if (typeof window === "undefined") return { name: "home" };
  return parsePortalHash(window.location.hash);
}

export function isBlockedStrategyRoute(route) {
  return route?.name === "strategy" && isHiddenPortalId(route.botId);
}
